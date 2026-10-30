import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema } from '../../main/schema'

// a sermon fetched online by the in-app indexer is stored the way the bundled library is: one row per numbered paragraph
const mem = new Database(':memory:')
initSchema(mem)
vi.mock('../../main/db', () => ({ getDb: () => mem }))
vi.mock('../../main/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { startIndexer } from '../../main/indexer'

const P = (n: number | null, w: string): string => `<p class="normal_pn"><span class="first st">${n !== null ? `<span class="pn">${n}</span> ` : ''}${w}</span></p>`

beforeEach(() => {
  mem.exec('DELETE FROM paragraphs; DELETE FROM sermons; DELETE FROM sermon_index;')
  // two sermons in the index; the first already stored (bundled), the second only online
  mem.prepare("INSERT INTO sermon_index (id, date_code, title, para_count, duration_min, is_book) VALUES (1, '99-0101M', 'Bundled', 1, 1, 0), (2, '99-0202E', 'Online Only', 3, 1, 0)").run()
  mem.prepare("INSERT INTO sermons (id, date_code, title, total_sections) VALUES (1, '99-0101M', 'Bundled', 1)").run()
  global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ Status: 'Successful', Result: { DateCode: '99-0202E', Title: 'Online Only', TotalSections: 2, Sections: [{ Paragraph: 'header', Content: '<p>Online Only 99-0202E</p>' }, { Paragraph: '1-3', Content: P(null, 'Opening.') + P(2, 'Two.') + P(3, 'Three.') }] } }) })) as never
})

describe('the in-app indexer', () => {
  it('stores a sermon fetched online as one row per numbered paragraph', async () => {
    const win = { isDestroyed: () => false, webContents: { send: vi.fn() } }
    await startIndexer(win as never)
    const refs = mem.prepare('SELECT paragraph_ref FROM paragraphs WHERE sermon_id = 2 ORDER BY paragraph_index').all().map((r) => (r as { paragraph_ref: string }).paragraph_ref)
    expect(refs).toEqual(['header', '1', '2', '3'])
  })
})
