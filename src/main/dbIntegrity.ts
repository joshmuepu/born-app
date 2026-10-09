/**
 * dbIntegrity.ts — detects a corrupted local database file on open and
 * recovers from it automatically, instead of leaving the operator stuck
 * with a generic "needs an internet connection" message that has nothing
 * to do with the real problem.
 *
 * Takes plain file paths (no Electron `app` dependency) so this logic can
 * be exercised directly in tests against real files on disk, the same way
 * the actual corruption (a damaged file already on the user's machine)
 * would be encountered.
 */
import Database from 'better-sqlite3'
import { existsSync, renameSync } from 'fs'
import { log } from './logger'

export interface IntegrityCheckResult {
  /** True only when an existing file was found corrupted and replaced. */
  recovered: boolean
  /** Where the damaged file was moved — never deleted. Set iff recovered. */
  quarantinedTo?: string
}

/** `PRAGMA integrity_check` passes iff this is the one and only row. */
const INTEGRITY_OK = 'ok'

function isHealthy(path: string): boolean {
  let probe: Database.Database | null = null
  try {
    probe = new Database(path, { readonly: true, fileMustExist: true })
    const rows = probe.pragma('integrity_check') as Array<{ integrity_check: string }>
    return rows.length === 1 && rows[0].integrity_check === INTEGRITY_OK
  } catch (e) {
    log.warn(`dbIntegrity: ${path} failed to open for checking`, e)
    return false
  } finally {
    probe?.close()
  }
}

/** Renames `path` (and any `-wal`/`-shm` sidecars) to a timestamped name in
 *  the same folder, never deleting the original. Returns the new path for
 *  the main file. */
function quarantine(path: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const quarantinedPath = `${path}.corrupt-${stamp}`
  renameSync(path, quarantinedPath)
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${path}${suffix}`
    if (existsSync(sidecar)) {
      try {
        renameSync(sidecar, `${quarantinedPath}${suffix}`)
      } catch (e) {
        // Not fatal — the sidecar is regenerated fresh once the reseeded
        // main file is opened; losing track of the old one just means a
        // stray file instead of a fully tidy quarantine.
        log.warn(`dbIntegrity: failed to move sidecar ${sidecar}`, e)
      }
    }
  }
  return quarantinedPath
}

/**
 * Ensures `path` is a healthy SQLite database before the caller opens it for
 * real. Three cases:
 *   - missing            → `seed(path)`, not a recovery (nothing was lost).
 *   - present and healthy → left alone.
 *   - present and corrupt → quarantined (renamed, never deleted), then
 *                            `seed(path)` reseeds a fresh copy in its place.
 * `seed` is whatever the caller already uses to inflate the bundled gz —
 * passed in rather than imported so this stays testable with a stub.
 */
export function checkAndRecoverDatabase(
  path: string,
  seed: (target: string) => void,
  label: string
): IntegrityCheckResult {
  if (!existsSync(path)) {
    seed(path)
    return { recovered: false }
  }
  if (isHealthy(path)) {
    return { recovered: false }
  }
  log.error(`dbIntegrity: ${label} at ${path} failed its integrity check — quarantining and reseeding`)
  const quarantinedTo = quarantine(path)
  seed(path)
  return { recovered: true, quarantinedTo }
}
