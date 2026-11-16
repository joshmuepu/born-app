/**
 * libraryDb.ts — opens library.db (Bible + songs). On first launch it inflates
 * the prebuilt resources/library.db.gz into userData; song imports then write
 * into that same file. Mirrors src/main/db.ts.
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, readFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'fs'
import { writeFileAtomic } from './corruptFile'
import { gunzipSync } from 'zlib'
import { join } from 'path'
import { log } from './logger'
import { initLibrarySchema } from './librarySchema'
import { checkAndRecoverDatabase, type IntegrityCheckResult } from './dbIntegrity'

let db: Database.Database | null = null
let recoveryInfo: IntegrityCheckResult = { recovered: false }

/** Set once getLibraryDb() has run its integrity check — lets the renderer
 *  show an accurate "your data was restored" message instead of a generic
 *  one. */
export function getLibraryDbRecoveryInfo(): IntegrityCheckResult {
  return recoveryInfo
}

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
    // whole or not at all: half a database (a full disk) would fail to open and stop the app from starting
    writeFileAtomic(target, gunzipSync(readFileSync(src)))
    log.info('libraryDb: seed complete')
  } catch (e) {
    log.error('libraryDb: seed failed', e)
  }
}

/** A library.db made empty because its first copy failed on an earlier start (a full disk): no Bible and no songs at all. It holds nothing of the
 *  user's, so it is replaced by the bundled library. Before, it was never copied again and the Bible and songs stayed empty for good. */
function isEmptyAfterFailedCopy(path: string): boolean {
  if (!existsSync(path) || !bundledCandidates().some((c) => c && existsSync(c))) return false
  let probe: Database.Database | null = null
  try {
    probe = new Database(path, { readonly: true, fileMustExist: true, timeout: 3000 })
    const has = (t: string): boolean => !!probe!.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t)
    const count = (t: string): number => (has(t) ? (probe!.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n : 0)
    return count('bible_translations') === 0 && count('bible_verses') === 0 && count('songs') === 0
  } catch {
    return false // could not be read right now: never removed on a guess
  } finally {
    try { probe?.close() } catch { /* already closed */ }
  }
}

export function getLibraryDb(): Database.Database {
  if (!db) {
    const p = userDbPath()
    if (isEmptyAfterFailedCopy(p)) {
      log.warn('libraryDb: library.db is empty (its first copy failed on an earlier start): copying the bundled library again')
      for (const f of [p, `${p}-wal`, `${p}-shm`]) {
        try { rmSync(f, { force: true }) } catch { /* a stray side file is made again */ }
      }
    }
    recoveryInfo = checkAndRecoverDatabase(p, seedFromBundled, 'library.db')
    db = new Database(p)
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    db.pragma('foreign_keys = ON')
    initLibrarySchema(db)
  }
  return db
}

/** How many dated copies are kept, and how soon after the last one no new copy is taken (a review saves its songs one by one). */
export const LIBRARY_BACKUPS_KEPT = 3
const BACKUP_GAP_MS = 10 * 60_000

/** A dated copy of library.db taken before songs are imported, so a bad import never leaves the songs only in one changed file:
 *  `<data folder>/backups/library-<date>-<time>.db`, the last three kept. Within ten minutes of the last copy no new one is taken and that one is
 *  given (it is from before this import too). Returns the copy's path, or null when none could be made (the import still goes ahead; it is logged). */
export function backupLibraryBeforeImport(now: Date = new Date()): string | null {
  try {
    const dir = join(app.getPath('userData'), 'backups')
    mkdirSync(dir, { recursive: true })
    const mine = (): string[] => readdirSync(dir).filter((f) => /^library-\d{4}-\d{2}-\d{2}-\d{6}\.db$/.test(f)).sort().reverse()
    const newest = mine()[0]
    if (newest && now.getTime() - statSync(join(dir, newest)).mtimeMs < BACKUP_GAP_MS) return join(dir, newest)
    const two = (n: number): string => String(n).padStart(2, '0')
    // the computer's own time, so the name matches the clock the operator sees
    const stamp = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`
    const target = join(dir, `library-${stamp}.db`)
    if (existsSync(target)) return target
    getLibraryDb().exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
    for (const old of mine().slice(LIBRARY_BACKUPS_KEPT)) {
      try { rmSync(join(dir, old), { force: true }) } catch { /* in use: removed next time */ }
    }
    log.info(`libraryDb: copy before an import at ${target}`)
    return target
  } catch (e) {
    log.error('libraryDb: the copy before an import could not be made', e)
    return null
  }
}

export function closeLibraryDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
