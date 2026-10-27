import { describe, it, expect } from 'vitest'
import { paginateText, MAX_SLIDE_CHARS } from '../../shared/paginate'

// synthetic: sentences that fill a page and then leave a few words over (the shape of 12,244 real paragraphs)
const sentence = (n: number): string => `Placeholder sentence number ${n} keeps the line going for a while.`.padEnd(77, '.')
// three sentences fill a page (about 233 characters), then two words are left over
const text = Array.from({ length: 3 }, (_, i) => sentence(i + 1)).join(' ') + ' Thank you.'

describe('a long paragraph never ends on a slide with a word or two', () => {
  it('the last slide is not an orphan: it holds a fair share of the text', () => {
    const pages = paginateText(text)
    expect(pages.length).toBeGreaterThan(1)
    const last = pages[pages.length - 1]
    expect(last.split(' ').length).toBeGreaterThan(3)
    expect(last.length).toBeGreaterThanOrEqual(60)
  })
  it('every slide still fits, no text is lost or reordered, and no word is cut', () => {
    const pages = paginateText(text)
    for (const p of pages) expect(p.length).toBeLessThanOrEqual(MAX_SLIDE_CHARS)
    expect(pages.join(' ')).toBe(text)
  })
  it('short text and text that already splits evenly are unchanged', () => {
    expect(paginateText('Short.')).toEqual(['Short.'])
    const even = Array.from({ length: 8 }, (_, i) => sentence(i + 1)).join(' ')
    const pages = paginateText(even)
    expect(pages.join(' ')).toBe(even)
    for (const p of pages) expect(p.length).toBeGreaterThan(100)
  })
})
