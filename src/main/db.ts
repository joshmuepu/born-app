import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = join(app.getPath('userData'), 'sermons.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    initSchema(db)
  }
  return db
}

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

    -- Authoritative sermon list fetched from allSermons endpoint.
    -- Drives the indexer instead of the old ID-range guess.
    CREATE TABLE IF NOT EXISTS sermon_index (
      id INTEGER PRIMARY KEY,   -- SermonProductIdentityId
      date_code TEXT NOT NULL,
      title TEXT NOT NULL,
      para_count INTEGER NOT NULL DEFAULT 0,
      duration_min INTEGER NOT NULL DEFAULT 0,
      is_book INTEGER NOT NULL DEFAULT 0  -- 1 when ct='B'
    );

    -- Translated sermon content cache (language != 'en').
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

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
