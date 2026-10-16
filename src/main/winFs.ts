/**
 * Windows-hardening helpers for file work. On Windows an antivirus scanner or the search indexer can hold a
 * freshly written file for a moment, so a rename or delete fails with EBUSY/EPERM/EACCES even though trying
 * again a few hundred milliseconds later works. Paths over ~260 characters need the \\?\ prefix.
 * Everything is parameterised on the platform so it can be tested with path.win32 on any OS.
 */
import { renameSync, unlinkSync, rmSync } from 'fs'
import { win32 } from 'path'

const TRANSIENT = new Set(['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY', 'EMFILE'])

function sleepSync(ms: number): void {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) } catch { /* busy-less fallback: just retry */ }
}

/** Run a sync fs action, retrying a few times (50, 100, 200, 400 ms) on errors a scanner can cause. */
export function retryFs<T>(fn: () => T, opts: { platform?: string; delays?: number[]; sleep?: (ms: number) => void } = {}): T {
  const platform = opts.platform ?? process.platform
  const delays = platform === 'win32' ? (opts.delays ?? [50, 100, 200, 400]) : []
  const sleep = opts.sleep ?? sleepSync
  for (let i = 0; ; i++) {
    try {
      return fn()
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? ''
      if (i >= delays.length || !TRANSIENT.has(code)) throw e
      sleep(delays[i])
    }
  }
}

export const renameRetry = (from: string, to: string): void => retryFs(() => renameSync(from, to))
export const unlinkRetry = (p: string): void => retryFs(() => unlinkSync(p))
export const rmRetry = (p: string): void => retryFs(() => rmSync(p, { recursive: true, force: true }))

/**
 * Make a path safe to hand to Windows file APIs when it is long. Under the 248-character limit (or on
 * another OS) it is returned unchanged. Handles drive paths and \\server\share (UNC) paths.
 */
export function longPath(p: string, platform: string = process.platform): string {
  if (platform !== 'win32' || p.length < 248 || p.startsWith('\\\\?\\')) return p
  const abs = win32.resolve(p)
  if (abs.startsWith('\\\\')) return '\\\\?\\UNC\\' + abs.slice(2)
  return '\\\\?\\' + abs
}

/** Windows reserved device names (with or without an extension) cannot be created as files. */
export function isReservedWindowsName(name: string): boolean {
  const base = name.split('.')[0].replace(/[ .]+$/, '')
  return /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i.test(base)
}

/** A file name that is safe on Windows, macOS and Linux (no separators, controls, reserved names, trailing dots/spaces). */
export function safeFileName(name: string, fallback = 'picture'): string {
  let n = name.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[ .]+$/, '').trim()
  if (!n || isReservedWindowsName(n)) n = n ? `_${n}` : fallback
  return n.slice(0, 120)
}

import { driveRootOf as driveRootOfPlatform } from '../shared/driveRoot'

/** See shared/driveRoot.ts. */
export const driveRootOf = (p: string, platform: string = process.platform): string | null => driveRootOfPlatform(p, platform)
