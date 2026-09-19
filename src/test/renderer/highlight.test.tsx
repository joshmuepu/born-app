// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { highlight, yearFromDateCode, findMatchingSlideIndex } from '../../renderer/src/highlight'

const html = (node: ReturnType<typeof highlight>): string =>
  renderToStaticMarkup(<>{node}</>)

describe('highlight', () => {
  it('marks the full phrase and significant words', () => {
    const out = html(highlight('We received the Holy Spirit by faith today.', 'holy spirit'))
    expect(out).toContain('<mark class="hl">Holy Spirit</mark>')
  })

  it('does not highlight stopwords like "the" on their own', () => {
    const out = html(highlight('the man and the woman', 'the holy spirit'))
    expect(out).not.toContain('<mark')
  })

  it('does not highlight partial words (there / they)', () => {
    const out = html(highlight('There they were, faithfully waiting.', 'faith'))
    expect(out).not.toContain('<mark')
  })

  it('matches case-insensitively', () => {
    const out = html(highlight('FAITH moves mountains', 'faith'))
    expect(out).toContain('<mark class="hl">FAITH</mark>')
  })

  it('returns the text unchanged when the query is empty', () => {
    expect(highlight('untouched', '')).toBe('untouched')
    expect(highlight('untouched', undefined)).toBe('untouched')
  })
})

describe('findMatchingSlideIndex', () => {
  const slides = [
    'In the beginning God created the heavens and the earth.',
    'And the earth was without form, and void; and darkness was upon the face of the deep.',
    'And God said, Let there be faith among the people, and it was so.',
    'And God saw that it was good.'
  ]

  it('finds the slide that actually contains the searched word, not the first one', () => {
    expect(findMatchingSlideIndex(slides, 'faith')).toBe(2)
  })

  it('returns 0 when the query matches the first slide', () => {
    expect(findMatchingSlideIndex(slides, 'beginning')).toBe(0)
  })

  it('matches a multi-word phrase against the slide that contains it', () => {
    expect(findMatchingSlideIndex(slides, 'without form')).toBe(1)
  })

  it('falls back to 0 when nothing matches', () => {
    expect(findMatchingSlideIndex(slides, 'xyzzy')).toBe(0)
  })

  it('falls back to 0 for an empty query', () => {
    expect(findMatchingSlideIndex(slides, '')).toBe(0)
    expect(findMatchingSlideIndex(slides, undefined)).toBe(0)
  })

  it('matches case-insensitively', () => {
    expect(findMatchingSlideIndex(slides, 'FAITH')).toBe(2)
  })
})

describe('yearFromDateCode', () => {
  it('expands a Branham date code to a 4-digit year', () => {
    expect(yearFromDateCode('63-0825E')).toBe('1963')
    expect(yearFromDateCode('54-0103')).toBe('1954')
  })

  it('passes through anything that is not a date code', () => {
    expect(yearFromDateCode('')).toBe('')
    expect(yearFromDateCode('n/a')).toBe('n/a')
  })
})
