import type { BrowserWindow } from 'electron'
import { getDb } from './db'
import { fetchSermonList, fetchSermonContent, type SermonIndexEntry } from './tableApi'
import { log } from './logger'

const BATCH_SIZE = 5

/** sermon_index row values for one allSermons entry — coalescing every
 *  NOT-NULL-constrained field defensively, not just the ones already seen
 *  to go missing. Found live: a brand-new upstream sermon (62-1030X,
 *  "Vision From The Lord") came back from allSermons with no `m` (duration)
 *  field at all. INSERT OR IGNORE binding that `undefined` straight through
 *  doesn't throw — it silently no-ops the whole row (violates duration_min
 *  NOT NULL), which is indistinguishable from "already present" unless you
 *  go looking. One missing, cosmetic field from the source was silently
 *  blocking that sermon from ever being indexed at all, first run or any
 *  later refresh. */
export function sermonIndexRow(e: SermonIndexEntry): [number, string, string, number, number, number] {
  return [e.i, e.p ?? '', e.t ?? '', e.c ?? 0, e.m ?? 0, e.ct === 'B' ? 1 : 0]
}

export interface IndexerProgress {
  status: 'idle' | 'running' | 'done'
  scanned: number
  total: number
  indexed: number
  errors: number
}

let running = false
let shouldStop = false

// ── Sermon-index bootstrap ────────────────────────────────────────────────────

/**
 * Populates sermon_index from the authoritative allSermons endpoint.
 * Only runs when the table is empty (first run or fresh DB) — the routine,
 * automatic "index on launch" path uses this, and deliberately stays cheap
 * (no network call at all once the table has anything in it).
 */
async function ensureSermonIndex(): Promise<number[]> {
  const db = getDb()
  const count = (db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM sermon_index').get()?.n ?? 0)

  if (count === 0) {
    log.info('sermon_index empty — fetching allSermons from API')
    const entries = await fetchSermonList()
    log.info(`allSermons returned ${entries.length} entries`)
    if (entries.length === 0) return []
    const insert = db.prepare(
      'INSERT OR IGNORE INTO sermon_index (id, date_code, title, para_count, duration_min, is_book) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const tx = db.transaction(() => {
      for (const e of entries) insert.run(...sermonIndexRow(e))
    })
    tx()
  }

  // Return all IDs from the authoritative list
  return db
    .prepare<[], { id: number }>('SELECT id FROM sermon_index ORDER BY id')
    .all()
    .map((r) => r.id)
}

/**
 * The explicit, user-triggered "Refresh" action — unlike ensureSermonIndex()
 * above, this always re-fetches allSermons, live, regardless of whether the
 * table already has entries. The source adds sermons over time (e.g.
 * "Vision From The Lord", 62-1030X, appeared on table.branham.org after this
 * app's local index was first built) — without an explicit refresh path,
 * those never surface locally on an existing install, with nothing telling
 * the operator anything was even missing. New entries are added via INSERT
 * OR IGNORE, so nothing already-correct locally gets touched.
 */
async function refreshSermonIndex(): Promise<{ added: number; total: number }> {
  const db = getDb()
  const entries = await fetchSermonList()
  if (entries.length === 0) {
    log.warn('refreshSermonIndex: allSermons returned nothing (offline?) — keeping the existing local index')
    const total = db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM sermon_index').get()?.n ?? 0
    return { added: 0, total }
  }
  const before = db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM sermon_index').get()?.n ?? 0
  const insert = db.prepare(
    'INSERT OR IGNORE INTO sermon_index (id, date_code, title, para_count, duration_min, is_book) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const tx = db.transaction(() => {
    for (const e of entries) insert.run(...sermonIndexRow(e))
  })
  tx()
  const after = db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM sermon_index').get()?.n ?? 0
  const added = after - before
  log.info(`refreshSermonIndex: ${added} new entr${added === 1 ? 'y' : 'ies'} (of ${entries.length} in the source's own list)`)
  return { added, total: entries.length }
}

// ── Main indexer ──────────────────────────────────────────────────────────────

