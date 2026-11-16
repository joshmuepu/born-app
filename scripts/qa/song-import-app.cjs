/* Song import in the real app (scripts only, never shipped): synthetic song files in Windows-1252, UTF-8 and UTF-16 go through Songs > Import (the
 * file dialog answered by record-main.cjs), on the app's own runtime, and come back from the song library with their quotes, apostrophes, dashes,
 * euro sign, accents and Chinese intact; the same files again are skipped as already imported (the content hash, computed in the app); a dated copy
 * of the song library is taken first. Invented songs only.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/song-import-app.cjs <profileDir>   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks } = require('./lib.cjs')
const [profile] = process.argv.slice(2)

const WANT = 'He said “Come” – it’s free, €5, café naïve — Œuvre'
const CJK = '主耶穌，我愛祢。'
const HIGH = ['€', '\u0081', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '\u008d', 'Ž', '\u008f', '\u0090', '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', '\u009d', 'ž', 'Ÿ']
const cp1252 = (s) => Buffer.from([...s].map((ch) => { const i = HIGH.indexOf(ch); return i >= 0 ? 0x80 + i : ch.charCodeAt(0) }))

;(async () => {
  const c = checks('song-import-app')
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  const src = path.join(profile, 'import-src'); fs.mkdirSync(src)
  const files = {
    'invented-1252.cho': cp1252(`{title: Invented Windows Song}\n\n[Verse 1]\n${WANT}\n`),
    'invented-utf8.cho': Buffer.from(`{title: Invented Unicode Song}\n\n[Verse 1]\n${WANT}\n${CJK}\n`, 'utf8'),
    'invented-utf16.cho': Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`{title: Invented Wide Song}\n\n[Verse 1]\n${WANT}\n${CJK}\n`, 'utf16le')]),
    'invented-opensong.xml': Buffer.concat([cp1252('<?xml version="1.0" encoding="windows-1252"?><song><title>Invented OpenSong</title><lyrics>[V1]\n '), cp1252(WANT), cp1252('</lyrics></song>')])
  }
  for (const [n, b] of Object.entries(files)) fs.writeFileSync(path.join(src, n), b)
  fs.writeFileSync(path.join(profile, 'qa-open-paths.json'), JSON.stringify(Object.keys(files).map((n) => path.join(src, n))))

  const app = await launch({ profile, remotePort: Number(process.env.BORN_REMOTE_PORT || 14316), port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-parity', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs'), '--require', path.join(__dirname, 'record-main.cjs')] })
  const p = await app.page()
  const r1 = await p.ev('window.electronAPI.importSongs()')
  c.ok('all four files are imported', r1 && r1.added.length === 4 && r1.failed.length === 0, JSON.stringify(r1 && { added: r1.added.map((x) => x.title), failed: r1.failed }))
  for (const t of ['Invented Windows Song', 'Invented Unicode Song', 'Invented Wide Song', 'Invented OpenSong']) {
    const hit = (await p.ev(`window.electronAPI.searchSongs(${JSON.stringify(t)})`)).find((s) => s.title === t)
    const song = hit ? await p.ev(`window.electronAPI.getSong(${hit.id})`) : null
    const words = song ? song.slides.map((s) => s.text).join('\n') : '(not found)'
    c.ok(`${t}: the words come back intact`, words.includes(WANT) && !words.includes('�') && (t === 'Invented Windows Song' || t === 'Invented OpenSong' || words.includes(CJK)), JSON.stringify(words.split('\n')[0]))
  }
  c.ok('a dated copy of the song library was taken first, and the import said where', !!r1.backup && fs.existsSync(r1.backup) && /backups[\\/]library-\d{4}-\d{2}-\d{2}-\d{6}\.db$/.test(r1.backup), String(r1.backup))
  const r2 = await p.ev('window.electronAPI.importSongs()')
  c.ok('the same files again are skipped as already imported', r2 && r2.added.length === 0 && r2.skipped === 4, JSON.stringify(r2 && { added: r2.added.length, skipped: r2.skipped }))
  const ev = JSON.parse(fs.readFileSync(path.join(profile, 'qa-main-events.json'), 'utf8')).find((e) => e.openDialog)
  c.ok(`the file dialog on ${process.platform} can choose files`, ev && ev.openDialog.includes('openFile'), JSON.stringify(ev && ev.openDialog))
  const r = c.done(); p.close(); await app.kill(); process.exit(r.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
