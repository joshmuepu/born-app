import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { rowToQuote, SEARCH_BASE, type QuoteRow } from '../../main/search'
import { highlightToHtml } from '../../shared/searchHighlight'

// Synthetic sermon: the real source puts U+F6E1 at the start of many paragraphs. The cleanup must change what is SHOWN
// (search results, the reader, the projector) and nothing that is stored or indexed.
const PUA = ''
const STORED = [`${PUA} Let us bow our heads in prayer.`, 'A paragraph that never had the symbol.', `Mid ${PUA} symbol here about prayer.`]

let dir: string
let path: string
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'born-src-'))
  path = join(dir, 'sermons.db')
  const db = new Database(path)
  db.exec(`
    CREATE TABLE sermons (id INTEGER PRIMARY KEY, date_code TEXT, title TEXT);
    CREATE TABLE paragraphs (id INTEGER PRIMARY KEY, sermon_id INTEGER, paragraph_ref TEXT, paragraph_index INTEGER, text TEXT);
    CREATE VIRTUAL TABLE paragraphs_fts USING fts5(text, content='paragraphs', content_rowid='id');
    INSERT INTO sermons VALUES (1, '00-0101', 'Test Sermon');
  `)
  STORED.forEach((t, i) => db.prepare('INSERT INTO paragraphs VALUES (?,?,?,?,?)').run(i + 1, 1, String(i + 1), i, t))
  db.exec(`INSERT INTO paragraphs_fts(rowid, text) SELECT id, text FROM paragraphs`)
  db.close()
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const rawRows = (db: Database.Database): string[] => (db.prepare('SELECT text FROM paragraphs ORDER BY id').all() as { text: string }[]).map((r) => r.text)

describe('the private-use symbol is hidden from what is shown, never from what is stored', () => {
  it('a search result shows clean text, while the database keeps every character exactly as it was', () => {
    const db = new Database(path, { readonly: true }) // a read-only handle: any write would throw
    const hits = db.prepare<[string], QuoteRow>(SEARCH_BASE + ' ORDER BY p.id').all('prayer')
    expect(hits).toHaveLength(2)
    const shown = hits.map((h) => rowToQuote(h, 'all').text)
    expect(shown).toEqual(['Let us bow our heads in prayer.', 'Mid symbol here about prayer.'])
    expect(shown.join('')).not.toContain(PUA)
    // stored text: byte-for-byte what was put in
    expect(rawRows(db)).toEqual(STORED)
    // the search index still holds the original text too
    expect((db.prepare(`SELECT text FROM paragraphs_fts WHERE paragraphs_fts MATCH 'bow'`).all() as unknown[]).length).toBe(1)
    db.close()
  })
  it('searching finds the same paragraphs with or without the cleanup (it does not change what matches)', () => {
    const db = new Database(path, { readonly: true })
    const ids = (q: string): number[] => (db.prepare<[string], QuoteRow>(SEARCH_BASE + ' ORDER BY p.id').all(q)).map((r) => r.paragraphId)
    expect(ids('prayer')).toEqual([1, 3])
    expect(ids('never')).toEqual([2])
    db.close()
  })
  it('a paragraph that never had the symbol is shown exactly as stored', () => {
    const db = new Database(path, { readonly: true })
    const row = db.prepare<[string], QuoteRow>(SEARCH_BASE).all('never')[0]
    expect(rowToQuote(row, 'all').text).toBe(row.text)
    db.close()
  })
  it('the searched word is still highlighted in the clean text', () => {
    const db = new Database(path, { readonly: true })
    const row = db.prepare<[string], QuoteRow>(SEARCH_BASE).all('bow')[0]
    const shown = rowToQuote(row, 'all').text
    expect(highlightToHtml(shown, 'bow', 'all')).toMatch(/<mark class="hl">bow<\/mark>/)
    expect(highlightToHtml(shown, 'bow', 'all').startsWith('Let us')).toBe(true) // no empty box in front
    db.close()
  })
})
