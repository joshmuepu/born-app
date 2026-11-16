import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gzipSync } from 'zlib'

// If the first copy of the Bible and song library failed (a full disk), the app made an empty library.db and never copied it again:
// the Bible and the songs stayed empty for good. The next start now copies it again; a library with anything in it is never touched.

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

/** A new start: fresh modules, the same profile and resources. */
async function restart(): Promise<typeof import('../../main/libraryDb')> {
  vi.resetModules()
  const { app } = await import('electron')
  vi.mocked(app.getPath).mockReturnValue(dir)
  ;(app as unknown as { getAppPath: () => string }).getAppPath = () => res
  return import('../../main/libraryDb')
}

describe('a first library copy that failed is made again on the next start', () => {
  it('library.db: the next start copies the bundled library instead of staying empty for good', async () => {
    const lib = await import('../../main/libraryDb')
    failing.on = true
    lib.getLibraryDb()
    failing.on = false
    lib.closeLibraryDb()
    const again = await restart()
    const db = again.getLibraryDb()
    const rows = (db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'filler'").get() as { n: number }).n
    again.closeLibraryDb()
    expect(rows).toBe(1)
  })
  it('library.db with songs of its own is never replaced', async () => {
    const lib = await import('../../main/libraryDb')
    failing.on = true
    const db = lib.getLibraryDb()
    failing.on = false
    db.prepare("INSERT INTO songs (title) VALUES ('Invented Song')").run()
    lib.closeLibraryDb()
    const again = await restart()
    const n = (again.getLibraryDb().prepare('SELECT COUNT(*) AS n FROM songs').get() as { n: number }).n
    again.closeLibraryDb()
    expect(n).toBe(1)
  })
})

