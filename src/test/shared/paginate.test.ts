import { describe, it, expect } from 'vitest'
import { paginateText, MAX_SLIDE_CHARS } from '../../shared/paginate'

const wordCount = (s: string): number => s.split(/\s+/).filter(Boolean).length

describe('paginateText', () => {
  it('returns short text as a single page', () => {
    expect(paginateText('Short and sweet.')).toEqual(['Short and sweet.'])
  })

  it('returns [] for empty input', () => {
    expect(paginateText('')).toEqual([])
    expect(paginateText('   ')).toEqual([])
  })

  it('never splits a word across pages', () => {
    // long text with no sentence punctuation at all — must still break on spaces
    const text = ('quickly ' + 'because '.repeat(80)).trim()
    const pages = paginateText(text, 60)
    expect(pages.length).toBeGreaterThan(1)
    // every page is whole words, and rejoining is lossless
    for (const p of pages) expect(p).toMatch(/^(\S+ )*\S+$/)
    expect(pages.join(' ')).toBe(text)
    // no fragment of "because"
    for (const p of pages) {
      expect(p).not.toMatch(/\bbec$/)
      expect(p).not.toMatch(/^ause\b/)
    }
  })

  it('breaks at a sentence end when one sits in the back half of the window', () => {
    const first = 'A B C D E F G H I J K L M N O P. ' // sentence end ~32 chars in
    const second = 'then a good deal more text with no early breaks to force the split here now'
    const pages = paginateText(first + second, 60)
    expect(pages[0]).toBe(first.trim())
  })

  it('does NOT hard-cut just because the only sentence end is early', () => {
    // sentence end at char ~4, then a long run of words. The old code cut at
    // maxChars (mid-word); the fix must fall through to a space.
    const text = 'Go. ' + 'wanderingthoughts and more words here '.repeat(20)
    const pages = paginateText(text, 80)
    for (const p of pages) {
      expect(p).toMatch(/^(\S+ )*\S+$/) // whole words only
    }
    expect(pages.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' ').trim())
  })

  it('keeps every page at or under the cap (+ a little slack for the break char)', () => {
    const text = 'Sentence one is here. '.repeat(30).trim()
    for (const p of paginateText(text)) expect(p.length).toBeLessThanOrEqual(MAX_SLIDE_CHARS + 4)
  })

  it('loses no words for a realistic long paragraph', () => {
    const para =
      'Now, faith is the substance of things hoped for, the evidence of things not seen. ' +
      'And by it the elders obtained a good report. Through faith we understand that the worlds ' +
      'were framed by the word of God, so that things which are seen were not made of things which ' +
      'do appear. By faith Abel offered unto God a more excellent sacrifice than Cain, by which he ' +
      'obtained witness that he was righteous, God testifying of his gifts.'
    const pages = paginateText(para)
    expect(pages.length).toBeGreaterThan(1)
    expect(wordCount(pages.join(' '))).toBe(wordCount(para))
  })
})
