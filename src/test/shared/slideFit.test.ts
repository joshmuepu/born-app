import { describe, it, expect } from 'vitest'
import { slideFitNotice, worstNotice, SMALL_TEXT_SHARE } from '../../shared/slideFit'
import { paginateText, MAX_SLIDE_CHARS } from '../../shared/paginate'

// The congregation screen shrinks a long slide to fit, down to a third of its size, and said nothing; a slide that still did not fit had its
// end cut off without a word. Under 3% of the screen height, or cut, the operator is now told.
describe('how a slide fits the congregation screen', () => {
  it('the threshold is 3% of the screen height', () => {
    expect(SMALL_TEXT_SHARE).toBe(0.03)
  })
  it('the longest bundled song page (32 px on a 1080-line screen, 2.96%) is very small; the next (38.4 px, 3.56%) is not', () => {
    expect(slideFitNotice(32, 1080, false)).toBe('small')
    expect(slideFitNotice(38.4, 1080, false)).toBeNull()
  })
  it('the same share is very small on a 4K screen and a 720-line projector', () => {
    expect(slideFitNotice(64, 2160, false)).toBe('small')
    expect(slideFitNotice(21.5, 720, false)).toBe('small')
    expect(slideFitNotice(80, 1080, false)).toBeNull()
  })
  it('cut text is said as cut, whatever its size', () => {
    expect(slideFitNotice(80, 1080, true)).toBe('cut')
    expect(slideFitNotice(20, 1080, true)).toBe('cut')
  })
  it('an item is marked by its worst slide', () => {
    expect(worstNotice([null, 'small', null])).toBe('small')
    expect(worstNotice(['small', 'cut'])).toBe('cut')
    expect(worstNotice([null])).toBeNull()
    expect(worstNotice(undefined)).toBeNull()
  })
  it('a very long verse is split into pages, so a Bible page never needs much shrinking', () => {
    const verse = Array.from({ length: 40 }, (_, i) => `and the ${i + 1}th part of a very long verse, which goes on`).join(' ') + '.'
    const pages = paginateText(verse)
    expect(pages.length).toBeGreaterThan(5)
    for (const p of pages) expect(p.length).toBeLessThanOrEqual(MAX_SLIDE_CHARS)
  })
})
