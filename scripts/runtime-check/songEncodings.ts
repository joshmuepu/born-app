/* Runs on the app's own runtime (Electron's built-in Node, via ELECTRON_RUN_AS_NODE), not only the unit-test Node: song files saved by Windows programs
 * (Windows-1252), UTF-8 with and without a byte-order mark, and UTF-16 with one, through the real parse path (parseSong), plus RTF \'xx and \uN escapes.
 * Synthetic text only. Run: npm run test:runtime */
import { parseSong } from '../../src/main/songParsers'
import { rtfToText } from '../../src/main/songParsers/rtfToText'

let failed = 0
const check = (label: string, ok: boolean, detail = ''): void => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
}
const words = (r: Awaited<ReturnType<typeof parseSong>>): string => ('song' in r ? r.song.slides.map((s) => s.text).join('\n') : 'ERROR ' + r.error)

const WANT = 'He said “Come” – it’s free, €5, café naïve — Œuvre'
// the same line in Windows-1252 bytes
const cp1252 = Buffer.from([
  ...Buffer.from('Invented Song\n\nHe said ', 'latin1'), 0x93, ...Buffer.from('Come', 'latin1'), 0x94, 0x20, 0x96, ...Buffer.from(' it', 'latin1'), 0x92,
  ...Buffer.from('s free, ', 'latin1'), 0x80, ...Buffer.from('5, caf', 'latin1'), 0xe9, ...Buffer.from(' na', 'latin1'), 0xef, ...Buffer.from('ve ', 'latin1'), 0x97, 0x20, 0x8c,
  ...Buffer.from('uvre\n', 'latin1')
])
const CJK = '主耶穌，我愛祢。“恩典”'
const utf8Text = `Invented Song\n\n${WANT}\n${CJK}\n`
const utf16be = (s: string): Buffer => { const le = Buffer.from(s, 'utf16le'); for (let i = 0; i + 1 < le.length; i += 2) { const a = le[i]; le[i] = le[i + 1]; le[i + 1] = a } return le }

;(async () => {
  console.log(`runtime: ${process.versions.electron ? 'Electron ' + process.versions.electron + ', ' : ''}Node ${process.versions.node}`)
  check('a Windows-1252 text song keeps its quotes, apostrophe, dashes, euro and accents', words(await parseSong('invented.txt', cp1252)).includes(WANT), JSON.stringify(words(await parseSong('invented.txt', cp1252)).split('\n')[0]))
  check('a Windows-1252 ChordPro song too', words(await parseSong('invented.cho', Buffer.concat([Buffer.from('{title: Invented Song}\n\n', 'latin1'), cp1252.subarray(15)]))).includes(WANT))
  check('UTF-8 without a byte-order mark (with Chinese)', words(await parseSong('invented.txt', Buffer.from(utf8Text, 'utf8'))).includes(CJK))
  check('UTF-8 with a byte-order mark', (() => true)() && words(await parseSong('invented.txt', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(utf8Text, 'utf8')]))).includes(WANT))
  check('UTF-16 little-endian with a byte-order mark', words(await parseSong('invented.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(utf8Text, 'utf16le')]))).includes(CJK))
  check('UTF-16 big-endian with a byte-order mark', words(await parseSong('invented.txt', Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be(utf8Text)]))).includes(WANT))
  const xml = Buffer.concat([Buffer.from('<?xml version="1.0" encoding="windows-1252"?><song><title>Invented Song</title><lyrics>[V1]\n ', 'latin1'), cp1252.subarray(15, cp1252.length - 1), Buffer.from('</lyrics></song>', 'latin1')])
  check('a Windows-1252 OpenSong file too', words(await parseSong('invented.xml', xml)).includes(WANT), words(await parseSong('invented.xml', xml)).slice(0, 60))
  const rtf = "{\\rtf1\\ansi\\ansicpg1252 He said \\'93Come\\'94 \\'96 it\\'92s free, \\'805, caf\\'e9 na\\'efve \\'97 \\'8cuvre}"
  check('RTF \\\'xx bytes: quotes, euro, accents (fixed table)', rtfToText(rtf) === WANT, JSON.stringify(rtfToText(rtf)))
  const rtfU = '{\\rtf1\\ansi\\uc1 He said \\u8220?Come\\u8221? it\\u8217?s \\u20027?\\u32822?\\u31308?}'
  check('RTF \\uN escapes (curly quotes, CJK) keep the character, not the ? fallback', rtfToText(rtfU) === 'He said “Come” it’s 主耶穌', JSON.stringify(rtfToText(rtfU)))
  console.log(`\nsong-encodings on the app runtime: ${failed} failed`)
  process.exit(failed ? 1 : 0)
})()
