import { describe, it, expect } from 'vitest'
import { hitParagraphs } from '../../shared/sermonHit'
import { quoteToItem } from '../../shared/queueItem'

// A stored row is a numbered RANGE of paragraphs, numbers written inline (synthetic placeholder text, the shape of the real library).
const row = {
  text: '10 Alpha opens the first part here. Bravo goes on with it. 11 Charlie speaks of the river today. 12 Delta closes. The river is wide.',
  sermonTitle: 'A Sample Message',
  dateCode: '99-0101M',
  sermonId: 7,
  paragraphIndex: 4,
  paragraphRef: '10-12',
  matchType: 'all' as const
}

describe('a search hit is the numbered paragraph that holds the term (not the whole stored range)', () => {
  it('one result per paragraph that matches, each with its own number and only its own text', () => {
    const hits = hitParagraphs(row, 'river', 'all')
    expect(hits.map((h) => h.paragraphRef)).toEqual(['11', '12'])
    expect(hits[0].text).toBe('11 Charlie speaks of the river today.')
    expect(hits[1].text).toBe('12 Delta closes. The river is wide.')
    expect(hits[0]).toMatchObject({ sermonId: 7, dateCode: '99-0101M', paragraphIndex: 4, matchType: 'all' })
  })
  it('a phrase only matches where the whole phrase is', () => {
    expect(hitParagraphs(row, 'the river is', 'phrase').map((h) => h.paragraphRef)).toEqual(['12'])
  })
  it('a row that is one paragraph, a book row (no number) or a term found nowhere comes back unchanged', () => {
    const one = { ...row, paragraphRef: '10', text: '10 Alpha river.' }
    expect(hitParagraphs(one, 'river', 'all')).toEqual([one])
    const book = { ...row, paragraphRef: '§55', text: 'A chapter of a book with the river.' }
    expect(hitParagraphs(book, 'river', 'all')).toEqual([book])
    expect(hitParagraphs(row, 'mountain', 'all')).toEqual([row])
  })
  it('the narrowed quote projects that paragraph only, opening on it', () => {
    const item = quoteToItem(hitParagraphs(row, 'river', 'all')[0])
    expect(item.slides.map((s) => s.marker)).toEqual(['11'])
    expect(item.slides[0].text).toBe('Charlie speaks of the river today.')
  })
})
