/* Bundled library content for the QA scripts (scripts only, never shipped): every song page and every Bible verse in resources/library.db.gz, the
 * verses split into pages as the app does (shared/paginate.ts). Needs the sqlite3 command. content(dir) works in `dir` and returns
 * { songs, bible } as slide payloads, the Bible pages longest first (the 3,000 longest). */
const fs = require('fs'), path = require('path'), zlib = require('zlib')
const { execFileSync } = require('child_process')
const ROOT = path.join(__dirname, '..', '..')

function content(dir) {
  const db = path.join(dir, 'library.db')
  fs.writeFileSync(db, zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'resources', 'library.db.gz'))))
  const pag = path.join(dir, 'paginate.cjs')
  execFileSync(path.join(ROOT, 'node_modules', '.bin', 'esbuild'), [path.join(ROOT, 'src/shared/paginate.ts'), '--bundle', '--platform=node', '--format=cjs', '--outfile=' + pag, '--log-level=warning'])
  const { paginateText } = require(pag)
  const q = (sql) => JSON.parse(execFileSync('sqlite3', ['-json', db, sql], { maxBuffer: 1 << 30 }).toString() || '[]')
  const books = Object.fromEntries(q('select num, name from bible_books').map((b) => [b.num, b.name]))
  const bible = []
  for (const v of q('select translation t, book b, chapter c, verse v, text from bible_verses')) {
    const pages = paginateText(v.text.trim())
    pages.forEach((p, i) => { const s = pages.length > 1 ? String.fromCharCode(97 + i) : ''; bible.push({ kind: 'bible', text: p, marker: v.v + s, reference: `${books[v.b]} ${v.c}:${v.v}${s} · ${v.t}` }) })
  }
  const songs = q('select s.title, s.author, s.song_key k, ss.label, ss.text from song_slides ss join songs s on s.id = ss.song_id')
    .map((r) => ({ kind: 'song', text: r.text, label: r.label || undefined, reference: [r.title, r.author, r.k ? 'Key of ' + r.k : null].filter(Boolean).join(' · ') }))
  return { songs, bible: bible.sort((a, b) => b.text.length - a.text.length).slice(0, 3000) }
}

module.exports = { content }
