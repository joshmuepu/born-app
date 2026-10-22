import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, chmodSync, readdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { dataFolderIsWritable } from '../../main/dataFolder'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'born-datadir-')) })
afterEach(() => { try { chmodSync(dir, 0o755) } catch { /* gone */ } rmSync(dir, { recursive: true, force: true }) })

// chmod does not make a folder read-only on Windows, and root ignores it — those runs cannot show the read-only case.
const canMakeReadOnly = process.platform !== 'win32' && !(process.getuid && process.getuid() === 0)

describe('dataFolderIsWritable', () => {
  it('is true for a normal folder and leaves nothing behind', () => {
    expect(dataFolderIsWritable(dir)).toBe(true)
    expect(readdirSync(dir)).toEqual([])
  })
  it('creates the folder when it does not exist yet (first launch)', () => {
    expect(dataFolderIsWritable(join(dir, 'new', 'deeper'))).toBe(true)
  })
  it.skipIf(!canMakeReadOnly)('is false for a read-only folder', () => {
    chmodSync(dir, 0o555)
    expect(dataFolderIsWritable(dir)).toBe(false)
  })
  it('is false when the path is a file, not a folder', () => {
    const f = join(dir, 'a-file')
    writeFileSync(f, 'x')
    expect(dataFolderIsWritable(f)).toBe(false)
  })
})
