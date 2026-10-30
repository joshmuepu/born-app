/**
 * sermonDbUpgrade.ts — bring a profile's sermon library up to the bundled one's format.
 *
 * A profile's sermons.db is copied from the bundled library once, on first run, and never again. The bundled library is now built with one
 * row per numbered paragraph (PRAGMA user_version 3, scripts/build-sermon-db.ts); a profile made before that still has the source's
 * sections (user_version 0), or an earlier paragraph format (1, 2). On start, such a profile gets the new library, and nothing it had is lost:
 *   - everything only the old file has is copied in: downloaded translations, and any sermon fetched online after install;
 *   - the old file is kept beside it as sermons.db.sections-<date>.bak (format 0) or sermons.db.format<N>-<date>.bak.
 * Nothing happens when the profile is already current, when there is no bundled library, or when the bundled one is not newer.
 * Any failure (a read-only folder, a full disk, a damaged bundled file) leaves the profile's library exactly as it was; the caller logs it.
 */
import Database from 'better-sqlite3'
import fs from 'fs'
import { dirname } from 'path'
import { gunzipSync } from 'zlib'

/** The same number means the same library contents in every BORN line. */
export const SERMON_DB_FORMAT = 3
/** Room kept free beyond the new file itself (SQLite's own journal while the old rows are copied in). */
const DISK_HEADROOM = 64 * 1024 * 1024

const versionOf = (path: string): number => {
  const d = new Database(path, { readonly: true, fileMustExist: true })
  try {
    return Number(d.pragma('user_version', { simple: true })) || 0
  } finally {
    d.close()
  }
}

export interface UpgradeResult { upgraded: boolean; backup?: string; keptSermons?: number; keptTranslations?: number; reason?: string }

const nextPath = (dbPath: string): string => `${dbPath}.upgrade`

/** A start that was cut off between moving the old file aside and moving the new one in leaves no sermons.db but a complete new one:
 *  put it in place (before the profile would otherwise be re-seeded from scratch). */
export function finishInterruptedUpgrade(dbPath: string): boolean {
  const next = nextPath(dbPath)
  if (fs.existsSync(dbPath) || !fs.existsSync(next)) return false
  try {
    if (versionOf(next) < SERMON_DB_FORMAT) return false
  } catch {
    return false
  }
  fs.renameSync(next, dbPath)
  return true
}

export function upgradeSermonDb(dbPath: string, bundledGz: string | undefined, now = new Date()): UpgradeResult {
  if (!fs.existsSync(dbPath)) return { upgraded: false, reason: 'no profile library yet (it is seeded fresh)' }
  const oldFormat = versionOf(dbPath)
  if (oldFormat >= SERMON_DB_FORMAT) return { upgraded: false, reason: 'already current' }
  if (!bundledGz || !fs.existsSync(bundledGz)) return { upgraded: false, reason: 'no bundled library' }

  const next = nextPath(dbPath)
  fs.rmSync(next, { force: true }) // a half-written file from an earlier attempt is never used
  try {
    const raw = gunzipSync(fs.readFileSync(bundledGz))
    const free = (() => { try { const s = fs.statfsSync(dirname(dbPath)); return Number(s.bavail) * Number(s.bsize) } catch { return Infinity } })()
    if (free < raw.length + DISK_HEADROOM) return { upgraded: false, reason: 'not enough disk space' }
    fs.writeFileSync(next, raw)
    if (versionOf(next) < SERMON_DB_FORMAT) { fs.rmSync(next, { force: true }); return { upgraded: false, reason: 'bundled library is not newer' } }

    // fold the old file's WAL in first, so what is copied and what is kept as the backup is complete
    const old = new Database(dbPath)
    old.pragma('wal_checkpoint(TRUNCATE)')
    old.close()

    const d = new Database(next)
    let keptSermons = 0, keptTranslations = 0
    try {
      d.prepare('ATTACH DATABASE ? AS old').run(dbPath)
      const has = (t: string): boolean => !!d.prepare("SELECT 1 FROM old.sqlite_master WHERE type = 'table' AND name = ?").get(t)
      d.transaction(() => {
        // sermons fetched after install: not in the bundled library, so carry them over with their rows (as they were stored)
        keptSermons = d.prepare('INSERT INTO sermons SELECT * FROM old.sermons WHERE id NOT IN (SELECT id FROM main.sermons)').run().changes
        if (keptSermons > 0) {
          d.prepare('INSERT INTO paragraphs (sermon_id, paragraph_ref, paragraph_index, text) SELECT sermon_id, paragraph_ref, paragraph_index, text FROM old.paragraphs WHERE sermon_id NOT IN (SELECT DISTINCT sermon_id FROM main.paragraphs)').run()
        }
        if (has('sermon_index')) d.prepare('INSERT OR IGNORE INTO sermon_index SELECT * FROM old.sermon_index').run()
        if (has('translated_sermons')) d.prepare('INSERT OR IGNORE INTO translated_sermons SELECT * FROM old.translated_sermons').run()
        if (has('translated_paragraphs')) keptTranslations = d.prepare('INSERT OR IGNORE INTO translated_paragraphs (sermon_id, language, paragraph_ref, paragraph_index, text) SELECT sermon_id, language, paragraph_ref, paragraph_index, text FROM old.translated_paragraphs').run().changes
      })()
      d.prepare('DETACH DATABASE old').run()
    } finally {
      d.close()
    }

    const backup = `${dbPath}.${oldFormat === 0 ? 'sections' : `format${oldFormat}`}-${now.toISOString().slice(0, 10)}.bak`
    fs.renameSync(dbPath, backup)
    try {
      fs.renameSync(next, dbPath)
    } catch (e) {
      fs.renameSync(backup, dbPath) // put the old one back
      throw e
    }
    for (const ext of ['-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true })
    return { upgraded: true, backup, keptSermons, keptTranslations }
  } catch (e) {
    try { fs.rmSync(next, { force: true }) } catch { /* nothing more to do */ }
    throw e
  }
}
