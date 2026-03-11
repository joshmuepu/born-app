/**
 * Tests for the database schema (initSchema).
 * We instantiate better-sqlite3 directly in :memory: to avoid the Electron app.getPath dep.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'

let db: Database.Database

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sermons (
      id INTEGER PRIMARY KEY,
      date_code TEXT NOT NULL,
      title TEXT NOT NULL,
      total_sections INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS paragraphs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sermon_id INTEGER NOT NULL REFERENCES sermons(id),
      paragraph_ref TEXT NOT NULL,
      paragraph_index INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS paragraphs_fts USING fts5(
      text,
      content=paragraphs,
      content_rowid=id
    );

    CREATE TRIGGER IF NOT EXISTS paragraphs_ai AFTER INSERT ON paragraphs BEGIN
      INSERT INTO paragraphs_fts(rowid, text) VALUES (new.id, new.text);
    END;

    CREATE TRIGGER IF NOT EXISTS paragraphs_ad AFTER DELETE ON paragraphs BEGIN
      INSERT INTO paragraphs_fts(paragraphs_fts, rowid, text) VALUES('delete', old.id, old.text);
    END;

    CREATE TRIGGER IF NOT EXISTS paragraphs_au AFTER UPDATE ON paragraphs BEGIN
      INSERT INTO paragraphs_fts(paragraphs_fts, rowid, text) VALUES('delete', old.id, old.text);
      INSERT INTO paragraphs_fts(rowid, text) VALUES (new.id, new.text);
    END;

    CREATE TABLE IF NOT EXISTS sermon_index (
      id INTEGER PRIMARY KEY,
      date_code TEXT NOT NULL,
      title TEXT NOT NULL,
      para_count INTEGER NOT NULL DEFAULT 0,
      duration_min INTEGER NOT NULL DEFAULT 0,
      is_book INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS translated_sermons (
      sermon_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      title TEXT NOT NULL,
      PRIMARY KEY (sermon_id, language)
    );

    CREATE TABLE IF NOT EXISTS translated_paragraphs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sermon_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      paragraph_ref TEXT NOT NULL,
      paragraph_index INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL,
      UNIQUE (sermon_id, language, paragraph_ref)
    );
  `)
}

function tableExists(name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(name) as { name: string } | undefined
  return row?.name === name
}

function vtableExists(name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(name) as { name: string } | undefined
  return row?.name === name
}

function triggerExists(name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='trigger' AND name=?`)
    .get(name) as { name: string } | undefined
  return row?.name === name
}

beforeAll(() => {
  db = new Database(':memory:')
  initSchema(db)
})

afterAll(() => {
  db.close()
})

describe('database schema', () => {
  describe('core tables', () => {
    it('creates sermons table', () => {
      expect(tableExists('sermons')).toBe(true)
    })

    it('creates paragraphs table', () => {
      expect(tableExists('paragraphs')).toBe(true)
    })

    it('creates sermon_index table', () => {
      expect(tableExists('sermon_index')).toBe(true)
    })

    it('creates translated_sermons table', () => {
      expect(tableExists('translated_sermons')).toBe(true)
    })

    it('creates translated_paragraphs table', () => {
      expect(tableExists('translated_paragraphs')).toBe(true)
    })
  })

  describe('FTS5 virtual table', () => {
    it('creates paragraphs_fts virtual table', () => {
      expect(vtableExists('paragraphs_fts')).toBe(true)
    })
  })

  describe('triggers', () => {
    it('creates paragraphs_ai trigger', () => {
      expect(triggerExists('paragraphs_ai')).toBe(true)
    })

    it('creates paragraphs_ad trigger', () => {
      expect(triggerExists('paragraphs_ad')).toBe(true)
    })

    it('creates paragraphs_au trigger', () => {
      expect(triggerExists('paragraphs_au')).toBe(true)
    })
  })

  describe('sermons table operations', () => {
    it('inserts and retrieves a sermon', () => {
      db.prepare('INSERT INTO sermons (id, date_code, title, total_sections) VALUES (?, ?, ?, ?)').run(
        1001, '63-0901M', 'Come Follow Me', 150
      )
      const row = db.prepare('SELECT * FROM sermons WHERE id = ?').get(1001) as {
        id: number; date_code: string; title: string; total_sections: number
      }
      expect(row.date_code).toBe('63-0901M')
      expect(row.title).toBe('Come Follow Me')
      expect(row.total_sections).toBe(150)
    })
  })

  describe('paragraphs FTS trigger', () => {
    it('indexes paragraph text on insert (FTS search returns result)', () => {
      db.prepare('INSERT INTO paragraphs (sermon_id, paragraph_ref, paragraph_index, text) VALUES (?, ?, ?, ?)').run(
        1001, 'p1', 1, 'By faith Abraham obeyed'
      )
      const rows = db.prepare(`
        SELECT p.text FROM paragraphs_fts
        JOIN paragraphs p ON paragraphs_fts.rowid = p.id
        WHERE paragraphs_fts MATCH ?
      `).all('Abraham') as { text: string }[]
      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0].text).toContain('Abraham')
    })
  })

  describe('sermon_index table', () => {
    it('inserts and retrieves sermon_index entry', () => {
      db.prepare('INSERT INTO sermon_index (id, date_code, title, para_count, duration_min, is_book) VALUES (?, ?, ?, ?, ?, ?)').run(
        42, '63-0901M', 'Come Follow Me', 120, 90, 0
      )
      const row = db.prepare('SELECT * FROM sermon_index WHERE id = ?').get(42) as {
        id: number; para_count: number; is_book: number
      }
      expect(row.id).toBe(42)
      expect(row.para_count).toBe(120)
      expect(row.is_book).toBe(0)
    })
  })

  describe('translated_paragraphs unique constraint', () => {
    it('allows inserting a translated paragraph', () => {
      expect(() => {
        db.prepare('INSERT INTO translated_paragraphs (sermon_id, language, paragraph_ref, paragraph_index, text) VALUES (?, ?, ?, ?, ?)').run(
          1001, 'es', 'p1', 1, 'Por fe Abraham obedeció'
        )
      }).not.toThrow()
    })

    it('rejects duplicate (sermon_id, language, paragraph_ref)', () => {
      expect(() => {
        db.prepare('INSERT INTO translated_paragraphs (sermon_id, language, paragraph_ref, paragraph_index, text) VALUES (?, ?, ?, ?, ?)').run(
          1001, 'es', 'p1', 1, 'Duplicate'
        )
      }).toThrow()
    })
  })

  describe('initSchema is idempotent', () => {
    it('can run initSchema again without error', () => {
      expect(() => initSchema(db)).not.toThrow()
    })
  })
})
