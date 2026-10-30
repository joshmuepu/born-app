/**
 * corruptFile.ts — when a data file (settings.json, queue.json) exists but cannot be read, the app starts from
 * empty/defaults. Without this the NEXT save would overwrite the damaged file, destroying whatever could still
 * have been recovered from it. Moving it aside first keeps it for support or the user to look at.
 */
import fs, { existsSync, readFileSync, renameSync } from 'fs'
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

/** Writes a data file whole or not at all: the new content goes to `<path>.tmp` first and replaces the file only once it is
 *  complete, so a crash, a power cut or a full disk in the middle of a save leaves the previous file as it was. */
export function writeFileAtomic(path: string, data: string | Buffer): void {
  const tmp = `${path}.tmp`
  try {
    fs.writeFileSync(tmp, data)
    for (let attempt = 0; ; attempt++) {
      try {
        fs.renameSync(tmp, path)
        return
      } catch (e) {
        // Windows: a virus scanner or a sync client can hold the file for a moment
        const code = (e as NodeJS.ErrnoException).code
        if (attempt >= 4 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw e
        const until = Date.now() + 50 * (attempt + 1)
        while (Date.now() < until) { /* short wait before trying again */ }
      }
    }
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }) } catch { /* nothing more to do */ }
    throw e
  }
}
