/**
 * librarySchema.ts — schema for library.db (bundled Bible + songs, plus songs
 * the operator imports at runtime). Kept Electron-free for the build script and
 * unit tests.
 */
import type { Database } from 'better-sqlite3'

export const LIBRARY_SCHEMA_SQL = `
  -- ── Bible ──────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS bible_translations (
    code TEXT PRIMARY KEY,     -- 'KJV'
    name TEXT NOT NULL,        -- 'King James Version'
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bible_books (
    num INTEGER PRIMARY KEY,   -- 1..66
    name TEXT NOT NULL,
    abbrev TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bible_verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    translation TEXT NOT NULL,
    book INTEGER NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    UNIQUE (translation, book, chapter, verse)
  );

  CREATE INDEX IF NOT EXISTS idx_bible_verses_ref
    ON bible_verses(translation, book, chapter, verse);

  CREATE VIRTUAL TABLE IF NOT EXISTS bible_verses_fts USING fts5(
    text,
    content=bible_verses,
    content_rowid=id
  );

  CREATE TRIGGER IF NOT EXISTS bible_verses_ai AFTER INSERT ON bible_verses BEGIN
    INSERT INTO bible_verses_fts(rowid, text) VALUES (new.id, new.text);
  END;
  CREATE TRIGGER IF NOT EXISTS bible_verses_ad AFTER DELETE ON bible_verses BEGIN
    INSERT INTO bible_verses_fts(bible_verses_fts, rowid, text) VALUES('delete', old.id, old.text);
  END;

  -- ── Songbooks ──────────────────────────────────────────────────────────────
  -- A labeled collection a song belongs to ("Songs" — the pre-existing flat
  -- library, kept as the default so nothing already imported moves or loses
  -- its place — "Crois Seulement", "Hosanna", or any other operator-named
  -- set manually imported via the same file/paste/online pipeline every
  -- songbook shares). Deliberately just {id, label}: no language field here
  -- — a songbook's language is implicit in its content, not declared, same
  -- as the flat list never declared one.
  CREATE TABLE IF NOT EXISTS songbooks (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Songs ──────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    song_key TEXT,
    ccli TEXT,
    source TEXT NOT NULL DEFAULT 'import',  -- 'bundled' | 'import'
    origin_path TEXT,                       -- import file path, for dedupe
    search_body TEXT NOT NULL DEFAULT '',   -- title + all lyrics, for FTS
    songbook_id TEXT NOT NULL DEFAULT 'default' REFERENCES songbooks(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS song_slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    slide_index INTEGER NOT NULL,
    label TEXT,
    text TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_song_slides_song ON song_slides(song_id, slide_index);

  CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
    search_body,
    content=songs,
    content_rowid=id
  );

  CREATE TRIGGER IF NOT EXISTS songs_ai AFTER INSERT ON songs BEGIN
    INSERT INTO songs_fts(rowid, search_body) VALUES (new.id, new.search_body);
  END;
  CREATE TRIGGER IF NOT EXISTS songs_ad AFTER DELETE ON songs BEGIN
    INSERT INTO songs_fts(songs_fts, rowid, search_body) VALUES('delete', old.id, old.search_body);
  END;
  CREATE TRIGGER IF NOT EXISTS songs_au AFTER UPDATE ON songs BEGIN
    INSERT INTO songs_fts(songs_fts, rowid, search_body) VALUES('delete', old.id, old.search_body);
    INSERT INTO songs_fts(rowid, search_body) VALUES (new.id, new.search_body);
  END;
`

export function initLibrarySchema(database: Database): void {
  database.exec(LIBRARY_SCHEMA_SQL)

  // An existing library.db (any install from before songbooks existed)
  // already has a 'songs' table — CREATE TABLE IF NOT EXISTS above is a
  // no-op for it, so the new column needs adding explicitly. Every existing
  // song implicitly belongs to the 'default' songbook, the same flat list
  // it was always part of — this migration is what makes that true in the
  // data, not just in the application's fallback logic.
  const songColumns = database.prepare('PRAGMA table_info(songs)').all() as Array<{ name: string }>
  if (!songColumns.some((c) => c.name === 'songbook_id')) {
    database.exec("ALTER TABLE songs ADD COLUMN songbook_id TEXT NOT NULL DEFAULT 'default'")
  }

  // Only safe to create after the column above is guaranteed to exist — a
  // fresh install already has it (from the CREATE TABLE above), an existing
  // one only just got it from the ALTER TABLE.
  database.exec('CREATE INDEX IF NOT EXISTS idx_songs_songbook ON songs(songbook_id)')

  database
    .prepare('INSERT OR IGNORE INTO songbooks (id, label) VALUES (?, ?)')
    .run('default', 'Songs')
}
