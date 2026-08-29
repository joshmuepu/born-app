import { describe, it, expect, beforeAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'node:path'
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
    slides: [
      { label: 'Verse 1', text: 'Amazing grace how sweet the sound' },
      { label: 'Chorus', text: 'My chains are gone, I have been set free' }
    ]
  },
  'bundled',
  'bundled:amazing.pro'
)
insertSong(
  db,
  { title: 'My Own Song', slides: [{ text: 'imported lyric line here' }] },
  'import',
  'import:mine.txt'
)

vi.mock('../../main/libraryDb', () => ({ getLibraryDb: () => db }))
vi.mock('../../main/logger', () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}))

let songs: typeof import('../../main/songs')
beforeAll(async () => {
  songs = await import('../../main/songs')
})

describe('searchSongs', () => {
  it('lists everything for an empty query', () => {
    expect(songs.searchSongs('').map((s) => s.title).sort()).toEqual(['Amazing Grace', 'My Own Song'])
  })
  it('FTS-matches title and lyrics', () => {
    expect(songs.searchSongs('chains').map((s) => s.title)).toEqual(['Amazing Grace'])
    expect(songs.searchSongs('imported lyric').map((s) => s.title)).toEqual(['My Own Song'])
  })
  it('reports slide count + source', () => {
    const s = songs.searchSongs('amazing')[0]
    expect(s.slideCount).toBe(2)
    expect(s.source).toBe('bundled')
  })
})

describe('getSong', () => {
  it('returns slides in order with labels', () => {
    const all = songs.searchSongs('amazing')
    const detail = songs.getSong(all[0].id)!
    expect(detail.author).toBe('John Newton')
    expect(detail.slides.map((s) => s.label)).toEqual(['Verse 1', 'Chorus'])
  })
  it('returns null for an unknown id', () => {
    expect(songs.getSong(9999)).toBeNull()
  })
})

describe('importSongs', () => {
  it('imports a fixture file and dedupes on re-import', () => {
    const fx = join(__dirname, '../fixtures/songs/doxology.txt')
    const r1 = songs.importSongs([fx])
    expect(r1.added).toHaveLength(1)
    expect(r1.added[0].title).toBe('Doxology')
    const r2 = songs.importSongs([fx])
    expect(r2.added).toHaveLength(0)
    expect(r2.skipped).toBe(1)
  })
})

describe('deleteSong', () => {
  it('deletes an imported song but not a bundled one', () => {
    const imported = songs.searchSongs('imported lyric')[0]
    expect(songs.deleteSong(imported.id)).toBe(true)
    expect(songs.getSong(imported.id)).toBeNull()

    const bundled = songs.searchSongs('amazing grace')[0]
    expect(songs.deleteSong(bundled.id)).toBe(false)
    expect(songs.getSong(bundled.id)).not.toBeNull()
  })
})
