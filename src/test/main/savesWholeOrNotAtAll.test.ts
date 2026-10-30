import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// settings.json is rewritten on almost every projection and queue.json on every queue change. Both were written in place, so a crash,
// a power cut or a full disk in the middle of a write left half a file; the next start then put it aside and began from defaults:
// display names, recent lists and the whole saved queue gone. A save now replaces the file only once the new one is complete.

const failing = { on: false }
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  // with `failing.on`, any write of a data file stops half way with a full disk, as a real one would
  const writeFileSync = ((p: string, data: string | Buffer, ...rest: unknown[]) => {
    if (failing.on && /(settings|queue)\.json/.test(String(p))) {
      actual.writeFileSync(p, String(data).slice(0, 10))
      throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
    }
    return (actual.writeFileSync as (...a: unknown[]) => void)(p, data, ...rest)
  }) as typeof actual.writeFileSync
  return { ...actual, writeFileSync, default: { ...actual, writeFileSync } }
})

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'born-atomic-')); failing.on = false })
afterEach(() => { failing.on = false; rmSync(dir, { recursive: true, force: true }) })

describe('a save that fails half way leaves the previous file as it was', () => {
  it('settings.json', async () => {
    vi.resetModules()
    const { app } = await import('electron')
    vi.mocked(app.getPath).mockReturnValue(dir)
    const settings = await import('../../main/settings')
    settings.updateSettings({ projectionDisplayName: 'Projector' })
    const good = readFileSync(join(dir, 'settings.json'), 'utf-8')
    failing.on = true
    settings.updateSettings({ projectionDisplayName: 'Other' })
    failing.on = false
    expect(readFileSync(join(dir, 'settings.json'), 'utf-8')).toBe(good)
    expect(readdirSync(dir).filter((f) => f !== 'born.log')).toEqual(['settings.json']) // the log of the failed save is fine
  })

  it('writeFileAtomic (used for the queue and service files) throws, keeps the old file and leaves no temporary file', async () => {
    const { writeFileAtomic } = await import('../../main/corruptFile')
    const path = join(dir, 'queue.json')
    writeFileSync(path, '[{"id":"a"}]')
    failing.on = true
    expect(() => writeFileAtomic(path, '[{"id":"a"},{"id":"b"}]')).toThrow(/ENOSPC/)
    failing.on = false
    expect(readFileSync(path, 'utf-8')).toBe('[{"id":"a"}]')
    expect(readdirSync(dir)).toEqual(['queue.json'])
    writeFileAtomic(path, '[{"id":"b"}]')
    expect(readFileSync(path, 'utf-8')).toBe('[{"id":"b"}]')
    expect(readdirSync(dir)).toEqual(['queue.json'])
  })
})
