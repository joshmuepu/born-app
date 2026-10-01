/**
 * build-sermon-db.ts — generate the prebuilt sermon database shipped with the app.
 *
 *   node --experimental-strip-types scripts/build-sermon-db.ts
 *   (Node 22.6+; on Node 23.6+ the flag is unnecessary)
 *
 * Produces resources/sermons.db.gz. electron-builder ships it via `extraResources`
 * and the app inflates it into userData on first launch (see src/main/db.ts).
 */
import Database from 'better-sqlite3'
import { gzipSync } from 'node:zlib'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initSchema } from '../src/main/schema'
import { fetchSermonList, fetchSermonContent } from '../src/main/tableApi'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'resources')
const TMP_DB = join(OUT_DIR, 'sermons.build.db')
const OUT_GZ = join(OUT_DIR, 'sermons.db.gz')
const CONCURRENCY = 6

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  if (existsSync(TMP_DB)) rmSync(TMP_DB)

  const db = new Database(TMP_DB)
  db.pragma('journal_mode = WAL')
  initSchema(db)

  console.log('fetching sermon list…')
  const entries = await fetchSermonList()
  if (entries.length === 0) throw new Error('allSermons returned nothing — aborting')
  console.log(`  ${entries.length} sermons`)

  const insertIndex = db.prepare(
    'INSERT OR IGNORE INTO sermon_index (id, date_code, title, para_count, duration_min, is_book) VALUES (?, ?, ?, ?, ?, ?)'
  )
  db.transaction(() => {
    // Coalesce every NOT-NULL-constrained field defensively, not just the
    // ones already seen to go missing — found live, a brand-new upstream
    // sermon (62-1030X) came back from allSermons with no `m` (duration)
    // field at all, and INSERT OR IGNORE silently no-ops on an undefined
    // bind for a NOT NULL column instead of throwing, which is
    // indistinguishable from "already present" unless you go looking.
    for (const e of entries) {
      insertIndex.run(e.i, e.p ?? '', e.t ?? '', e.c ?? 0, e.m ?? 0, e.ct === 'B' ? 1 : 0)
    }
  })()

  const insertSermon = db.prepare(
    'INSERT OR IGNORE INTO sermons (id, date_code, title, total_sections) VALUES (?, ?, ?, ?)'
  )
  const insertParagraph = db.prepare(
    'INSERT INTO paragraphs (sermon_id, paragraph_ref, paragraph_index, text) VALUES (?, ?, ?, ?)'
  )
  // See indexer.ts's stmtFixParaCount comment — the source's own para_count
  // is unreliable for book chapters; correct it to the real, fetched count.
  const fixParaCount = db.prepare('UPDATE sermon_index SET para_count = ? WHERE id = ?')
  const insertOne = db.transaction(
    (id: number, data: Awaited<ReturnType<typeof fetchSermonContent>>) => {
      if (!data) return
      insertSermon.run(id, data.dateCode, data.title, data.totalSections)
      for (const s of data.sections) insertParagraph.run(id, s.ref, s.index, s.text)
      fixParaCount.run(data.totalSections, id)
    }
  )

  // BORN_DB_LIMIT caps the number of sermons fetched — for a fast smoke test only.
  const limit = Number(process.env.BORN_DB_LIMIT) || entries.length
  const ids = entries.map((e) => e.i).slice(0, limit)
  const bookIds = new Set(entries.filter((e) => e.ct === 'B').map((e) => e.i))
  let done = 0
  let errors = 0
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map((id) => fetchSermonContent(id, 'en', bookIds.has(id))))
    batch.forEach((id, j) => {
      const data = results[j]
      if (data) insertOne(id, data)
      else errors++
    })
    done += batch.length
    if (done % 60 === 0 || done === ids.length) {
      process.stdout.write(`\r  indexed ${done}/${ids.length} (${errors} errors)`)
    }
  }
  process.stdout.write('\n')

  console.log('optimising (VACUUM + FTS optimize)…')
  db.exec("INSERT INTO paragraphs_fts(paragraphs_fts) VALUES('optimize')")
  db.pragma('wal_checkpoint(TRUNCATE)')
  db.exec('VACUUM')

  const paraCount = db.prepare('SELECT COUNT(*) n FROM paragraphs').get() as { n: number }
  const sermonCount = db.prepare('SELECT COUNT(*) n FROM sermons').get() as { n: number }
  db.close()

  console.log(`built: ${sermonCount.n} sermons, ${paraCount.n} paragraph rows`)

  const { readFileSync } = await import('node:fs')
  const raw = readFileSync(TMP_DB)
  const gz = gzipSync(raw, { level: 9 })
  writeFileSync(OUT_GZ, gz)
  rmSync(TMP_DB)
  for (const suffix of ['-wal', '-shm']) {
    if (existsSync(TMP_DB + suffix)) rmSync(TMP_DB + suffix)
  }
  console.log(
    `wrote ${OUT_GZ} — ${(gz.length / 1e6).toFixed(1)} MB gzipped (${(raw.length / 1e6).toFixed(1)} MB raw)`
  )

  if (errors > ids.length * 0.05) {
    throw new Error(`too many fetch errors (${errors}/${ids.length}) — not shipping this DB`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
