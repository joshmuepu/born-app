import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { gunzipSync } from 'zlib'
import { join } from 'path'
import { log } from './logger'
import { initSchema } from './schema'

let db: Database.Database | null = null

/** Location of the DB we read/write at runtime. */
function userDbPath(): string {
  return join(app.getPath('userData'), 'sermons.db')
}

/**
 * Candidate locations for the prebuilt sermons.db.gz shipped with the app.
 * Production: electron-builder `extraResources` → <resources>/sermons.db.gz.
 * Dev: a local resources/ folder at the project root.
 */
function bundledDbCandidates(): string[] {
  return [
    join(process.resourcesPath ?? '', 'sermons.db.gz'),
    join(app.getAppPath(), 'resources', 'sermons.db.gz'),
    join(app.getAppPath(), '..', 'resources', 'sermons.db.gz')
  ]
}

/** On first launch, inflate the shipped DB so search works offline immediately. */
function seedFromBundledDb(target: string): void {
  if (existsSync(target)) return
  const src = bundledDbCandidates().find((p) => p && existsSync(p))
  if (!src) {
    log.info('db: no bundled sermons.db.gz found — starting with an empty DB')
    return
  }
  try {
    log.info(`db: seeding sermons.db from bundled ${src}`)
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(target, gunzipSync(readFileSync(src)))
    log.info('db: seed complete')
  } catch (e) {
    log.error('db: failed to seed from bundled DB', e)
  }
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = userDbPath()
    seedFromBundledDb(dbPath)
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    initSchema(db)
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
