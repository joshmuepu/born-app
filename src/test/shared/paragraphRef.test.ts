import { describe, it, expect } from 'vitest'
import { parseParagraphRef, refsOverlap } from '../../shared/paragraphRef'

describe('parseParagraphRef', () => {
  it('parses single and range refs', () => {
    expect(parseParagraphRef('26')).toEqual([26, 26])
    expect(parseParagraphRef('41-47')).toEqual([41, 47])
    expect(parseParagraphRef('2–4')).toEqual([2, 4])
    expect(parseParagraphRef(' 8 - 10 ')).toEqual([8, 10])
  })
  it('returns null for non-numeric', () => {
    expect(parseParagraphRef('header')).toBeNull()
    expect(parseParagraphRef('')).toBeNull()
  })
})

describe('refsOverlap', () => {
  it('matches a page ref against its source range', () => {
    expect(refsOverlap('43', '41-47')).toBe(true)
    expect(refsOverlap('43-45', '41-47')).toBe(true)
    expect(refsOverlap('41', '41-47')).toBe(true)
    expect(refsOverlap('47', '41-47')).toBe(true)
  })
  it('rejects non-overlapping ranges', () => {
    expect(refsOverlap('48', '41-47')).toBe(false)
    expect(refsOverlap('40', '41-47')).toBe(false)
    expect(refsOverlap('48-50', '41-47')).toBe(false)
  })
  it('exact string match always wins (incl. non-numeric)', () => {
    expect(refsOverlap('header', 'header')).toBe(true)
    expect(refsOverlap('26', '26')).toBe(true)
  })
})
