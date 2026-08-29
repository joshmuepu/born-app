// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { highlight, yearFromDateCode } from '../../renderer/src/highlight'

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
