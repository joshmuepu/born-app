import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { buildSearchSQL } from '../../main/search'

// every sermon opens with a title line (ref "header": title, code and place). Synthetic placeholder text.
let db: Database.Database
beforeAll(() => {
  db = new Database(':memory:')
  db.exec(`CREATE TABLE sermons (id INTEGER PRIMARY KEY, title TEXT, date_code TEXT);
    CREATE TABLE paragraphs (id INTEGER PRIMARY KEY AUTOINCREMENT, sermon_id INTEGER, paragraph_ref TEXT, paragraph_index INTEGER, text TEXT);
    CREATE VIRTUAL TABLE paragraphs_fts USING fts5(text, content=paragraphs, content_rowid=id);`)
  db.prepare('INSERT INTO sermons VALUES (?,?,?)').run(1, 'A Sample Message', '99-0101M')
  const ip = db.prepare('INSERT INTO paragraphs (sermon_id, paragraph_ref, paragraph_index, text) VALUES (?,?,?,?)')
  ip.run(1, 'header', 0, 'A Sample Message 99-0101M Springfield Somewhere U.S.A.')
  ip.run(1, '1', 1, '1 We came to Springfield to speak of the river.')
  db.exec('INSERT INTO paragraphs_fts(rowid, text) SELECT id, text FROM paragraphs')
})
afterAll(() => db.close())

describe('a sermon\'s title line is not a paragraph result', () => {
  it('searching a place finds the paragraphs that speak of it, not every sermon\'s title line', () => {
    const { sql, extraParams } = buildSearchSQL({})
    const rows = db.prepare(sql).all('"springfield"', ...extraParams, 100) as Array<{ paragraphRef: string }>
    expect(rows.map((r) => r.paragraphRef)).toEqual(['1'])
  })
})

describe('a word with a hyphen or an apostrophe, and a search only a title line can answer', () => {
  it('a typed word like 99-0101M or don\'t no longer breaks the search', async () => {
    const { buildTokenQuery, buildAnyWordQuery } = await import('../../main/search')
    const { sql, extraParams } = buildSearchSQL({})
    for (const q of ['99-0101M', "don't", 'river NOT', 'well-known river']) {
      expect(() => db.prepare(sql).all(buildTokenQuery(q), ...extraParams, 100)).not.toThrow()
      expect(() => db.prepare(sql).all(buildAnyWordQuery(q), ...extraParams, 100)).not.toThrow()
    }
  })
  it('searching a sermon code finds the sermon\'s title line when no paragraph has those words', async () => {
    const { buildTokenQuery } = await import('../../main/search')
    const t = buildSearchSQL({}, { titleLines: true })
    const rows = db.prepare(t.sql).all(buildTokenQuery('99-0101M'), ...t.extraParams, 100) as Array<{ paragraphRef: string }>
    expect(rows.map((r) => r.paragraphRef)).toEqual(['header'])
  })
})
