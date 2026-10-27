import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { gunzipSync } from 'zlib'
import { join } from 'path'
import { log } from './logger'
import { initSchema } from './schema'
import { checkAndRecoverDatabase, type IntegrityCheckResult } from './dbIntegrity'
import { upgradeSermonDb, finishInterruptedUpgrade } from './sermonDbUpgrade'

let db: Database.Database | null = null
let recoveryInfo: IntegrityCheckResult = { recovered: false }

/** Set once getDb() has run its integrity check — lets the renderer show an
 *  accurate "your data was restored" message instead of a generic one. */
export function getDbRecoveryInfo(): IntegrityCheckResult {
  return recoveryInfo
}

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
    try {
      if (finishInterruptedUpgrade(dbPath)) log.info('db: finished a sermon library upgrade that was cut off')
    } catch (e) {
      log.error('db: could not finish an interrupted sermon library upgrade', e)
    }
    recoveryInfo = checkAndRecoverDatabase(dbPath, seedFromBundledDb, 'sermons.db')
    // a profile made before the library was stored one row per paragraph gets the new one (sermonDbUpgrade.ts); if anything goes wrong it
    // keeps the old one
    try {
      const up = upgradeSermonDb(dbPath, bundledDbCandidates().find((p) => p && existsSync(p)))
      if (up.upgraded) log.info(`db: sermon library upgraded to one row per paragraph; kept ${up.keptSermons} fetched sermon(s) and ${up.keptTranslations} translated row(s); old file kept as ${up.backup}`)
      else if (up.reason === 'not enough disk space') log.warn('db: sermon library not upgraded: not enough disk space; keeping the current one')
    } catch (e) {
      log.error('db: sermon library upgrade failed, keeping the current one', e)
    }
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
