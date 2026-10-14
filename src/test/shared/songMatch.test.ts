import { describe, it, expect } from 'vitest'
import {
  normalizeSongTitle,
  normalizeLyrics,
  lyricsSimilarity,
  matchSongs,
  type LibrarySongForMatch,
  type SongToMatch
} from '../../shared/songMatch'

describe('normalizeSongTitle', () => {
  it('ignores case, accents, punctuation and extra whitespace', () => {
    expect(normalizeSongTitle('Amazing Grace')).toBe(normalizeSongTitle('amazing  grace!'))
    expect(normalizeSongTitle('Amázing Gráce')).toBe(normalizeSongTitle('Amazing Grace'))
    expect(normalizeSongTitle('  How Great Thou Art  ')).toBe(normalizeSongTitle('How Great Thou Art'))
  })

  it('treats a genuinely different title as different', () => {
    expect(normalizeSongTitle('Amazing Grace')).not.toBe(normalizeSongTitle('How Great Thou Art'))
  })
})

describe('lyricsSimilarity', () => {
  it('is 1 for identical normalized text', () => {
    const a = normalizeLyrics([{ text: 'How sweet the sound' }])
    expect(lyricsSimilarity(a, a)).toBe(1)
  })

  it('is high for a one-word difference (near-identical, same song)', () => {
    const a = normalizeLyrics([{ text: 'Amazing grace how sweet the sound that saved a wretch like me' }])
    const b = normalizeLyrics([{ text: 'Amazing grace how sweet the sound that saved a soul like me' }])
    expect(lyricsSimilarity(a, b)).toBeGreaterThan(0.85)
  })

  it('is low for genuinely different lyrics under the same title', () => {
    const a = normalizeLyrics([{ text: 'Amazing grace how sweet the sound that saved a wretch like me' }])
    const b = normalizeLyrics([{ text: 'This is an entirely different song with completely unrelated words' }])
    expect(lyricsSimilarity(a, b)).toBeLessThan(0.5)
  })
})

function lib(id: number, title: string, lyrics: string): LibrarySongForMatch {
  return { id, title, normalizedTitle: normalizeSongTitle(title), normalizedLyrics: normalizeLyrics([{ text: lyrics }]) }
}

function song(key: string, title: string, lyrics: string, extra: Partial<SongToMatch> = {}): SongToMatch {
  return { key, title, slides: [{ text: lyrics }], ...extra }
}

describe('matchSongs', () => {
  it('links to the existing song when title and lyrics both match (ignoring case/accents/punctuation)', () => {
    const library = [lib(1, 'Amazing Grace', 'Amazing grace how sweet the sound')]
    const incoming = [song('q1', 'AMAZING GRACE!', 'amazing  grace, how sweet the sound.')]
    const [result] = matchSongs(incoming, library)
    expect(result).toEqual({ key: 'q1', status: 'matched', songId: 1 })
  })

  it('flags a conflict when the title matches but the lyrics are a real rewrite', () => {
    const library = [lib(1, 'Amazing Grace', 'Amazing grace how sweet the sound that saved a wretch like me')]
    const incoming = [
      song('q1', 'Amazing Grace', 'Completely different opening verse about something else entirely here')
    ]
    const [result] = matchSongs(incoming, library)
    expect(result.status).toBe('conflict')
    if (result.status === 'conflict') {
      expect(result.existingSongId).toBe(1)
      expect(result.existingTitle).toBe('Amazing Grace')
    }
  })

  it('treats the same lyrics under a different title as a new song, not a match — title must match too', () => {
    const library = [lib(1, 'Amazing Grace', 'How sweet the sound that saved a wretch like me')]
    const incoming = [song('q1', 'My Grace Song', 'How sweet the sound that saved a wretch like me')]
    const [result] = matchSongs(incoming, library)
    expect(result.status).toBe('new')
  })

  it('is new when nothing in the library shares the title at all', () => {
    const library = [lib(1, 'Amazing Grace', 'How sweet the sound')]
    const incoming = [song('q1', 'A Totally Different Song', 'Some other words entirely')]
    const [result] = matchSongs(incoming, library)
    expect(result.status).toBe('new')
  })

  it('matches against a bundled library song the same way as a user-added one — matchSongs has no concept of source', () => {
    const library = [lib(42, 'How Great Thou Art', 'O Lord my God when I in awesome wonder')]
    const incoming = [song('q1', 'how great thou art', 'O Lord my God when I in awesome wonder')]
    const [result] = matchSongs(incoming, library)
    expect(result).toEqual({ key: 'q1', status: 'matched', songId: 42 })
  })

  it('groups two occurrences of the same new song within one file under one groupId, so only one copy gets added', () => {
    const incoming = [
      song('q1', 'Brand New Song', 'Verse one of a song not in the library'),
      song('q2', 'Brand New Song', 'Verse one of a song not in the library')
    ]
    const results = matchSongs(incoming, [])
    expect(results[0].status).toBe('new')
    expect(results[1].status).toBe('new')
    if (results[0].status === 'new' && results[1].status === 'new') {
      expect(results[0].groupId).toBe(results[1].groupId)
    }
  })

  it('groups two occurrences of the same conflicting rewrite within one file under one groupId', () => {
    const library = [lib(1, 'Amazing Grace', 'Amazing grace how sweet the sound that saved a wretch like me')]
    const incoming = [
      song('q1', 'Amazing Grace', 'Our own completely rewritten version of this song with new words'),
      song('q2', 'Amazing Grace', 'Our own completely rewritten version of this song with new words')
    ]
    const results = matchSongs(incoming, library)
    expect(results[0].status).toBe('conflict')
    expect(results[1].status).toBe('conflict')
    if (results[0].status === 'conflict' && results[1].status === 'conflict') {
      expect(results[0].groupId).toBe(results[1].groupId)
    }
  })

  it('does not confuse two different new songs that happen to share a title into one group', () => {
    const incoming = [
      song('q1', 'Untitled', 'First completely unrelated set of lyrics about one subject'),
      song('q2', 'Untitled', 'Second entirely different set of lyrics about another subject')
    ]
    const results = matchSongs(incoming, [])
    expect(results[0].status).toBe('new')
    expect(results[1].status).toBe('new')
    if (results[0].status === 'new' && results[1].status === 'new') {
      expect(results[0].groupId).not.toBe(results[1].groupId)
    }
  })

  it('stays correct with a large library — performance check', () => {
    const library: LibrarySongForMatch[] = []
    for (let i = 0; i < 1200; i++) {
      library.push(lib(i, `Song Number ${i}`, `These are the lyrics for song number ${i} in the library`))
    }
    library.push(lib(9999, 'Amazing Grace', 'Amazing grace how sweet the sound that saved a wretch like me'))
    const incoming = [song('q1', 'Amazing Grace', 'Amazing grace how sweet the sound that saved a wretch like me')]

    const start = Date.now()
    const [result] = matchSongs(incoming, library)
    const elapsed = Date.now() - start

    expect(result).toEqual({ key: 'q1', status: 'matched', songId: 9999 })
    expect(elapsed).toBeLessThan(200)
  })
})
