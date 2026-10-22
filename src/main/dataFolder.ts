/**
 * dataFolder.ts — BORN keeps everything (sermon library, queue, settings) in one data folder. If that folder is read-only,
 * full or missing, Chromium cannot take its single-instance lock and the app quits with no window and no message.
 * Checking first lets main.ts say what is wrong in plain words.
 */
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

/** True when files can be created in `dir` (it is created if missing). Leaves nothing behind. */
export function dataFolderIsWritable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true })
    const probe = join(dir, '.born-write-test')
    writeFileSync(probe, '1')
    rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}
