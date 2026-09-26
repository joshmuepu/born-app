/**
 * pdf.ts — pull the text layer out of a PDF, for the same downstream
 * blank-line/label auto-detection parsePlainText already does for a .txt
 * file. Uses pdfjs-dist's "legacy" build specifically — the regular build
 * assumes a browser (DOMMatrix, Worker, etc.); legacy is the one built to
 * run directly in a plain Node.js process, which is what Electron's main
 * process is, with no real Worker or workerSrc needed.
 *
 * Deliberately text-only: a scanned/image PDF has no text layer at all, so
 * this returns an empty string for one exactly like it would for a blank
 * file, rather than attempting OCR — see the Songs import proposal for why
 * that's a real, considered scope line, not an oversight.
 */
// pdfjs-dist ships ESM-only; a dynamic import keeps this file loadable from
// the Electron main bundle regardless of how that bundle's own module
// format is configured.
/** pdfjs hands back a flat list of positioned text fragments, not lines or
 *  paragraphs — reconstructing those is on the caller. Each item's own
 *  `hasEOL` says whether a line break follows it; the vertical gap to the
 *  NEXT line (against that line's own font height) says whether it's just
 *  the next line of the same verse or a real paragraph break, which is what
 *  parsePlainText's blank-line convention needs to see a verse boundary. */
interface PositionedTextItem {
  str: string
  hasEOL: boolean
  transform: number[]
  height: number
}

function reconstructText(items: PositionedTextItem[]): string {
  const lines: string[] = []
  let lineBuf: string[] = []
  let lastY: number | null = null
  let lastHeight = 0

  const flushLine = (nextY: number | null, nextHeight: number): void => {
    const text = lineBuf.join('').trim()
    lineBuf = []
    if (!text) return
    if (lastY != null && nextY != null) {
      const gap = Math.abs(lastY - nextY)
      const lineHeight = Math.max(lastHeight, nextHeight, 1)
      // A gap noticeably bigger than a normal line step reads as a stanza
      // break, same as a blank line typed between verses in a .txt file.
      if (gap > lineHeight * 1.6) lines.push('')
    }
    lines.push(text)
  }

  for (const it of items) {
    const y = it.transform[5]
    lineBuf.push(it.str)
    if (it.hasEOL) {
      flushLine(y, it.height)
      lastY = y
      lastHeight = it.height
    }
  }
  if (lineBuf.length) flushLine(null, 0)

  return lines.join('\n')
}

export async function extractPdfText(data: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true })
  try {
    const doc = await loadingTask.promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const items = content.items.filter((it) => 'str' in it) as PositionedTextItem[]
      const text = reconstructText(items).trim()
      if (text) pages.push(text)
    }
    return pages.join('\n\n').trim()
  } finally {
    await loadingTask.destroy()
  }
}
