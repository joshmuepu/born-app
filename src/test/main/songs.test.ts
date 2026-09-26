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
// Deliberately lopsided for the title-priority ranking test below: "harbor"
// appears once in this song's title but nowhere else, giving it a weak bm25
// score on its own.
insertSong(
  db,
  { title: 'Harbor Of Rest', slides: [{ text: 'Jesus is my harbor when the storms arise' }] },
  'bundled',
  'bundled:harbor.pro'
)
// "harbor" never appears in the title, but repeats across every slide, which
// gives plain bm25 a strong reason to rank this ABOVE the title match above —
// exactly the case the title-priority sort exists to override.
insertSong(
  db,
  {
    title: 'Anchor Song',
    slides: [
      { text: 'Safe harbor, safe harbor, my soul has found a harbor' },
      { text: 'Harbor, harbor, blessed harbor of the Lord' },
      { text: 'In the harbor, in the harbor, I will stay' }
    ]
  },
  'bundled',
  'bundled:anchor.pro'
)
insertSong(
  db,
  {
    title: 'Blessed Assurance',
    slides: [
      { label: 'Verse 1', text: 'Blessed assurance, Jesus is mine' },
      { label: 'Chorus', text: 'This is my story, this is my song' },
      { text: 'Perfect submission, perfect delight' }, // no label — should become "Verse 2"
      { text: 'Watching and waiting, looking above' } // no label — should become "Verse 3"
    ]
  },
  'bundled',
  'bundled:blessed.pro'
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
    expect(songs.searchSongs('').map((s) => s.title).sort()).toEqual([
      'Amazing Grace',
      'Anchor Song',
      'Blessed Assurance',
      'Harbor Of Rest',
      'My Own Song'
    ])
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
  it('flags a title match, with no lyric snippet attached', () => {
    const s = songs.searchSongs('grace')[0]
    expect(s.matchedInTitle).toBe(true)
    expect(s.matchSlide).toBeUndefined()
  })
  it('flags a lyrics-only match and attaches the matching slide', () => {
    const s = songs.searchSongs('chains')[0]
    expect(s.matchedInTitle).toBe(false)
    expect(s.matchSlide?.label).toBe('Chorus')
    expect(s.matchSlide?.text).toContain('chains')
  })
  it('ranks a title match above a lyrics-only match even when bm25 alone would not', () => {
    const results = songs.searchSongs('harbor')
    const titles = results.map((s) => s.title)
    expect(titles).toContain('Harbor Of Rest')
    expect(titles).toContain('Anchor Song')
    expect(titles.indexOf('Harbor Of Rest')).toBeLessThan(titles.indexOf('Anchor Song'))
    expect(results.find((s) => s.title === 'Harbor Of Rest')?.matchedInTitle).toBe(true)
    expect(results.find((s) => s.title === 'Anchor Song')?.matchedInTitle).toBe(false)
  })
  it('never truncates the library at the old 50-row cap', () => {
    const bulkDb = db
    for (let i = 0; i < 60; i++) {
      insertSong(
        bulkDb,
        { title: `Revival Song ${String(i).padStart(3, '0')}`, slides: [{ text: 'send a revival' }] },
        'bundled',
        `bundled:revival-${i}.pro`
      )
    }
    expect(songs.searchSongs('').length).toBeGreaterThan(50)
    expect(songs.searchSongs('revival').length).toBeGreaterThan(50)
  })
})

describe('getSong', () => {
  it('returns slides in order with labels', () => {
    const all = songs.searchSongs('amazing')
    const detail = songs.getSong(all[0].id)!
    expect(detail.author).toBe('John Newton')
    expect(detail.slides.map((s) => s.label)).toEqual(['Verse 1', 'Chorus'])
  })
  it('numbers unlabeled slides as verses in sequence, counting through a chorus', () => {
    const all = songs.searchSongs('blessed assurance')
    const detail = songs.getSong(all[0].id)!
    expect(detail.slides.map((s) => s.label)).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Verse 3'])
  })
  it('returns null for an unknown id', () => {
    expect(songs.getSong(9999)).toBeNull()
  })
})

describe('importSongs', () => {
  it('imports a fixture file and dedupes on re-import', async () => {
    const fx = join(__dirname, '../fixtures/songs/doxology.txt')
    const r1 = await songs.importSongs([fx])
    // Plain text is a guessed structure, not explicit markup — it's queued
    // for review rather than committed straight through (see songs.ts).
    expect(r1.added).toHaveLength(0)
    expect(r1.needsReview).toHaveLength(1)
    expect(r1.needsReview[0].song.title).toBe('Doxology')
    const committed = songs.commitReviewedSong(r1.needsReview[0].song, r1.needsReview[0].originPath)
    expect(committed.title).toBe('Doxology')

    const r2 = await songs.importSongs([fx])
    expect(r2.added).toHaveLength(0)
    expect(r2.needsReview).toHaveLength(0)
    expect(r2.skipped).toBe(1)
  })

  it('a real .docx and a real .pdf both flow through to review, and a text-less PDF gets a friendly failure reason', async () => {
    const docx = join(__dirname, '../fixtures/songs/be-thou-my-vision.docx')
    const pdf = join(__dirname, '../fixtures/songs/holy-holy-holy.pdf')
    const blank = join(__dirname, '../fixtures/songs/blank-scanned.pdf')
    const r = await songs.importSongs([docx, pdf, blank])

    expect(r.needsReview.map((x) => x.song.title).sort()).toEqual(['Be Thou My Vision', 'Holy, Holy, Holy'])
    expect(r.failed).toHaveLength(1)
    expect(r.failed[0].file).toBe('blank-scanned.pdf')
    // The raw NO_TEXT_FOUND sentinel must never reach the operator directly —
    // friendlyParseError() turns it into the actionable "try pasting instead" message.
    expect(r.failed[0].error).toMatch(/scanned document/i)
    expect(r.failed[0].error).toMatch(/pasting/i)
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
