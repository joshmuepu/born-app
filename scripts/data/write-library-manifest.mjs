#!/usr/bin/env node
/* Writes scripts/data/library-snapshot.json for a newly built library snapshot (used by the "refresh libraries (manual)" workflow).
 * Names, sizes, SHA-256, formats, dates and counts only; never any text from the libraries.
 * The sermon format is read from the app's own constant (SERMON_DB_FORMAT in src/main/sermonDbUpgrade.ts) and must equal the built
 * file's PRAGMA user_version. The library file has no format constant in the app, so its user_version is recorded as it is.
 *
 * Usage: node scripts/data/write-library-manifest.mjs <dir with sermons.db.gz + library.db.gz> <snapshot tag> <check.json> <out manifest>
 *   check.json: the comparison that passed, { "comparedWith": "...", "sermonsMissing": 0, "sermonTextDiffers": 0, ... } */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const [dir, tag, checkPath, out] = process.argv.slice(2)
if (!dir || !tag || !checkPath || !out) {
  console.error('usage: write-library-manifest.mjs <dir> <snapshot tag> <check.json> <out manifest>')
  process.exit(2)
}
if (/^v/i.test(tag)) {
  console.error('a snapshot tag must not start with "v" (release tags do)')
  process.exit(1)
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const m = readFileSync(join(root, 'src/main/sermonDbUpgrade.ts'), 'utf8').match(/export const SERMON_DB_FORMAT = (\d+)/)
if (!m) throw new Error('SERMON_DB_FORMAT not found in src/main/sermonDbUpgrade.ts')
const SERMON_DB_FORMAT = Number(m[1])

const tmp = mkdtempSync(join(tmpdir(), 'born-manifest-'))
const open = (name) => {
  const gz = readFileSync(join(dir, name))
  const file = join(tmp, name.replace(/\.gz$/, ''))
  writeFileSync(file, gunzipSync(gz))
  return { gz, db: new DatabaseSync(file, { readOnly: true }) }
}
const one = (db, sql) => Object.values(db.prepare(sql).get())[0]
const s = open('sermons.db.gz'), l = open('library.db.gz')
const sermonFormat = Number(one(s.db, 'PRAGMA user_version'))
if (sermonFormat !== SERMON_DB_FORMAT) throw new Error(`sermons.db is format ${sermonFormat}, the app expects ${SERMON_DB_FORMAT}`)

const today = new Date().toISOString().slice(0, 10)
const file = (name, x, format, formatFrom) => ({
  name,
  sha256: createHash('sha256').update(x.gz).digest('hex'),
  size: x.gz.length,
  format,
  formatFrom,
  sourceDate: today
})
const manifest = {
  snapshot: tag,
  note: 'Library snapshot used by release builds. Made by the "refresh libraries (manual)" workflow; see docs/notes/library-snapshots.md.',
  created: today,
  files: [
    file('sermons.db.gz', s, sermonFormat, 'SERMON_DB_FORMAT in src/main/sermonDbUpgrade.ts (PRAGMA user_version)'),
    file('library.db.gz', l, Number(one(l.db, 'PRAGMA user_version')), 'PRAGMA user_version (no format constant in the app)')
  ],
  counts: {
    sermons: one(s.db, 'SELECT COUNT(*) FROM sermons'),
    paragraphRows: one(s.db, 'SELECT COUNT(*) FROM paragraphs'),
    translations: one(l.db, 'SELECT COUNT(*) FROM bible_translations'),
    verses: one(l.db, 'SELECT COUNT(*) FROM bible_verses'),
    songs: one(l.db, 'SELECT COUNT(*) FROM songs'),
    slides: one(l.db, 'SELECT COUNT(*) FROM song_slides')
  },
  check: JSON.parse(readFileSync(checkPath, 'utf8'))
}
s.db.close(); l.db.close(); rmSync(tmp, { recursive: true, force: true })
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ snapshot: tag, counts: manifest.counts, files: manifest.files.map((f) => [f.name, f.size, f.sha256]) }, null, 1))
