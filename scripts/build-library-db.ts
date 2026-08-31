/**
 * build-library-db.ts — build resources/library.db.gz: the bundled Bible
 * (KJV + WEB + ASV, all public domain, via bible-api.com) and, in Milestone 2,
 * the bundled song library.
 *
 *   npm run build:library
 *   BORN_BIBLE_LIMIT=2   # only fetch the first 2 books, for a fast smoke test
 */
import Database from 'better-sqlite3'
import { gzipSync } from 'node:zlib'
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
  renameSync,
  readdirSync
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initLibrarySchema } from '../src/main/librarySchema'
import { insertSong } from '../src/main/songInsert'
import { parseSong } from '../src/main/songParsers'
import { BIBLE_BOOKS } from '../src/shared/bibleBooks'

/** Clean bolls.life verse markup: drop <S>1234</S> Strong's tags and
 *  <sup>…</sup> translators' marginal notes ("cool: Heb. wind"), keep <i>
 *  content, flatten the rest. Only the scripture text is ever projected. */
function cleanVerse(raw: string): string {
  return raw
    .replace(/<S>.*?<\/S>/g, '')
    .replace(/<sup>[\s\S]*?<\/sup>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'resources')
const TMP_DB = join(OUT_DIR, 'library.build.db')
const OUT_GZ = join(OUT_DIR, 'library.db.gz')

// bolls.life: public-domain translations, book numbers already 1..66.
const TRANSLATIONS = [
  { code: 'KJV', bolls: 'KJV', name: 'King James Version', order: 1 },
  { code: 'WEB', bolls: 'WEB', name: 'World English Bible', order: 2 },
  { code: 'ASV', bolls: 'ASV', name: 'American Standard Version', order: 3 }
]

const CHAPTER_COUNTS = [
  50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,
  3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchChapter(
  bollsCode: string,
  bookNum: number,
  chapter: number,
  attempt = 0
): Promise<Array<{ verse: number; text: string }>> {
  try {
    const res = await fetch(`https://bolls.life/get-text/${bollsCode}/${bookNum}/${chapter}/`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as Array<{ verse: number; text: string }>
    return json.map((v) => ({ verse: v.verse, text: cleanVerse(v.text) }))
  } catch (e) {
    if (attempt < 5) {
      await sleep(800 * (attempt + 1))
      return fetchChapter(bollsCode, bookNum, chapter, attempt + 1)
    }
    throw e
  }
}

async function buildBible(db: Database.Database): Promise<void> {
  const insTrans = db.prepare(
    'INSERT OR REPLACE INTO bible_translations (code, name, sort_order) VALUES (?, ?, ?)'
  )
  const insBook = db.prepare('INSERT OR REPLACE INTO bible_books (num, name, abbrev) VALUES (?, ?, ?)')
  db.transaction(() => {
    for (const t of TRANSLATIONS) insTrans.run(t.code, t.name, t.order)
    for (const b of BIBLE_BOOKS) insBook.run(b.num, b.name, b.abbrev)
  })()

  const insVerse = db.prepare(
    'INSERT OR IGNORE INTO bible_verses (translation, book, chapter, verse, text) VALUES (?, ?, ?, ?, ?)'
  )
  // One transaction fn reused for every chapter (creating one per chapter crashes
  // the GC on newer Node via better-sqlite3's statement finalizers).
  const insertChapter = db.transaction(
    (trans: string, bookNum: number, chapter: number, rows: Array<{ verse: number; text: string }>) => {
      for (const r of rows) insVerse.run(trans, bookNum, chapter, r.verse, r.text)
    }
  )

  const bookLimit = Number(process.env.BORN_BIBLE_LIMIT) || 66
  const CONCURRENCY = 8

  for (const t of TRANSLATIONS) {
    let verses = 0
    for (let b = 0; b < bookLimit; b++) {
      const bookNum = b + 1
      const chapters = CHAPTER_COUNTS[b]
      for (let start = 1; start <= chapters; start += CONCURRENCY) {
        const batch = Array.from(
          { length: Math.min(CONCURRENCY, chapters - start + 1) },
          (_, i) => start + i
        )
        const results = await Promise.all(batch.map((c) => fetchChapter(t.bolls, bookNum, c)))
        batch.forEach((c, i) => {
          insertChapter(t.code, bookNum, c, results[i])
          verses += results[i].length
        })
      }
      process.stdout.write(`\r  ${t.code}: ${BIBLE_BOOKS[b].name.padEnd(16)} (${verses} verses)   `)
    }
    process.stdout.write('\n')
  }
}

function buildSongs(db: Database.Database): void {
  const srcDir = join(OUT_DIR, 'songs-source', 'Songs')
  let files: string[]
  try {
    files = readdirSync(srcDir).filter(
      (f) => !f.startsWith('._') && /\.(pro|pro7|xml|cho|crd|chordpro|txt)$/i.test(f)
    )
  } catch {
    console.warn(`songs: ${srcDir} not found — skipping bundled song library`)
    return
  }
  let ok = 0
  let failed = 0
  const insertMany = db.transaction((rows: Array<{ f: string }>) => {
    for (const { f } of rows) {
      const r = parseSong(f, readFileSync(join(srcDir, f)))
      if ('error' in r) {
        failed++
        continue
      }
      insertSong(db, r.song, 'bundled', `bundled:${f}`)
      ok++
    }
  })
  insertMany(files.map((f) => ({ f })))
  console.log(`songs: bundled ${ok}, skipped ${failed} (of ${files.length})`)
  if (files.length > 0 && failed / files.length > 0.05) {
    throw new Error(`too many song parse failures (${failed}/${files.length})`)
  }
}

const BIBLE_CACHE = join(OUT_DIR, 'bible-cache.db')

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  if (existsSync(TMP_DB)) rmSync(TMP_DB)

  // Reuse a previously-fetched Bible when only the song parser changed
  // (BORN_REUSE_BIBLE=1). Otherwise fetch fresh and refresh the cache.
  const reuse = process.env.BORN_REUSE_BIBLE === '1' && existsSync(BIBLE_CACHE)
  if (reuse) {
    console.log(`reusing cached Bible from ${BIBLE_CACHE}`)
    writeFileSync(TMP_DB, readFileSync(BIBLE_CACHE))
  }
  const db = new Database(TMP_DB)
  db.pragma('journal_mode = WAL')
  initLibrarySchema(db)

  if (!reuse) {
    console.log('building Bible (KJV, WEB, ASV) from bolls.life …')
    await buildBible(db)
    db.pragma('wal_checkpoint(TRUNCATE)')
    writeFileSync(BIBLE_CACHE, readFileSync(TMP_DB))
  }

  console.log('building song library from resources/songs-source …')
  db.exec('DELETE FROM songs')
  buildSongs(db)

  console.log('optimising …')
  db.exec("INSERT INTO bible_verses_fts(bible_verses_fts) VALUES('optimize')")
  db.exec("INSERT INTO songs_fts(songs_fts) VALUES('optimize')")
  db.pragma('wal_checkpoint(TRUNCATE)')
  db.exec('VACUUM')

  const vCount = (db.prepare('SELECT COUNT(*) n FROM bible_verses').get() as { n: number }).n
  db.close()
  console.log(`built: ${vCount} verses`)
  if (!process.env.BORN_BIBLE_LIMIT && vCount < 90000) {
    throw new Error(`only ${vCount} verses — expected ~93000; not shipping this library`)
  }

  const raw = readFileSync(TMP_DB)
  const gz = gzipSync(raw, { level: 9 })
  writeFileSync(OUT_GZ + '.tmp', gz)
  renameSync(OUT_GZ + '.tmp', OUT_GZ) // atomic — a reader never sees a partial file
  rmSync(TMP_DB)
  for (const s of ['-wal', '-shm']) if (existsSync(TMP_DB + s)) rmSync(TMP_DB + s)
  console.log(
    `wrote ${OUT_GZ} — ${(gz.length / 1e6).toFixed(1)} MB gz (${(raw.length / 1e6).toFixed(1)} MB raw)`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
