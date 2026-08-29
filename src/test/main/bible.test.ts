import { describe, it, expect, beforeAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { initLibrarySchema } from '../../main/librarySchema'

const db = new Database(':memory:')
initLibrarySchema(db)

// Seed a tiny slice of scripture.
db.prepare('INSERT INTO bible_translations (code, name, sort_order) VALUES (?, ?, ?)').run(
  'KJV',
  'King James Version',
  1
)
const ins = db.prepare(
  'INSERT INTO bible_verses (translation, book, chapter, verse, text) VALUES (?, ?, ?, ?, ?)'
)
// John 3:16-18
ins.run('KJV', 43, 3, 16, 'For God so loved the world, that he gave his only begotten Son.')
ins.run('KJV', 43, 3, 17, 'For God sent not his Son into the world to condemn the world.')
ins.run('KJV', 43, 3, 18, 'He that believeth on him is not condemned.')
// Psalm 23:1
ins.run('KJV', 19, 23, 1, 'The LORD is my shepherd; I shall not want.')

vi.mock('../../main/libraryDb', () => ({ getLibraryDb: () => db }))
vi.mock('../../main/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

let bible: typeof import('../../main/bible')
beforeAll(async () => {
  bible = await import('../../main/bible')
})

describe('lookupPassage', () => {
  it('resolves a verse range into one slide per verse', () => {
    const r = bible.lookupPassage('John 3:16-18', 'KJV')
    expect('error' in r).toBe(false)
    if ('error' in r) return
    expect(r.reference).toBe('John 3:16–18')
    expect(r.verses.map((v) => v.verse)).toEqual([16, 17, 18])
    expect(r.slides).toHaveLength(3)
    expect(r.slides[0].reference).toBe('John 3:16 · KJV')
    expect(r.slideStarts).toEqual([0, 1, 2])
  })

  it('resolves a whole chapter reference', () => {
    const r = bible.lookupPassage('Psalm 23', 'KJV')
    expect('error' in r).toBe(false)
    if ('error' in r) return
    expect(r.verses[0].text).toMatch(/shepherd/)
  })

  it('errors on an unparseable reference', () => {
    expect(bible.lookupPassage('nonsense', 'KJV')).toHaveProperty('error')
  })

  it('errors when the passage is not in the DB', () => {
    expect(bible.lookupPassage('Genesis 1:1', 'KJV')).toHaveProperty('error')
  })

  it('falls back to KJV for an unknown translation', () => {
    const r = bible.lookupPassage('John 3:16', 'ZZZ')
    expect('error' in r).toBe(false)
    if ('error' in r) return
    expect(r.translation).toBe('KJV')
  })
})

describe('searchBible', () => {
  it('finds verses by phrase', () => {
    const hits = bible.searchBible('loved the world', 'KJV')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].reference).toBe('John 3:16')
  })

  it('returns [] for a too-short query', () => {
    expect(bible.searchBible('a', 'KJV')).toEqual([])
  })
})
