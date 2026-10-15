/**
 * imageHeader.ts — read an image's format, size, EXIF rotation and animation
 * flag from its first bytes, without decoding it. Pure (Buffer in, plain
 * object out) so a 50-megapixel photo costs a few kilobytes of reading.
 * Anything it cannot read comes back as `null` and the caller falls back to
 * a real decode.
 */
export type SniffedFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | 'avif' | 'heic' | 'tiff' | 'pdf' | 'svg' | 'video' | 'audio' | 'unknown'

export interface ImageHeader {
  format: SniffedFormat
  /** Pixel size as stored (before EXIF rotation). */
  width: number | null
  height: number | null
  /** EXIF orientation 1–8 (JPEG only; 1 when absent). */
  orientation: number
  animated: boolean
  hasAlpha: boolean | null
}

export function sniffFormat(b: Buffer): SniffedFormat {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (b.length >= 6 && (b.toString('latin1', 0, 6) === 'GIF87a' || b.toString('latin1', 0, 6) === 'GIF89a')) return 'gif'
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp'
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return 'bmp'
  if (b.length >= 4 && b.toString('latin1', 0, 5) === '%PDF-') return 'pdf'
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a))) return 'tiff'
  if (b.length >= 12 && b.toString('latin1', 4, 8) === 'ftyp') {
    const brand = b.toString('latin1', 8, 12)
    if (brand === 'avif' || brand === 'avis') return 'avif'
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'].includes(brand)) return 'heic'
    return 'video' // mp4 / mov / m4a family
  }
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video' // mkv / webm
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && (b.toString('latin1', 8, 12) === 'AVI ' || b.toString('latin1', 8, 12) === 'WAVE')) {
    return b.toString('latin1', 8, 12) === 'AVI ' ? 'video' : 'audio'
  }
  if (b.length >= 3 && (b.toString('latin1', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0))) return 'audio'
  if (b.length >= 4 && (b.toString('latin1', 0, 4) === 'fLaC' || b.toString('latin1', 0, 4) === 'OggS')) return 'audio'
  const head = b.toString('utf8', 0, Math.min(b.length, 512)).trimStart().toLowerCase()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'svg'
  return 'unknown'
}

function jpegHeader(b: Buffer): Partial<ImageHeader> {
  let i = 2
  let orientation = 1
  let width: number | null = null
  let height: number | null = null
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) {
      i++
      continue
    }
    const marker = b[i + 1]
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) {
      i += marker === 0xff ? 1 : 2
      continue
    }
    const len = b.readUInt16BE(i + 2)
    if (marker === 0xe1 && b.toString('latin1', i + 4, i + 8) === 'Exif') {
      const t = i + 10 // TIFF header
      const le = b.toString('latin1', t, t + 2) === 'II'
      const u16 = (o: number): number => (le ? b.readUInt16LE(o) : b.readUInt16BE(o))
      const u32 = (o: number): number => (le ? b.readUInt32LE(o) : b.readUInt32BE(o))
      try {
        const ifd = t + u32(t + 4)
        const n = u16(ifd)
        for (let k = 0; k < n; k++) {
          const e = ifd + 2 + k * 12
          if (u16(e) === 0x0112) {
            const v = u16(e + 8)
            if (v >= 1 && v <= 8) orientation = v
          }
        }
      } catch {
        /* malformed EXIF — ignore, treat as upright */
      }
    }
    // SOF0..SOF15 except DHT(C4), JPG(C8), DAC(CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      height = b.readUInt16BE(i + 5)
      width = b.readUInt16BE(i + 7)
      break
    }
    i += 2 + len
  }
  return { width, height, orientation, hasAlpha: false }
}

function pngHeader(b: Buffer): Partial<ImageHeader> {
  if (b.length < 29) return {}
  const colorType = b[25]
  // 4 = grey+alpha, 6 = RGBA; palette (3) may carry tRNS — treat as possibly transparent
  const alpha = colorType === 4 || colorType === 6 || (colorType === 3 && b.includes(Buffer.from('tRNS')))
  const animated = b.includes(Buffer.from('acTL'))
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), animated, hasAlpha: alpha }
}

function gifHeader(b: Buffer): Partial<ImageHeader> {
  if (b.length < 13) return {}
  const width = b.readUInt16LE(6)
  const height = b.readUInt16LE(8)
  // Count image descriptors (0x2C) after the header — more than one frame = animated.
  // Walk blocks properly so data bytes equal to 0x2C are not miscounted.
  let i = 13
  if (b[10] & 0x80) i += 3 * (1 << ((b[10] & 7) + 1))
  let frames = 0
  while (i < b.length) {
    const t = b[i]
    if (t === 0x3b) break
    if (t === 0x21) {
      i += 2
      while (i < b.length && b[i] !== 0) i += b[i] + 1
      i++
    } else if (t === 0x2c) {
      frames++
      if (frames > 1) break
      const flags = b[i + 9]
      i += 10
      if (flags & 0x80) i += 3 * (1 << ((flags & 7) + 1))
      i++ // LZW min code size
      while (i < b.length && b[i] !== 0) i += b[i] + 1
      i++
    } else {
      break
    }
  }
  return { width, height, animated: frames > 1, hasAlpha: true }
}

function webpHeader(b: Buffer): Partial<ImageHeader> {
  if (b.length < 30) return {}
  const chunk = b.toString('latin1', 12, 16)
  const animated = b.includes(Buffer.from('ANIM'))
  if (chunk === 'VP8X') {
    const flags = b[20]
    return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3), animated: animated || !!(flags & 0x02), hasAlpha: !!(flags & 0x10) }
  }
  if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff, animated: false, hasAlpha: false }
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, animated: false, hasAlpha: true }
  }
  return {}
}

function bmpHeader(b: Buffer): Partial<ImageHeader> {
  if (b.length < 26) return {}
  return { width: b.readInt32LE(18), height: Math.abs(b.readInt32LE(22)), hasAlpha: false }
}

/** First ~64 KB of the file is enough for every format handled here. */
export function readImageHeader(b: Buffer): ImageHeader {
  const format = sniffFormat(b)
  let r: Partial<ImageHeader> = {}
  try {
    if (format === 'jpeg') r = jpegHeader(b)
    else if (format === 'png') r = pngHeader(b)
    else if (format === 'gif') r = gifHeader(b)
    else if (format === 'webp') r = webpHeader(b)
    else if (format === 'bmp') r = bmpHeader(b)
  } catch {
    r = {}
  }
  return {
    format,
    width: r.width ?? null,
    height: r.height ?? null,
    orientation: r.orientation ?? 1,
    animated: r.animated ?? false,
    hasAlpha: r.hasAlpha ?? null
  }
}

/** Width/height as the picture looks once EXIF rotation is applied. */
export function orientedSize(h: Pick<ImageHeader, 'width' | 'height' | 'orientation'>): { width: number; height: number } | null {
  if (!h.width || !h.height) return null
  return h.orientation >= 5 ? { width: h.height, height: h.width } : { width: h.width, height: h.height }
}
