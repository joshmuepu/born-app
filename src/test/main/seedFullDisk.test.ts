import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gzipSync } from 'zlib'

// First start copies the bundled libraries into the profile. On a nearly full disk that copy stopped half way and left half a database
// in place: opening it threw ("file is not a database") before any window was made, so BORN started with no window at all, and every
// later start set the broken file aside and tried again, using up more disk. The copy now goes in only once it is complete.

const failing = { on: false }
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  const writeFileSync = ((p: string, data: string | Buffer, ...rest: unknown[]) => {
    if (failing.on && /(sermons|library)\.db(\.tmp)?$/.test(String(p))) {
      actual.writeFileSync(p, (data as Buffer).subarray(0, 4096))
      throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
    }
    return (actual.writeFileSync as (...a: unknown[]) => void)(p, data, ...rest)
  }) as typeof actual.writeFileSync
  return { ...actual, writeFileSync, default: { ...actual, writeFileSync } }
})

let dir: string, res: string
const savedResources = process.resourcesPath
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'born-seed-'))
  res = mkdtempSync(join(tmpdir(), 'born-seed-res-'))
  for (const name of ['sermons', 'library']) {
    const p = join(res, `${name}.db`)
    const d = new Database(p); d.exec('CREATE TABLE filler (x TEXT)'); const ins = d.prepare('INSERT INTO filler VALUES (?)')
    // one transaction: 400 separate inserts each wait for the disk, which took over 10 seconds on the Windows runner
    d.transaction(() => { for (let i = 0; i < 400; i++) ins.run('placeholder row ' + i) })(); d.close()
    writeFileSync(join(res, `${name}.db.gz`), gzipSync(readFileSync(p)))
  }
  ;(process as { resourcesPath?: string }).resourcesPath = res
  vi.resetModules()
  const { app } = await import('electron')
  vi.mocked(app.getPath).mockReturnValue(dir)
  ;(app as unknown as { getAppPath: () => string }).getAppPath = () => res // the test mock has no app folder
})
afterEach(() => {
  failing.on = false
  ;(process as { resourcesPath?: string }).resourcesPath = savedResources
  rmSync(dir, { recursive: true, force: true }); rmSync(res, { recursive: true, force: true })
})

describe('a first-start copy that runs out of disk leaves no half database behind', () => {
  it('sermons.db: the library still opens (empty), and no partial file is left', async () => {
    const { getDb, closeDb } = await import('../../main/db')
    failing.on = true
    expect(() => getDb()).not.toThrow()
    failing.on = false
    closeDb()
    expect(existsSync(join(dir, 'sermons.db.tmp'))).toBe(false)
  })
  it('library.db: the same', async () => {
    const { getLibraryDb, closeLibraryDb } = await import('../../main/libraryDb')
    failing.on = true
    expect(() => getLibraryDb()).not.toThrow()
    failing.on = false
    closeLibraryDb()
    expect(existsSync(join(dir, 'library.db.tmp'))).toBe(false)
  })
})
