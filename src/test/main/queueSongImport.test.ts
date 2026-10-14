import { describe, it, expect, vi, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { initLibrarySchema } from '../../main/librarySchema'
import { insertSong } from '../../main/songInsert'

const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initLibrarySchema(db)

insertSong(
  db,
  {
    title: 'Amazing Grace',
    author: 'John Newton',
    songKey: 'C',
    slides: [
      { label: 'Verse 1', text: 'Amazing grace how sweet the sound that saved a wretch like me' }
    ]
  },
  'bundled'
)

vi.mock('../../main/libraryDb', () => ({ getLibraryDb: () => db }))
vi.mock('../../main/logger', () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}))

let queueSongImport: typeof import('../../main/queueSongImport')
beforeAll(async () => {
  queueSongImport = await import('../../main/queueSongImport')
})

describe('matchQueueSongs — against the real library via SQL, not just the pure matcher', () => {
  it('links a song whose title and lyrics match an existing library row', () => {
    const results = queueSongImport.matchQueueSongs([
      {
        key: 'q1',
        title: 'amazing grace!',
        slides: [{ text: 'Amazing grace, how sweet the sound, that saved a wretch like me' }]
      }
    ])
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('matched')
  })

  it('reports new for a song with no title match in the library', () => {
    const results = queueSongImport.matchQueueSongs([
      { key: 'q1', title: 'A Brand New Song', slides: [{ text: 'Totally new lyrics never seen before' }] }
    ])
    expect(results[0].status).toBe('new')
  })

  it('returns nothing for an empty batch without touching the database', () => {
    expect(queueSongImport.matchQueueSongs([])).toEqual([])
  })
})

describe('commitSongImportDecisions — transactional insert', () => {
  it('inserts a new song with source "import" and returns its real id', () => {
    const before = db.prepare('SELECT COUNT(*) as n FROM songs').get() as { n: number }
    const result = queueSongImport.commitSongImportDecisions([
      {
        groupId: 'g1',
        title: 'A Freshly Added Song',
        author: 'Some Leader',
        songKey: 'G',
        slides: [{ text: 'Verse one of the new song', label: 'Verse 1' }]
      }
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.added).toHaveLength(1)
    const row = db
      .prepare('SELECT title, source, song_key FROM songs WHERE id = ?')
      .get(result.added[0].songId) as { title: string; source: string; song_key: string }
    expect(row.title).toBe('A Freshly Added Song')
    expect(row.source).toBe('import')
    expect(row.song_key).toBe('G')
    const after = db.prepare('SELECT COUNT(*) as n FROM songs').get() as { n: number }
    expect(after.n).toBe(before.n + 1)
  })

  it('inserts every group in one go when there are several', () => {
    const result = queueSongImport.commitSongImportDecisions([
      { groupId: 'g1', title: 'Group Song One', slides: [{ text: 'lyrics one' }] },
      { groupId: 'g2', title: 'Group Song Two', slides: [{ text: 'lyrics two' }] }
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.added.map((a) => a.groupId).sort()).toEqual(['g1', 'g2'])
  })

  it('rolls back the whole batch if one insert in it fails — never a half-added batch', () => {
    const before = db.prepare('SELECT COUNT(*) as n FROM songs').get() as { n: number }
    const result = queueSongImport.commitSongImportDecisions([
      { groupId: 'ok', title: 'This One Would Have Worked', slides: [{ text: 'fine lyrics' }] },
      // insertSong calls song.title.trim() unconditionally — an undefined
      // title throws before any SQL runs, a convenient, real way to force
      // a mid-batch failure without needing to corrupt the schema itself.
      { groupId: 'bad', title: undefined as unknown as string, slides: [{ text: 'x' }] }
    ])
    expect(result.ok).toBe(false)
    const after = db.prepare('SELECT COUNT(*) as n FROM songs').get() as { n: number }
    expect(after.n).toBe(before.n) // the first, otherwise-valid insert did NOT stick
    expect(db.prepare('SELECT 1 FROM songs WHERE title = ?').get('This One Would Have Worked')).toBeUndefined()
  })

  it('does nothing and reports ok for an empty batch', () => {
    const result = queueSongImport.commitSongImportDecisions([])
    expect(result).toEqual({ ok: true, added: [] })
  })
})
