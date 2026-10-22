/**
 * corruptFile.ts — when a data file (settings.json, queue.json) exists but cannot be read, the app starts from
 * empty/defaults. Without this the NEXT save would overwrite the damaged file, destroying whatever could still
 * have been recovered from it. Moving it aside first keeps it for support or the user to look at.
 */
import { existsSync, readFileSync, renameSync } from 'fs'
import { log } from './logger'

/** Moves a damaged file next to itself as `<name>.corrupt-<time>.json`. Returns the new path, or null when there was
 *  nothing to move (no such file) or the move failed. */
export function quarantineCorruptFile(path: string): string | null {
  try {
    if (!existsSync(path)) return null
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dest = path.replace(/\.json$/, `.corrupt-${stamp}.json`)
    renameSync(path, dest)
    log.warn(`${path} could not be read — kept as ${dest}`)
    return dest
  } catch (e) {
    log.error(`could not move damaged file aside: ${path}`, e)
    return null
  }
}

/** Reads a JSON file. Missing file → `fallback`. A file that exists but cannot be parsed → `fallback`, with the damaged
 *  file moved aside first (see above). */
export function readJsonQuarantining<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    quarantineCorruptFile(path)
    return fallback
  }
}
