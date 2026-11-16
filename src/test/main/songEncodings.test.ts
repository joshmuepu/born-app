import { describe, it, expect } from 'vitest'
import { decodeSongBytes, isValidUtf8, CP1252_HIGH } from '../../main/songParsers/decodeText'
import { rtfToText } from '../../main/songParsers/rtfToText'
import { parseSong } from '../../main/songParsers'

// Song files saved by Windows programs (Windows-1252) keep their curly quotes, apostrophes, dashes, euro sign and accents. The same checks run on the
// app's own runtime with `npm run test:runtime` (scripts/runtime-check/songEncodings.ts): this file is the unit-test runtime's half.

const cp = (s: string): Buffer => Buffer.from([...s].map((ch) => { const i = CP1252_HIGH.indexOf(ch); return i >= 0 ? 0x80 + i : ch.charCodeAt(0) }))
const LINE = 'He said “Come” – it’s free, €5, café naïve — Œuvre ™'

describe('song file encodings', () => {
  it('Windows-1252 through the fixed table', () => {
    expect(decodeSongBytes(cp(LINE))).toBe(LINE)
  })
  it('UTF-8 with and without a byte-order mark, UTF-16 with one', () => {
    const t = LINE + ' 主耶穌'
    expect(decodeSongBytes(Buffer.from(t, 'utf8'))).toBe(t)
    expect(decodeSongBytes(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(t, 'utf8')]))).toBe(t)
    expect(decodeSongBytes(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(t, 'utf16le')]))).toBe(t)
  })
  it('tells valid UTF-8 from Windows-1252', () => {
    expect(isValidUtf8(Buffer.from('café 主', 'utf8'))).toBe(true)
    expect(isValidUtf8(cp('café'))).toBe(false)
    expect(isValidUtf8(Buffer.from([0xc3]))).toBe(false) // cut short
    expect(isValidUtf8(Buffer.from([0xed, 0xa0, 0x80]))).toBe(false) // a lone surrogate
  })
  it('a Windows-1252 plain-text song keeps its words through parseSong', async () => {
    const r = await parseSong('invented.txt', Buffer.concat([Buffer.from('Invented Song\n\n'), cp(LINE)]))
    expect('song' in r && r.song.slides.map((s) => s.text).join('\n')).toContain(LINE)
  })
  it("RTF \\'xx bytes and \\uN escapes", () => {
    expect(rtfToText("{\\rtf1\\ansi \\'93Come\\'94 \\'80 caf\\'e9}")).toBe('“Come” € café')
    expect(rtfToText('{\\rtf1\\ansi\\uc1 it\\u8217?s \\u20027?}')).toBe('it’s 主')
  })
})