export async function startIndexer(win: BrowserWindow, forceRefresh = false): Promise<void> {
  if (running) {
    log.info('startIndexer called but already running — skipping')
    return
  }
  running = true
  shouldStop = false
  log.info(`indexer starting${forceRefresh ? ' (forced refresh)' : ''}`)

  const db = getDb()

  if (forceRefresh) {
    const { added } = await refreshSermonIndex()
    // Book-chapter content specifically is worth re-pulling on every manual
    // refresh, not just when new sermons show up: it's a fixed set of 11
    // rows (cheap either way) whose parsing (mergeHeadingSections, see
    // tableApi.ts) can improve independently of anything changing upstream.
    // Deleting first makes the normal "not yet indexed" check below re-fetch
    // them fresh rather than skipping them as already-present.
    const bookIds = db
      .prepare<[], { id: number }>('SELECT id FROM sermon_index WHERE is_book = 1')
      .all()
      .map((r) => r.id)
    if (bookIds.length > 0) {
      const placeholders = bookIds.map(() => '?').join(',')
      db.transaction(() => {
        db.prepare(`DELETE FROM paragraphs WHERE sermon_id IN (${placeholders})`).run(...bookIds)
        db.prepare(`DELETE FROM sermons WHERE id IN (${placeholders})`).run(...bookIds)
      })()
      log.info(`indexer: cleared ${bookIds.length} book-chapter entries for re-fetch`)
    }
    log.info(`indexer: refresh found ${added} new sermon(s)`)
  }

  const ids = await ensureSermonIndex()
  if (ids.length === 0) {
    log.warn('indexer: no sermon IDs found — aborting')
    running = false
    return
  }
  log.info(`indexer: ${ids.length} total sermons in index`)

  // Fast path: everything is already indexed (e.g. shipped DB). Don't re-scan.
  const haveCount =
    db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM sermons').get()?.n ?? 0
  if (haveCount >= ids.length) {
    log.info(`indexer: already complete (${haveCount}/${ids.length}) — nothing to do`)
    running = false
    if (!win.isDestroyed()) {
      win.webContents.send('indexer:progress', {
        status: 'done',
        scanned: haveCount,
        total: ids.length,
        indexed: haveCount,
        errors: 0
      } satisfies IndexerProgress)
    }
    return
  }

  const total = ids.length
  let indexed = 0
  let errors = 0
  let scanned = 0

  const bookIdSet = new Set(
    db.prepare<[], { id: number }>('SELECT id FROM sermon_index WHERE is_book = 1').all().map((r) => r.id)
  )
  const stmtHas = db.prepare<[number], { n: number }>(
    'SELECT COUNT(*) as n FROM sermons WHERE id = ?'
  )
  const stmtInsertSermon = db.prepare(
    'INSERT OR IGNORE INTO sermons (id, date_code, title, total_sections) VALUES (?, ?, ?, ?)'
  )
  const stmtInsertParagraph = db.prepare(
    'INSERT INTO paragraphs (sermon_id, paragraph_ref, paragraph_index, text) VALUES (?, ?, ?, ?)'
  )
  // sermon_index.para_count comes from the source's own allSermons listing,
  // which is unreliable for book chapters (reports 1 for chapters that
  // actually have 44-184 real paragraphs once fetched — see tableApi.ts).
  // Correct it here to the real, fetched count, now that we know it —
  // nothing currently displays this field, but it should be right at rest
  // rather than a permanently-wrong cached value waiting to mislead
  // whatever reads it next.
  const stmtFixParaCount = db.prepare('UPDATE sermon_index SET para_count = ? WHERE id = ?')

  const insertTx = db.transaction(
    (id: number, data: { dateCode: string; title: string; totalSections: number; sections: { ref: string; index: number; text: string }[] }) => {
      stmtInsertSermon.run(id, data.dateCode, data.title, data.totalSections)
      for (const s of data.sections) {
        stmtInsertParagraph.run(id, s.ref, s.index, s.text)
      }
      stmtFixParaCount.run(data.totalSections, id)
    }
  )

  const sendProgress = (status: IndexerProgress['status'] = 'running'): void => {
    if (!win.isDestroyed()) {
      win.webContents.send('indexer:progress', {
        status,
        scanned,
        total,
        indexed,
        errors
      } satisfies IndexerProgress)
    }
  }

  for (let i = 0; i < ids.length && !shouldStop; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (id) => {
        const already = (stmtHas.get(id)?.n ?? 0) > 0
        scanned++
        if (already) {
          indexed++
          return
        }
        const data = await fetchSermonContent(id, 'en', bookIdSet.has(id))
        if (data) {
          insertTx(id, data)
          indexed++
        } else {
          errors++
        }
      })
    )

    sendProgress()
  }

  running = false
  log.info(`indexer done: indexed=${indexed} errors=${errors} scanned=${scanned} total=${total}`)
  sendProgress(shouldStop ? 'idle' : 'done')
}

export function stopIndexer(): void {
  shouldStop = true
}

export function getIndexerStatus(): IndexerProgress {
  const db = getDb()
  // Total = sermon_index size if available, else 1218 (the known true count)
  const totalRow = db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM sermon_index').get()
  const total = totalRow && totalRow.n > 0 ? totalRow.n : 1218
  const indexedRow = db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM sermons').get()
  const indexed = indexedRow?.n ?? 0
  const status: IndexerProgress['status'] = running
    ? 'running'
    : indexed >= total
      ? 'done'
      : 'idle'
  return { status, scanned: indexed, total, indexed, errors: 0 }
}
