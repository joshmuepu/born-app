import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { initLibrarySchema } from '../../main/librarySchema'

// Song import skips a file already imported by its CONTENT, not its name, and an import whose save rolled back does not list songs as added.
// Invented songs only.

const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initLibrarySchema(db)
vi.mock('../../main/libraryDb', () => ({ getLibraryDb: () => db, backupLibraryBeforeImport: () => null }))
vi.mock('../../main/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

let songs: typeof import('../../main/songs')
beforeAll(async () => { songs = await import('../../main/songs') })
let dir: string
beforeEach(() => {
  db.exec('DELETE FROM song_slides; DELETE FROM songs; DROP TRIGGER IF EXISTS fail_boom')
  dir = mkdtempSync(join(tmpdir(), 'born-dedupe-'))
})
const cho = (title: string, line: string): string => `{title: ${title}}\n\n[Verse 1]\n${line}\n`
const put = (sub: string, name: string, body: string): string => { mkdirSync(join(dir, sub), { recursive: true }); writeFileSync(join(dir, sub, name), body); return join(dir, sub, name) }

describe('duplicates are found by content, not file name', () => {
  it('two different songs that share a file name are both added', async () => {
    const a = put('a', 'song.cho', cho('Invented Song One', 'Placeholder line one'))
    const b = put('b', 'song.cho', cho('Invented Song Two', 'Placeholder line two'))
    expect((await songs.importSongs([a])).added).toHaveLength(1)
    const r = await songs.importSongs([b])
    expect(r.added.map((x) => x.title)).toEqual(['Invented Song Two'])
    expect(r.skipped).toBe(0)
  })
  it('the same file imported again is skipped', async () => {
    const a = put('a', 'song.cho', cho('Invented Song One', 'Placeholder line one'))
    await songs.importSongs([a])
    const r = await songs.importSongs([a])
    expect(r.added).toHaveLength(0)
    expect(r.skipped).toBe(1)
  })
  it('a song imported before this change (keyed by name only) is not added a second time', async () => {
    db.prepare("INSERT INTO songs (title, source, origin_path) VALUES ('Invented Song One', 'import', 'import:song.cho')").run()
    const a = put('a', 'song.cho', cho('Invented Song One', 'Placeholder line one'))
    const r = await songs.importSongs([a])
    expect(r.added).toHaveLength(0)
    expect(r.skipped).toBe(1)
  })
})

describe('an import whose save rolled back', () => {
  it('lists no song as added and says each one failed', async () => {
    db.exec("CREATE TRIGGER fail_boom BEFORE INSERT ON songs WHEN NEW.title = 'Invented Boom' BEGIN SELECT RAISE(ABORT, 'database or disk is full'); END")
    const a = put('a', 'one.cho', cho('Invented Song One', 'Placeholder line one'))
    const b = put('a', 'two.cho', cho('Invented Boom', 'Placeholder line two'))
    const r = await songs.importSongs([a, b])
    expect(r.added).toHaveLength(0)
    expect(r.failed.map((f) => f.error)).toEqual(['database or disk is full', 'database or disk is full'])
    expect((db.prepare('SELECT COUNT(*) AS n FROM songs').get() as { n: number }).n).toBe(0)
  })
})
