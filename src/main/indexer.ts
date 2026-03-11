import type { BrowserWindow } from 'electron'
import { getDb } from './db'
import { fetchSermonList, fetchSermonContent } from './tableApi'
import { log } from './logger'

const BATCH_SIZE = 5

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
 * Only runs when the table is empty (first run or fresh DB).
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
      for (const e of entries) {
        insert.run(e.i, e.p, e.t, e.c, e.m, e.ct === 'B' ? 1 : 0)
      }
    })
    tx()
  }

  // Return all IDs from the authoritative list
  return db
    .prepare<[], { id: number }>('SELECT id FROM sermon_index ORDER BY id')
    .all()
    .map((r) => r.id)
}

// ── Main indexer ──────────────────────────────────────────────────────────────

export async function startIndexer(win: BrowserWindow): Promise<void> {
  if (running) {
    log.info('startIndexer called but already running — skipping')
    return
  }
  running = true
  shouldStop = false
  log.info('indexer starting')

  const db = getDb()

  const ids = await ensureSermonIndex()
  if (ids.length === 0) {
    log.warn('indexer: no sermon IDs found — aborting')
    running = false
    return
  }
  log.info(`indexer: ${ids.length} total sermons in index`)

  const total = ids.length
  let indexed = 0
  let errors = 0
  let scanned = 0

  const stmtHas = db.prepare<[number], { n: number }>(
    'SELECT COUNT(*) as n FROM sermons WHERE id = ?'
  )
  const stmtInsertSermon = db.prepare(
    'INSERT OR IGNORE INTO sermons (id, date_code, title, total_sections) VALUES (?, ?, ?, ?)'
  )
  const stmtInsertParagraph = db.prepare(
    'INSERT INTO paragraphs (sermon_id, paragraph_ref, paragraph_index, text) VALUES (?, ?, ?, ?)'
  )

  const insertTx = db.transaction(
    (id: number, data: { dateCode: string; title: string; totalSections: number; sections: { ref: string; index: number; text: string }[] }) => {
      stmtInsertSermon.run(id, data.dateCode, data.title, data.totalSections)
      for (const s of data.sections) {
        stmtInsertParagraph.run(id, s.ref, s.index, s.text)
      }
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
        const data = await fetchSermonContent(id, 'en')
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
  const total = totalRow?.n > 0 ? totalRow.n : 1218
  const indexedRow = db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM sermons').get()!
  const indexed = indexedRow.n
  return {
    status: running ? 'running' : 'idle',
    scanned: indexed,
    total,
    indexed,
    errors: 0
  }
}
