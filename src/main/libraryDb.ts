/**
 * libraryDb.ts — opens library.db (Bible + songs). On first launch it inflates
 * the prebuilt resources/library.db.gz into userData; song imports then write
 * into that same file. Mirrors src/main/db.ts.
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { gunzipSync } from 'zlib'
import { join } from 'path'
import { log } from './logger'
import { initLibrarySchema } from './librarySchema'

let db: Database.Database | null = null

function userDbPath(): string {
  return join(app.getPath('userData'), 'library.db')
}

function bundledCandidates(): string[] {
  return [
    join(process.resourcesPath ?? '', 'library.db.gz'),
    join(app.getAppPath(), 'resources', 'library.db.gz'),
    join(app.getAppPath(), '..', 'resources', 'library.db.gz')
  ]
}

function seedFromBundled(target: string): void {
  if (existsSync(target)) return
  const src = bundledCandidates().find((p) => p && existsSync(p))
  if (!src) {
    log.info('libraryDb: no bundled library.db.gz — starting empty (Bible/songs unavailable until built)')
    return
  }
  try {
    log.info(`libraryDb: seeding library.db from ${src}`)
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(target, gunzipSync(readFileSync(src)))
    log.info('libraryDb: seed complete')
  } catch (e) {
    log.error('libraryDb: seed failed', e)
  }
}

export function getLibraryDb(): Database.Database {
  if (!db) {
    const p = userDbPath()
    seedFromBundled(p)
    db = new Database(p)
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    db.pragma('foreign_keys = ON')
    initLibrarySchema(db)
  }
  return db
}

export function closeLibraryDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
