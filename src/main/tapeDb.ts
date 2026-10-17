/**
 * tapeDb.ts — tape.db: the Tape service's own database (recordings, sync maps, resume positions). Versioned with PRAGMA user_version like
 * media.db; migrations only append. It is separate from library.db (which is re-seeded when damaged) and from media.db (which is the
 * picture library). Deleting anything here never touches sermon data: sermons live in the sermon database, tapes only point at them
 * by number. Electron-free so tests can use a temp file.
 */
import type { Database } from 'better-sqlite3'
import { randomBytes } from 'crypto'
import type { SyncMap, SyncMark, SyncRegion, SyncSource, TapeFile, TapeRecording } from '../shared/tape'

export class TapeDbTooNewError extends Error {
  constructor(public found: number, public supported: number) {
    super(`tape.db was written by a newer BORN (schema ${found}; this build understands up to ${supported}).`)
    this.name = 'TapeDbTooNewError'
  }
}

export const TAPE_MIGRATIONS: Array<(db: Database) => void> = [
  (db) => {
    db.exec(`
      CREATE TABLE tape_files (
        id TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        name TEXT NOT NULL,
        orig_filename TEXT NOT NULL,
        ext TEXT NOT NULL,
        container TEXT NOT NULL,
        codec TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        duration_sec REAL NOT NULL,
        bitrate INTEGER NOT NULL DEFAULT 0,
        vbr INTEGER,
        seek_ok INTEGER NOT NULL DEFAULT 1,
        storage TEXT NOT NULL DEFAULT 'managed',
        link_path TEXT,
        link_mtime_ms INTEGER,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE UNIQUE INDEX idx_tape_files_hash_live ON tape_files(hash) WHERE deleted_at IS NULL;

      CREATE TABLE recordings (
        id TEXT PRIMARY KEY,
        sermon_id INTEGER NOT NULL,
        file_id TEXT NOT NULL REFERENCES tape_files(id),
        language TEXT NOT NULL DEFAULT 'en',
        label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX idx_recordings_sermon ON recordings(sermon_id);

      CREATE TABLE sync_maps (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
        text_language TEXT,
        source TEXT NOT NULL DEFAULT 'tap',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX idx_sync_maps_one ON sync_maps(recording_id, COALESCE(text_language, ''));

      CREATE TABLE sync_marks (
        map_id TEXT NOT NULL REFERENCES sync_maps(id) ON DELETE CASCADE,
        paragraph_number INTEGER NOT NULL,
        start_sec REAL,
        confidence REAL,
        kind TEXT NOT NULL DEFAULT 'start',
        PRIMARY KEY (map_id, paragraph_number)
      );

      CREATE TABLE sync_regions (
        map_id TEXT NOT NULL REFERENCES sync_maps(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        start_sec REAL NOT NULL,
        end_sec REAL NOT NULL,
        note TEXT
      );

      CREATE TABLE tape_state (
        recording_id TEXT PRIMARY KEY REFERENCES recordings(id) ON DELETE CASCADE,
        position_sec REAL NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
  },
  // v2: the override table for using one recording's timing with text in another language ("French ¶113 is the recording's ¶115"). A new table only.
  (db) => {
    db.exec(`
      CREATE TABLE map_overrides (
        recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
        text_language TEXT NOT NULL,
        text_n INTEGER NOT NULL,
        map_n INTEGER NOT NULL,
        PRIMARY KEY (recording_id, text_language, text_n)
      );
    `)
  }
]
export const TAPE_SCHEMA_VERSION = TAPE_MIGRATIONS.length

export function migrateTapeDb(db: Database): { from: number; to: number } {
  const from = db.pragma('user_version', { simple: true }) as number
  if (from > TAPE_SCHEMA_VERSION) throw new TapeDbTooNewError(from, TAPE_SCHEMA_VERSION)
  if (from < TAPE_SCHEMA_VERSION) {
    db.transaction(() => {
      for (let v = from; v < TAPE_SCHEMA_VERSION; v++) TAPE_MIGRATIONS[v](db)
      db.pragma(`user_version = ${TAPE_SCHEMA_VERSION}`)
    })()
  }
  return { from, to: TAPE_SCHEMA_VERSION }
}

const newId = (p: string): string => `${p}_${randomBytes(6).toString('hex')}`

interface FileRow {
  id: string; hash: string; name: string; orig_filename: string; ext: string; container: string; codec: string; bytes: number
  duration_sec: number; bitrate: number; vbr: number | null; seek_ok: number; storage: string; link_path: string | null; added_at: string
}
const toFile = (r: FileRow): TapeFile => ({
  id: r.id, hash: r.hash, name: r.name, origFilename: r.orig_filename, ext: r.ext, container: r.container, codec: r.codec, bytes: r.bytes,
  durationSec: r.duration_sec, bitrate: r.bitrate, vbr: r.vbr === null ? null : r.vbr === 1, seekTableOk: r.seek_ok === 1,
  storage: r.storage === 'linked' ? 'linked' : 'managed', linkPath: r.link_path, addedAt: r.added_at
})

export class TapeDb {
  constructor(private db: Database) {
    db.pragma('foreign_keys = ON')
    migrateTapeDb(db)
  }

  // ── files ──
  addFile(f: Omit<TapeFile, 'id' | 'addedAt'>): TapeFile {
    const id = newId('t')
    this.db
      .prepare(
        `INSERT INTO tape_files (id, hash, name, orig_filename, ext, container, codec, bytes, duration_sec, bitrate, vbr, seek_ok, storage, link_path)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(id, f.hash, f.name, f.origFilename, f.ext, f.container, f.codec, f.bytes, f.durationSec, f.bitrate, f.vbr === null ? null : f.vbr ? 1 : 0, f.seekTableOk ? 1 : 0, f.storage, f.linkPath)
    return this.getFile(id)!
  }
  getFile(id: string): TapeFile | null {
    const r = this.db.prepare('SELECT * FROM tape_files WHERE id = ? AND deleted_at IS NULL').get(id) as FileRow | undefined
    return r ? toFile(r) : null
  }
  findFileByHash(hash: string): TapeFile | null {
    const r = this.db.prepare('SELECT * FROM tape_files WHERE hash = ? AND deleted_at IS NULL').get(hash) as FileRow | undefined
    return r ? toFile(r) : null
  }
  findFileByNameAndSize(origFilename: string, bytes: number): TapeFile | null {
    const r = this.db.prepare('SELECT * FROM tape_files WHERE orig_filename = ? AND bytes = ? AND deleted_at IS NULL').get(origFilename, bytes) as FileRow | undefined
    return r ? toFile(r) : null
  }
  listFiles(): TapeFile[] {
    return (this.db.prepare('SELECT * FROM tape_files WHERE deleted_at IS NULL ORDER BY added_at DESC').all() as FileRow[]).map(toFile)
  }
  /** Files no recording uses any more (for cleanup). */
  orphanFiles(): TapeFile[] {
    return (
      this.db.prepare('SELECT f.* FROM tape_files f WHERE f.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM recordings r WHERE r.file_id = f.id AND r.deleted_at IS NULL)').all() as FileRow[]
    ).map(toFile)
  }
  softDeleteFile(id: string): void {
    this.db.prepare("UPDATE tape_files SET deleted_at = datetime('now') WHERE id = ?").run(id)
  }
  relinkFile(id: string, linkPath: string): void {
    this.db.prepare("UPDATE tape_files SET link_path = ?, storage = 'linked' WHERE id = ?").run(linkPath, id)
  }

  // ── recordings ──
  addRecording(sermonId: number, fileId: string, language = 'en', label = ''): string {
    const existing = this.db.prepare('SELECT id FROM recordings WHERE sermon_id = ? AND file_id = ? AND deleted_at IS NULL').get(sermonId, fileId) as { id: string } | undefined
    if (existing) return existing.id
    const id = newId('r')
    this.db.prepare('INSERT INTO recordings (id, sermon_id, file_id, language, label) VALUES (?,?,?,?,?)').run(id, sermonId, fileId, language, label)
    return id
  }
  getRecording(id: string): TapeRecording | null {
    const r = this.db.prepare('SELECT * FROM recordings WHERE id = ? AND deleted_at IS NULL').get(id) as RecRow | undefined
    return r ? this.hydrate(r) : null
  }
  listRecordings(sermonId: number): TapeRecording[] {
    const rows = this.db.prepare('SELECT * FROM recordings WHERE sermon_id = ? AND deleted_at IS NULL ORDER BY created_at, id').all(sermonId) as RecRow[]
    return rows.map((r) => this.hydrate(r)).filter((x): x is TapeRecording => !!x)
  }
  /** Sermon ids that have at least one recording (for a "has a tape" badge in lists). */
  sermonsWithTapes(): number[] {
    return (this.db.prepare('SELECT DISTINCT sermon_id FROM recordings WHERE deleted_at IS NULL').all() as Array<{ sermon_id: number }>).map((r) => r.sermon_id)
  }
  setRecordingLanguage(id: string, language: string): void {
    this.db.prepare('UPDATE recordings SET language = ? WHERE id = ?').run(language, id)
  }
  /** Remove a recording from a sermon. The audio file, the sermon and its text are never deleted by this. Sync maps go with the recording. */
  removeRecording(id: string): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM sync_maps WHERE recording_id = ?').run(id)
      this.db.prepare('DELETE FROM tape_state WHERE recording_id = ?').run(id)
      this.db.prepare('DELETE FROM map_overrides WHERE recording_id = ?').run(id)
      this.db.prepare("UPDATE recordings SET deleted_at = datetime('now') WHERE id = ?").run(id)
    })()
  }
  private hydrate(r: RecRow): TapeRecording | null {
    const file = this.getFile(r.file_id)
    if (!file) return null
    const synced = !!this.db.prepare('SELECT 1 FROM sync_maps WHERE recording_id = ? AND text_language IS NULL').get(r.id)
    return { id: r.id, sermonId: r.sermon_id, language: r.language, label: r.label, createdAt: r.created_at, file, synced }
  }

  // ── sync maps ──
  getMap(recordingId: string, textLanguage: string | null = null): SyncMap | null {
    const m = this.db.prepare("SELECT * FROM sync_maps WHERE recording_id = ? AND COALESCE(text_language, '') = ?").get(recordingId, textLanguage ?? '') as MapRow | undefined
    if (!m) return null
    const marks = (this.db.prepare('SELECT * FROM sync_marks WHERE map_id = ? ORDER BY paragraph_number').all(m.id) as MarkRow[]).map(
      (x): SyncMark => ({ n: x.paragraph_number, t: x.start_sec, confidence: x.confidence, kind: x.kind === 'skip' ? 'skip' : 'start' })
    )
    const regions = (this.db.prepare('SELECT * FROM sync_regions WHERE map_id = ? ORDER BY start_sec').all(m.id) as RegionRow[]).map(
      (x): SyncRegion => ({ kind: x.kind === 'differs' ? 'differs' : 'gap', start: x.start_sec, end: x.end_sec, note: x.note ?? undefined })
    )
    return { id: m.id, recordingId, textLanguage: m.text_language, source: (m.source as SyncSource) ?? 'tap', marks, regions, updatedAt: m.updated_at }
  }
  listMapLanguages(recordingId: string): Array<string | null> {
    return (this.db.prepare('SELECT text_language FROM sync_maps WHERE recording_id = ?').all(recordingId) as Array<{ text_language: string | null }>).map((r) => r.text_language)
  }
  /** Replace a map wholesale (the editor saves the whole thing; Undo in the editor restores an earlier copy). */
  saveMap(recordingId: string, textLanguage: string | null, source: SyncSource, marks: SyncMark[], regions: SyncRegion[]): SyncMap {
    this.db.transaction(() => {
      let m = this.db.prepare("SELECT id FROM sync_maps WHERE recording_id = ? AND COALESCE(text_language, '') = ?").get(recordingId, textLanguage ?? '') as { id: string } | undefined
      if (!m) {
        const id = newId('m')
        this.db.prepare('INSERT INTO sync_maps (id, recording_id, text_language, source) VALUES (?,?,?,?)').run(id, recordingId, textLanguage, source)
        m = { id }
      } else {
        this.db.prepare("UPDATE sync_maps SET source = ?, updated_at = datetime('now') WHERE id = ?").run(source, m.id)
        this.db.prepare('DELETE FROM sync_marks WHERE map_id = ?').run(m.id)
        this.db.prepare('DELETE FROM sync_regions WHERE map_id = ?').run(m.id)
      }
      const im = this.db.prepare('INSERT OR REPLACE INTO sync_marks (map_id, paragraph_number, start_sec, confidence, kind) VALUES (?,?,?,?,?)')
      for (const k of marks) im.run(m.id, k.n, k.t, k.confidence ?? null, k.kind)
      const ir = this.db.prepare('INSERT INTO sync_regions (map_id, kind, start_sec, end_sec, note) VALUES (?,?,?,?,?)')
      for (const r of regions) ir.run(m.id, r.kind, r.start, r.end, r.note ?? null)
    })()
    return this.getMap(recordingId, textLanguage)!
  }
  deleteMap(recordingId: string, textLanguage: string | null = null): void {
    this.db.prepare("DELETE FROM sync_maps WHERE recording_id = ? AND COALESCE(text_language, '') = ?").run(recordingId, textLanguage ?? '')
  }

  // ── language overrides ──
  getOverrides(recordingId: string, textLanguage: string): Array<{ textN: number; mapN: number }> {
    return (this.db.prepare('SELECT text_n, map_n FROM map_overrides WHERE recording_id = ? AND text_language = ? ORDER BY text_n').all(recordingId, textLanguage) as Array<{ text_n: number; map_n: number }>).map((r) => ({ textN: r.text_n, mapN: r.map_n }))
  }
  setOverrides(recordingId: string, textLanguage: string, rows: Array<{ textN: number; mapN: number }>): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM map_overrides WHERE recording_id = ? AND text_language = ?').run(recordingId, textLanguage)
      const ins = this.db.prepare('INSERT INTO map_overrides (recording_id, text_language, text_n, map_n) VALUES (?,?,?,?)')
      for (const r of rows) ins.run(recordingId, textLanguage, r.textN, r.mapN)
    })()
  }

  // ── resume ──
  setPosition(recordingId: string, sec: number): void {
    this.db
      .prepare("INSERT INTO tape_state (recording_id, position_sec, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(recording_id) DO UPDATE SET position_sec = excluded.position_sec, updated_at = excluded.updated_at")
      .run(recordingId, sec)
  }
  getPosition(recordingId: string): number | null {
    const r = this.db.prepare('SELECT position_sec FROM tape_state WHERE recording_id = ?').get(recordingId) as { position_sec: number } | undefined
    return r ? r.position_sec : null
  }
}

interface RecRow { id: string; sermon_id: number; file_id: string; language: string; label: string; created_at: string }
interface MapRow { id: string; text_language: string | null; source: string; updated_at: string }
interface MarkRow { paragraph_number: number; start_sec: number | null; confidence: number | null; kind: string }
interface RegionRow { kind: string; start_sec: number; end_sec: number; note: string | null }
