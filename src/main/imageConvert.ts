/**
 * imageConvert.ts — turn an iPhone photo (HEIC) or a TIFF into a high-quality JPEG, on any operating system.
 *
 * Chromium cannot open either format, and Windows only opens HEIC if the user has installed Microsoft's paid
 * HEVC extension, so BORN carries its own small decoders: libheif (WebAssembly) for HEIC and UTIF for TIFF.
 * The pictures are converted to sRGB (iPhone photos are Display P3), rotation is applied, and a JPEG at quality 92
 * is written. The original file is never touched. This module has no Electron code so it runs in a worker thread
 * (see heicWorker.ts) and directly in tests.
 */
import { readFileSync, writeFileSync } from 'fs'
import { applyToSrgb, colorFromHeic, transformFromIcc, type ColorTransform } from './colorProfile'

export type ConvertOutcome =
  | { ok: true; width: number; height: number; notes: string[] }
  | { ok: false; reason: 'corrupt' | 'too-large' | 'unsupported' | 'io' | 'memory'; detail?: string }

/** RGBA8 is 4 bytes a pixel, plus the decoder's own copy and the JPEG encoder's: a 48-megapixel photo peaks near 1.4 GB, so the limit is 64 megapixels. */
export const MAX_CONVERT_PIXELS = 64_000_000
export const JPEG_QUALITY = 92

interface Frame { width: number; height: number; decode: () => Promise<{ width: number; height: number; data: Uint8ClampedArray }> }

/** Of all the pictures in a HEIC file (burst-style files, depth maps, thumbnails) the one to use is the biggest. */
export function pickPrimary<T extends { width: number; height: number }>(frames: T[]): T | null {
  let best: T | null = null
  for (const f of frames) if (!best || f.width * f.height > best.width * best.height) best = f
  return best
}

async function decodeHeic(file: Buffer, notes: string[]): Promise<{ width: number; height: number; rgba: Uint8Array; color: ColorTransform | null } | ConvertOutcome> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const heic = require('heic-decode') as { all: (o: { buffer: Buffer }) => Promise<Array<Frame> & { dispose: () => void }> }
  let frames: (Array<Frame> & { dispose: () => void }) | null = null
  try {
    frames = await heic.all({ buffer: file })
    const f = pickPrimary(frames)
    if (!f) return { ok: false, reason: 'corrupt', detail: 'no image in file' }
    if (frames.length > 1) notes.push(`This file holds ${frames.length} pictures; the main one was used.`)
    if (f.width * f.height > MAX_CONVERT_PIXELS) return { ok: false, reason: 'too-large' }
    const d = await f.decode()
    return { width: d.width, height: d.height, rgba: new Uint8Array(d.data.buffer, d.data.byteOffset, d.data.byteLength), color: colorFromHeic(file) }
  } catch (e) {
    const msg = (e as Error).message ?? String(e)
    if (/memory|allocation|Array buffer/i.test(msg) || e instanceof RangeError) return { ok: false, reason: 'memory', detail: msg }
    // A codec libheif was not built with (e.g. an AV1 or VVC picture in a HEIF wrapper) is "unsupported"; anything else that fails to parse is a damaged file.
    if (/Unsupported|No matching decoder|codec/i.test(msg)) return { ok: false, reason: 'unsupported', detail: msg }
    return { ok: false, reason: 'corrupt', detail: msg }
  } finally {
    try { frames?.dispose() } catch { /* already freed */ }
  }
}

async function decodeTiff(file: Buffer, notes: string[]): Promise<{ width: number; height: number; rgba: Uint8Array; color: ColorTransform | null } | ConvertOutcome> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const UTIF = require('utif2') as {
    decode: (b: Uint8Array) => Array<Record<string, unknown> & { width?: number; height?: number }>
    decodeImage: (b: Uint8Array, ifd: unknown) => void
    toRGBA8: (ifd: unknown) => Uint8Array
  }
  try {
    const ifds = UTIF.decode(file)
    // Pages of a TIFF can be thumbnails or scans; the biggest is the picture.
    // (the size is only filled in by decodeImage, so read it from the tags: 256 = width, 257 = height)
    const sized = ifds.map((i) => ({ ifd: i, width: (i['t256'] as number[] | undefined)?.[0] ?? 0, height: (i['t257'] as number[] | undefined)?.[0] ?? 0 })).filter((i) => i.width > 0 && i.height > 0)
    const best = pickPrimary(sized)
    if (!best) return { ok: false, reason: 'corrupt', detail: 'no image in file' }
    if (best.width * best.height > MAX_CONVERT_PIXELS) return { ok: false, reason: 'too-large' }
    if (ifds.length > 1) notes.push(`This file has ${ifds.length} pages; the largest was used.`)
    const main = best.ifd as Record<string, unknown> & { width: number; height: number }
    UTIF.decodeImage(file, main)
    const rgba = UTIF.toRGBA8(main)
    if (rgba.length < main.width * main.height * 4) return { ok: false, reason: 'corrupt', detail: 'short pixel data' }
    const iccTag = (main as Record<string, unknown>)['t34675'] as ArrayLike<number> | undefined
    const color = iccTag && iccTag.length > 128 ? transformFromIcc(Buffer.from(iccTag as ArrayLike<number> as number[])) : null
    return { width: main.width, height: main.height, rgba, color }
  } catch (e) {
    const msg = (e as Error).message ?? String(e)
    return { ok: false, reason: e instanceof RangeError ? 'memory' : 'corrupt', detail: msg }
  }
}

export function sniffKind(file: Buffer): 'heic' | 'tiff' | null {
  if (file.length >= 12 && file.toString('latin1', 4, 8) === 'ftyp') return 'heic'
  const h = file.toString('latin1', 0, 4)
  if (h === 'II*\0' || h === 'MM\0*') return 'tiff'
  return null
}

/** Convert `src` (HEIC or TIFF) to a JPEG at `out`. Never throws; a failure says why. */
export async function convertToJpegFile(src: string, out: string): Promise<ConvertOutcome> {
  let file: Buffer
  try {
    file = readFileSync(src)
  } catch (e) {
    return { ok: false, reason: 'io', detail: (e as Error).message }
  }
  const kind = sniffKind(file)
  if (!kind) return { ok: false, reason: 'unsupported' }
  const notes: string[] = []
  const dec = kind === 'heic' ? await decodeHeic(file, notes) : await decodeTiff(file, notes)
  if ('ok' in dec) return dec
  try {
    if (dec.color && !dec.color.identity) {
      applyToSrgb(dec.rgba, dec.color)
      if (dec.color.label === 'p3' || dec.color.label === 'icc') notes.push('Colours were converted to sRGB for the screen.')
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jpeg = require('jpeg-js') as { encode: (img: { data: Uint8Array; width: number; height: number }, q: number) => { data: Buffer } }
    const enc = jpeg.encode({ data: dec.rgba, width: dec.width, height: dec.height }, JPEG_QUALITY)
    writeFileSync(out, enc.data)
    return { ok: true, width: dec.width, height: dec.height, notes }
  } catch (e) {
    const msg = (e as Error).message ?? String(e)
    return { ok: false, reason: e instanceof RangeError || /memory|allocation/i.test(msg) ? 'memory' : 'io', detail: msg }
  }
}
