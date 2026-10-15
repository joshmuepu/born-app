/**
 * pdfImport.ts — turn a PDF into pictures in the Media library (one per page),
 * rendered by pdfjs-dist in this window, then handed to the library like any
 * other picture (so de-duplication, thumbnails and health checks all apply).
 *
 * Safety rules: pages are rendered one at a time into a single reused canvas
 * (memory stays flat for a 300-page deck); a page that fails is reported, and
 * if too many fail, or the operator cancels, everything this import added is
 * removed again, so a half-imported deck never lingers.
 */
import type { MediaImportResult } from '../../shared/media'

export const PDF_LIMITS = {
  maxBytes: 200 * 1024 * 1024,
  maxPages: 500,
  warnPages: 150,
  /** Pages are drawn to fit inside this box, so a slide is sharp on a 1440p screen and light on memory. */
  boxW: 2560,
  boxH: 1440,
  /** Never let one page become more than this many pixels, whatever its paper size says. */
  maxPixels: 4_000_000
} as const

export type PdfImportCode = 'password' | 'invalid' | 'too-many-pages' | 'too-large' | 'empty' | 'cancelled' | 'render' | 'io'
export type PdfImportOutcome =
  | { ok: true; name: string; mediaIds: string[]; added: number; reused: number; failedPages: number[]; warnings: string[] }
  | { ok: false; code: PdfImportCode; message: string }

export const PDF_MESSAGES: Record<PdfImportCode, string> = {
  password: 'This PDF is password-protected. Open it in a PDF viewer, save an unprotected copy, and import that.',
  invalid: "This file isn't a readable PDF, or it is damaged. Export it again from the program that made it.",
  'too-many-pages': `This PDF has more than ${PDF_LIMITS.maxPages} pages. Split it into smaller parts and import each one.`,
  'too-large': `This PDF is larger than ${PDF_LIMITS.maxBytes / 1048576} MB. Export a smaller copy and try again.`,
  empty: 'This PDF has no pages.',
  cancelled: 'Cancelled. Nothing was added.',
  render: "Too many pages could not be drawn, so nothing was added. The PDF may use features BORN can't show; export it as images or a simpler PDF.",
  io: 'Something went wrong while adding the pages. Nothing was added.'
}

/** Scale that fits a page of `w`×`h` points inside the render box, within the pixel budget. */
export function pdfPageScale(w: number, h: number): number {
  if (!(w > 0) || !(h > 0)) return 1
  let s = Math.min(PDF_LIMITS.boxW / w, PDF_LIMITS.boxH / h)
  const px = w * s * h * s
  if (px > PDF_LIMITS.maxPixels) s *= Math.sqrt(PDF_LIMITS.maxPixels / px)
  return Math.max(0.1, Math.min(s, 8))
}

/** Map a pdfjs error to one of our plain messages. */
export function mapPdfError(e: unknown): PdfImportCode {
  const name = (e as { name?: string })?.name ?? ''
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase()
  if (name === 'PasswordException' || msg.includes('password')) return 'password'
  if (name === 'InvalidPDFException' || name === 'FormatError' || name === 'MissingPDFException' || msg.includes('invalid pdf') || msg.includes('not a pdf')) return 'invalid'
  return 'invalid'
}

export interface PdfImportDeps {
  importBuffer: (name: string, bytes: ArrayBuffer, opts: { folderId?: string | null; tags?: string[]; linkInPlace?: boolean }) => Promise<MediaImportResult>
  remove: (ids: string[]) => Promise<unknown>
  createFolder: (name: string) => Promise<{ id: string } | null>
}

export async function importPdf(
  data: ArrayBuffer,
  fileName: string,
  deps: PdfImportDeps,
  opts: { onProgress?: (p: { page: number; total: number }) => void; signal?: AbortSignal } = {}
): Promise<PdfImportOutcome> {
  const fail = (code: PdfImportCode): PdfImportOutcome => ({ ok: false, code, message: PDF_MESSAGES[code] })
  if (data.byteLength > PDF_LIMITS.maxBytes) return fail('too-large')
  const head = new Uint8Array(data.slice(0, 1024))
  if (!new TextDecoder('latin1').decode(head).includes('%PDF-')) return fail('invalid')

  // The "legacy" build: the regular one needs JavaScript features newer than this Electron's Chromium
  // (it fails with `toHex is not a function`).
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
  // pdfjs may transfer (detach) the buffer it is given; give it a copy.
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) })
  let doc: Awaited<typeof task.promise>
  try {
    doc = await task.promise
  } catch (e) {
    // Kept in the console so a support request can say why (the operator only sees the plain message).
    console.error(`pdfImport: could not open the PDF — ${(e as Error)?.name}: ${(e as Error)?.message}`)
    return fail(mapPdfError(e))
  }
  const added: string[] = []
  const warnings: string[] = []
  try {
    const total = doc.numPages
    if (total < 1) return fail('empty')
    if (total > PDF_LIMITS.maxPages) return fail('too-many-pages')
    if (total > PDF_LIMITS.warnPages) warnings.push(`Large PDF (${total} pages): adding it may take a minute or two.`)

    const base = fileName.replace(/\.pdf$/i, '').trim() || 'PDF'
    const folder = await deps.createFolder(`PDF — ${base}`).catch(() => null)
    const canvas = document.createElement('canvas')
    const mediaIds: string[] = []
    const failedPages: number[] = []
    let reused = 0

    for (let n = 1; n <= total; n++) {
      if (opts.signal?.aborted) {
        if (added.length) await deps.remove(added)
        return fail('cancelled')
      }
      opts.onProgress?.({ page: n, total })
      let blob: Blob | null = null
      try {
        const page = await doc.getPage(n)
        const base1 = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: pdfPageScale(base1.width, base1.height) })
        canvas.width = Math.max(1, Math.round(viewport.width))
        canvas.height = Math.max(1, Math.round(viewport.height))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no canvas')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        page.cleanup()
        blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
      } catch {
        blob = null
      }
      if (!blob) {
        failedPages.push(n)
        if (failedPages.length > Math.max(3, total / 2)) {
          if (added.length) await deps.remove(added)
          return fail('render')
        }
        continue
      }
      const r = await deps.importBuffer(`${base} p${String(n).padStart(3, '0')}.jpg`, await blob.arrayBuffer(), { folderId: folder?.id ?? null, tags: ['pdf'] })
      if (!r.ok) {
        failedPages.push(n)
        if (r.code === 'no-space') {
          if (added.length) await deps.remove(added)
          return { ok: false, code: 'io', message: r.message }
        }
        continue
      }
      mediaIds.push(r.item.id)
      if (r.duplicate && !r.restored) reused++
      else added.push(r.item.id)
    }
    // keep the pictures that exist, in page order
    canvas.width = canvas.height = 0
    if (mediaIds.length === 0) return fail('render')
    if (failedPages.length) warnings.push(`${failedPages.length} page${failedPages.length === 1 ? '' : 's'} could not be drawn (${failedPages.slice(0, 8).join(', ')}) and ${failedPages.length === 1 ? 'was' : 'were'} left out.`)
    return { ok: true, name: base, mediaIds, added: added.length, reused, failedPages, warnings }
  } finally {
    try {
      await task.destroy()
    } catch {
      /* already gone */
    }
  }
}
