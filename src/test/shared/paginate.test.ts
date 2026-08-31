import { describe, it, expect } from 'vitest'
import { paginateText, MAX_SLIDE_CHARS } from '../../shared/paginate'

describe('paginateText', () => {
  it('returns short text as a single page', () => {
    expect(paginateText('Short and sweet.')).toEqual(['Short and sweet.'])
  })

  it('returns [] for empty input', () => {
    expect(paginateText('')).toEqual([])
    expect(paginateText('   ')).toEqual([])
  })

  it('splits long text into pages under the cap', () => {
    const text = 'Sentence number one is here. '.repeat(20).trim()
    const pages = paginateText(text)
    expect(pages.length).toBeGreaterThan(1)
    for (const p of pages) expect(p.length).toBeLessThanOrEqual(MAX_SLIDE_CHARS + 20)
    // nothing lost
    expect(pages.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '))
  })

  it('prefers to break at a sentence end within the window', () => {
    const first = 'Word '.repeat(30).trim() + '. ' // ~150 chars, ends with ". "
    const second = 'and then a good deal more text that pushes well past the two hundred character cap so a split is forced.'
    const pages = paginateText(first + second, 200)
    expect(pages[0].trim().endsWith('.')).toBe(true)
    expect(pages[0].trim()).toBe(first.trim())
  })

  it('respects a custom cap', () => {
    const pages = paginateText('one two three four five six seven eight nine ten', 20)
    expect(pages.length).toBeGreaterThan(1)
    for (const p of pages) expect(p.length).toBeLessThanOrEqual(24)
  })
})
