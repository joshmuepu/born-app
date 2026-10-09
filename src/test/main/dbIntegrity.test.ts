import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { checkAndRecoverDatabase } from '../../main/dbIntegrity'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'born-dbintegrity-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function healthyDbAt(path: string): void {
  const db = new Database(path)
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
  db.prepare('INSERT INTO t (v) VALUES (?)').run('hello')
  db.close()
}

describe('checkAndRecoverDatabase', () => {
  it('missing file: seeds and reports no recovery', () => {
    const path = join(dir, 'sermons.db')
    const seed = vi.fn((target: string) => healthyDbAt(target))

    const result = checkAndRecoverDatabase(path, seed, 'sermons.db')

    expect(result).toEqual({ recovered: false })
    expect(seed).toHaveBeenCalledWith(path)
    expect(existsSync(path)).toBe(true)
  })

  it('healthy existing file: left alone, no recovery, seed never called', () => {
    const path = join(dir, 'sermons.db')
    healthyDbAt(path)
    // better-sqlite3 + this Node build crashes natively if a real-file
    // Database handle is read back with fs.readFileSync shortly after
    // close() inside this test runner (reproduced in isolation while
    // writing this test; unrelated to the corruption logic itself —
    // stat-based checks below avoid the same trigger).
    const originalSize = statSync(path).size
    const seed = vi.fn()

    const result = checkAndRecoverDatabase(path, seed, 'sermons.db')

    expect(result).toEqual({ recovered: false })
    expect(seed).not.toHaveBeenCalled()
    expect(statSync(path).size).toBe(originalSize)
  })

  it('corrupted existing file: quarantines (never deletes) and reseeds', () => {
    const path = join(dir, 'sermons.db')
    // A real SQLite file with its header overwritten with random bytes —
    // the same shape of corruption produced live in QA pass 1 (dd over the
    // first 100KB of a real sermons.db) and confirmed there to throw a
    // clean, catchable "file is not a database" error rather than crash.
    healthyDbAt(path)
    const bytes = readFileSync(path)
    for (let i = 0; i < Math.min(100, bytes.length); i++) bytes[i] = 0xaa
    writeFileSync(path, bytes)
    const corruptSize = statSync(path).size
    const seed = vi.fn((target: string) => healthyDbAt(target))

    const result = checkAndRecoverDatabase(path, seed, 'sermons.db')

    expect(result.recovered).toBe(true)
    expect(result.quarantinedTo).toBeDefined()
    // The damaged file still exists — same size, same name pattern — under
    // its new name. Never deleted.
    expect(existsSync(result.quarantinedTo!)).toBe(true)
    expect(statSync(result.quarantinedTo!).size).toBe(corruptSize)
    expect(result.quarantinedTo!).toMatch(/sermons\.db\.corrupt-/)
    // A fresh, healthy database now lives at the original path.
    expect(seed).toHaveBeenCalledWith(path)
    expect(existsSync(path)).toBe(true)
  })

  it('corrupted file that opens but fails integrity_check: also recovered', () => {
    // A real SQLite file (so `new Database()` succeeds) with a data page's
    // bytes scrambled well past the header, so integrity_check itself
    // catches it rather than the open call failing outright. Needs enough
    // real rows that a mid-file byte range actually falls on a used data
    // page rather than unused free space.
    const path = join(dir, 'sermons.db')
    const db = new Database(path)
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
    const ins = db.prepare('INSERT INTO t (v) VALUES (?)')
    for (let i = 0; i < 500; i++) ins.run(`row ${i} — ${'x'.repeat(40)}`)
    db.close()
    const bytes = readFileSync(path)
    const mid = Math.floor(bytes.length / 2)
    for (let i = mid; i < mid + 200; i++) bytes[i] = 0xff
    writeFileSync(path, bytes)
    const seed = vi.fn((target: string) => healthyDbAt(target))

    const result = checkAndRecoverDatabase(path, seed, 'sermons.db')

    expect(result.recovered).toBe(true)
    expect(existsSync(result.quarantinedTo!)).toBe(true)
    expect(seed).toHaveBeenCalledWith(path)
  })
})
