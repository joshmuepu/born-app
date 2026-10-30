import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema } from '../../main/schema'

// "Refresh sermons" re-fetches the book chapters. It deleted them first and fetched after, so a refresh with no internet (or a fetch that
// failed) removed them from search until a later refresh worked. And any error during a run left the indexer marked "running" for good,
// so every later start (and Refresh) was skipped.
const mem = new Database(':memory:')
initSchema(mem)
vi.mock('../../main/db', () => ({ getDb: () => mem }))
vi.mock('../../main/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { startIndexer, getIndexerStatus } from '../../main/indexer'

const win = { isDestroyed: () => false, webContents: { send: vi.fn() } }
beforeEach(() => {
  mem.exec('DELETE FROM paragraphs; DELETE FROM sermons; DELETE FROM sermon_index;')
  mem.prepare("INSERT INTO sermon_index (id, date_code, title, para_count, duration_min, is_book) VALUES (1, '99-0101M', 'A Sermon', 1, 1, 0), (900, 'BOOK-01', 'A Book Chapter', 2, 1, 1)").run()
  mem.prepare("INSERT INTO sermons (id, date_code, title, total_sections) VALUES (1, '99-0101M', 'A Sermon', 1), (900, 'BOOK-01', 'A Book Chapter', 2)").run()
  mem.prepare("INSERT INTO paragraphs (sermon_id, paragraph_ref, paragraph_index, text) VALUES (900, '1', 0, 'Placeholder one.'), (900, '2', 1, 'Placeholder two.')").run()
})

describe('Refresh sermons with no internet', () => {
  it('keeps the book chapters', async () => {
    global.fetch = vi.fn(async () => { throw new TypeError('fetch failed') }) as never
    await startIndexer(win as never, true)
    expect(mem.prepare('SELECT COUNT(*) AS n FROM paragraphs WHERE sermon_id = 900').get()).toEqual({ n: 2 })
    expect(mem.prepare('SELECT COUNT(*) AS n FROM sermons WHERE id = 900').get()).toEqual({ n: 1 })
  })
})

describe('an error during a run', () => {
  it('does not leave the indexer marked as running', async () => {
    global.fetch = vi.fn(async () => { throw new TypeError('fetch failed') }) as never
    const spy = vi.spyOn(mem, 'prepare').mockImplementationOnce(() => { throw new Error('SQLITE_FULL: database or disk is full') })
    await startIndexer(win as never).catch(() => {})
    spy.mockRestore()
    expect(getIndexerStatus().status).not.toBe('running')
  })
})
