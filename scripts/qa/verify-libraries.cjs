/* Checks that the bundled sermon + library databases are really there and not empty.
 * Usage: node scripts/qa/verify-libraries.cjs <dir> [--exact <library-snapshot.json>]     (needs Node 22.13+ for the built-in node:sqlite)
 *   <dir> holds sermons.db.gz + library.db.gz (resources/, or <unpacked app>/resources), or the seeded sermons.db + library.db of a data folder.
 * Prints the counts and exits 1 if a file is missing or any count is below what the real libraries have (with a safety margin).
 * With --exact, every count must also equal the one the library snapshot manifest records (scripts/data/library-snapshot.json). */
const fs = require('fs'), path = require('path'), zlib = require('zlib'), os = require('os')
const { DatabaseSync } = require('node:sqlite')
const dir = process.argv[2]
const exactAt = process.argv.indexOf('--exact')
const exact = exactAt > 0 ? JSON.parse(fs.readFileSync(process.argv[exactAt + 1], 'utf8')).counts : null
if (!dir || (exactAt > 0 && !exact)) { console.error('usage: verify-libraries.cjs <dir> [--exact <library-snapshot.json>]'); process.exit(2) }

function open(name) {
  const plain = path.join(dir, name + '.db'), gz = plain + '.gz'
  let file = plain
  if (!fs.existsSync(plain)) {
    if (!fs.existsSync(gz)) return { error: `missing: ${gz} (and ${plain})` }
    if (fs.statSync(gz).size < 1024 * 1024) return { error: `${gz} is only ${fs.statSync(gz).size} bytes` }
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'born-verify-')), name + '.db')
    fs.writeFileSync(file, zlib.gunzipSync(fs.readFileSync(gz)))
  }
  return { db: new DatabaseSync(file, { readOnly: true }) }
}
const count = (db, t) => db.prepare(`select count(*) c from ${t}`).get().c
const rows = []
const check = (label, value, min, key) => {
  rows.push({ label, value, min, ok: value >= min }); console.log(`${value >= min ? 'PASS' : 'FAIL'}  ${label}: ${value} (need >= ${min})`)
  if (!exact) return
  const want = exact[key], ok = value === want
  rows.push({ label, value, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${value} ${ok ? 'equals' : 'differs from'} the snapshot manifest (${want})`)
}

const s = open('sermons'), l = open('library')
if (s.error) { console.log('FAIL  ' + s.error); rows.push({ ok: false }) } else {
  check('sermons', count(s.db, 'sermons'), 1000, 'sermons')
  check('sermon paragraphs', count(s.db, 'paragraphs'), 100000, 'paragraphRows')
}
if (l.error) { console.log('FAIL  ' + l.error); rows.push({ ok: false }) } else {
  check('Bible translations', count(l.db, 'bible_translations'), 3, 'translations')
  check('Bible verses', count(l.db, 'bible_verses'), 90000, 'verses')
  check('songs', count(l.db, 'songs'), 1000, 'songs')
  check('song slides', count(l.db, 'song_slides'), 5000, 'slides')
}
const failed = rows.filter((r) => !r.ok).length
console.log(`\nverify-libraries: ${rows.length} checks, ${failed} failed`)
process.exit(failed ? 1 : 0)
