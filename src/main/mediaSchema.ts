/**
 * mediaSchema.ts — media.db: the Media library's index (what each picture is,
 * where its bytes live, tags, favourites). Versioned with PRAGMA user_version;
 * each migration runs once, in order, inside one transaction, and never drops
 * or rewrites existing rows. Electron-free so tests can use a temp file.
 *
 * This is a separate database from library.db on purpose: library.db is
 * quarantined and re-seeded from the shipped copy if it is ever damaged, which
 * would silently erase the operator's own media index.
 */
import type { Database } from 'better-sqlite3'

export class MediaDbTooNewError extends Error {
  constructor(public found: number, public supported: number) {
    super(`media.db was written by a newer BORN (schema ${found}; this build understands up to ${supported}).`)
    this.name = 'MediaDbTooNewError'
  }
}

/** Index i upgrades schema version i → i+1. Append only; never edit a shipped one. */
export const MEDIA_MIGRATIONS: Array<(db: Database) => void> = [
  // 1 — initial schema
  (db) => {
    db.exec(`
      CREATE TABLE media_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES media_folders(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE media_items (
        id TEXT PRIMARY KEY,                 -- stable, never reused: m_xxxxxxxxxxxx
        hash TEXT NOT NULL,                  -- sha-256 of the file exactly as imported
        type TEXT NOT NULL DEFAULT 'image',
        name TEXT NOT NULL,
        orig_filename TEXT NOT NULL,
        ext TEXT NOT NULL,                   -- extension of the STORED file
        mime TEXT NOT NULL,
        bytes INTEGER NOT NULL,              -- size of the STORED file
        width INTEGER NOT NULL,              -- after EXIF rotation
        height INTEGER NOT NULL,
        animated INTEGER NOT NULL DEFAULT 0,
        has_alpha INTEGER NOT NULL DEFAULT 0,
        storage TEXT NOT NULL DEFAULT 'managed',   -- 'managed' | 'linked'
        link_path TEXT,                      -- absolute path (linked only)
        link_mtime_ms INTEGER,               -- mtime when linked, to notice edits
        converted_from TEXT,                 -- e.g. 'heic'
        folder_id TEXT REFERENCES media_folders(id) ON DELETE SET NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_used_at TEXT,
        deleted_at TEXT                      -- soft delete (undo window)
      );

      -- one live row per picture: re-importing the same bytes finds this one
      CREATE UNIQUE INDEX idx_media_items_hash_live ON media_items(hash) WHERE deleted_at IS NULL;
      CREATE INDEX idx_media_items_added ON media_items(added_at);
      CREATE INDEX idx_media_items_folder ON media_items(folder_id);
      CREATE INDEX idx_media_items_deleted ON media_items(deleted_at);

      CREATE TABLE media_tags (
        item_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        PRIMARY KEY (item_id, tag)
      );
      CREATE INDEX idx_media_tags_tag ON media_tags(tag);
    `)
  }
]

export const MEDIA_SCHEMA_VERSION = MEDIA_MIGRATIONS.length

export function migrateMediaDb(db: Database): { from: number; to: number } {
  const from = db.pragma('user_version', { simple: true }) as number
  if (from > MEDIA_SCHEMA_VERSION) throw new MediaDbTooNewError(from, MEDIA_SCHEMA_VERSION)
  if (from < MEDIA_SCHEMA_VERSION) {
    const run = db.transaction(() => {
      for (let v = from; v < MEDIA_SCHEMA_VERSION; v++) MEDIA_MIGRATIONS[v](db)
      db.pragma(`user_version = ${MEDIA_SCHEMA_VERSION}`)
    })
    run()
  }
  return { from, to: MEDIA_SCHEMA_VERSION }
}
