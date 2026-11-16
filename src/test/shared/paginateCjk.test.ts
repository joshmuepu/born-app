import { describe, it, expect } from 'vitest'
import { paginateText } from '../../shared/paginate'

describe('pages for Chinese and Japanese', () => {
  it('break at a sentence end, not mid-sentence', () => {
    const sentence = '神愛世人，甚至將他的獨生子賜給他們，叫一切信他的，不至滅亡，反得永生。'
    const pages = paginateText(sentence.repeat(8), 120)
    expect(pages.length).toBeGreaterThan(1)
    for (const p of pages.slice(0, -1)) expect(p.endsWith('。')).toBe(true)
    expect(pages.join('')).toBe(sentence.repeat(8))
  })
  it('never split a character (a surrogate pair) even with no break at all', () => {
    const text = '𠀀'.repeat(150) // characters outside the basic plane, two code units each, no spaces or punctuation
    for (const p of paginateText(text, 101)) {
      expect(/^[\uDC00-\uDFFF]/.test(p)).toBe(false)
      expect(/[\uD800-\uDBFF]$/.test(p)).toBe(false)
    }
  })
})
