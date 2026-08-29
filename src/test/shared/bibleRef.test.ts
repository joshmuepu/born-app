import { describe, it, expect } from 'vitest'
import { parseReference, isRefError, formatReference } from '../../shared/bibleRef'

const ok = (s: string) => {
  const r = parseReference(s)
  if (isRefError(r)) throw new Error(`expected ok for "${s}", got: ${r.error}`)
  return r
}

describe('parseReference', () => {
  it('single verse', () => {
    expect(ok('John 3:16')).toMatchObject({ bookNum: 43, chapter: 3, verseStart: 16, verseEnd: 16 })
  })

  it('verse range with hyphen and en-dash', () => {
    expect(ok('John 3:16-18')).toMatchObject({ verseStart: 16, verseEnd: 18 })
    expect(ok('John 3:16–18')).toMatchObject({ verseStart: 16, verseEnd: 18 })
    expect(ok('John 3:16 - 18')).toMatchObject({ verseStart: 16, verseEnd: 18 })
  })

  it('abbreviations', () => {
    expect(ok('Jn 3:16').bookNum).toBe(43)
    expect(ok('Ps 23').bookNum).toBe(19)
    expect(ok('1 Cor 13:4').bookNum).toBe(46)
    expect(ok('1cor 13:4').bookNum).toBe(46)
    expect(ok('II Tim 3:16').bookNum).toBe(55)
    expect(ok('Song of Solomon 2:1').bookNum).toBe(22)
  })

  it('whole chapter (no verse)', () => {
    expect(ok('Romans 8')).toMatchObject({ chapter: 8, verseStart: null, verseEnd: null })
    expect(ok('Psalm 119')).toMatchObject({ chapter: 119, verseStart: null })
  })

  it('single-chapter books treat a lone number as a verse', () => {
    expect(ok('Jude 3')).toMatchObject({ bookNum: 65, chapter: 1, verseStart: 3, verseEnd: 3 })
    expect(ok('Philemon 6')).toMatchObject({ bookNum: 57, chapter: 1, verseStart: 6 })
    expect(ok('3 John 4')).toMatchObject({ bookNum: 64, chapter: 1, verseStart: 4 })
  })

  it('rejects garbage', () => {
    expect(isRefError(parseReference(''))).toBe(true)
    expect(isRefError(parseReference('hello world'))).toBe(true)
    expect(isRefError(parseReference('Nonbook 3:16'))).toBe(true)
    expect(isRefError(parseReference('John'))).toBe(true)
  })

  it('rejects a backwards range', () => {
    expect(isRefError(parseReference('John 3:18-16'))).toBe(true)
  })
})

describe('formatReference', () => {
  it('round-trips', () => {
    expect(formatReference(ok('John 3:16'))).toBe('John 3:16')
    expect(formatReference(ok('jn 3:16-18'))).toBe('John 3:16–18')
    expect(formatReference(ok('Romans 8'))).toBe('Romans 8')
    expect(formatReference(ok('1 cor 13:4-7'))).toBe('1 Corinthians 13:4–7')
  })
})
