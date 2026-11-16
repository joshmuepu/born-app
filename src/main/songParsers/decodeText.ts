/**
 * decodeText.ts — turn the bytes of a text song file into a string.
 *
 * Valid UTF-8 (with or without a byte-order mark) is read as UTF-8, and UTF-16 with a byte-order mark as UTF-16. Anything else is a file saved by a
 * Windows program in Windows-1252 (curly quotes, apostrophes, dashes, the euro sign, accented letters): it is decoded through the fixed table below,
 * never through the runtime's TextDecoder, whose Windows-1252 tables the packaged app's older built-in Node gets wrong (it reads them as Latin-1, so
 * “ ” ’ – — € come out as invisible control characters).
 */

/** Windows-1252 bytes 0x80–0x9F. The five bytes the code page leaves unassigned keep their own value, as browsers do. Every other byte is the same
 *  code point in Windows-1252 and Unicode. */
export const CP1252_HIGH: readonly string[] = [
  '€', '\u0081', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '\u008d', 'Ž', '\u008f',
  '\u0090', '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', '\u009d', 'ž', 'Ÿ'
]

/** One Windows-1252 byte as text. */
export function cp1252Char(byte: number): string {
  return byte >= 0x80 && byte <= 0x9f ? CP1252_HIGH[byte - 0x80] : String.fromCharCode(byte)
}

/** True when the bytes are well-formed UTF-8 (checked here, byte by byte, not by the runtime). */
export function isValidUtf8(b: Uint8Array): boolean {
  let i = 0
  while (i < b.length) {
    const c = b[i]
    if (c < 0x80) { i++; continue }
    let n: number, min: number
    if (c >= 0xc2 && c <= 0xdf) { n = 1; min = 0x80 } else if (c >= 0xe0 && c <= 0xef) { n = 2; min = 0x800 } else if (c >= 0xf0 && c <= 0xf4) { n = 3; min = 0x10000 } else return false
    if (i + n >= b.length) return false
    let cp = c & (n === 1 ? 0x1f : n === 2 ? 0x0f : 0x07)
    for (let k = 1; k <= n; k++) {
      const x = b[i + k]
      if (x === undefined || (x & 0xc0) !== 0x80) return false
      cp = (cp << 6) | (x & 0x3f)
    }
    if (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return false
    i += n + 1
  }
  return true
}

export function decodeSongBytes(data: Buffer): string {
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) return data.subarray(3).toString('utf8')
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) return data.subarray(2).toString('utf16le')
  if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) {
    const le = Buffer.from(data.subarray(2, 2 + ((data.length - 2) & ~1)))
    for (let i = 0; i + 1 < le.length; i += 2) {
      const a = le[i]
      le[i] = le[i + 1]
      le[i + 1] = a
    }
    return le.toString('utf16le')
  }
  if (isValidUtf8(data)) return data.toString('utf8')
  let out = ''
  for (let i = 0; i < data.length; i++) out += cp1252Char(data[i])
  return out
}
