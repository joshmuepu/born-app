import { describe, it, expect } from 'vitest'
import { migrateQueue, quoteToItem, itemTitle, type Quote } from '../../shared/queueItem'
import { buildBibleSlides } from '../../shared/bibleSlides'

const quote: Quote = {
  text: 'By faith Abraham obeyed',
  sermonTitle: 'Come Follow Me',
  dateCode: '63-0901M',
  sermonId: 1,
  paragraphIndex: 1,
  paragraphRef: 'p1'
}

describe('migrateQueue', () => {
  it('wraps a legacy Quote[] as quote items with one slide each', () => {
    const out = migrateQueue([quote, quote])
    expect(out).toHaveLength(2)
    expect(out[0].kind).toBe('quote')
    expect(out[0].slides).toHaveLength(1)
    expect(out[0].slides[0].text).toBe(quote.text)
    expect(out[0].id).not.toBe(out[1].id)
  })

  it('passes through items already in the new shape', () => {
    const item = quoteToItem(quote)
    expect(migrateQueue([item])[0]).toBe(item)
  })

  it('drops junk entries and handles non-arrays', () => {
    expect(migrateQueue([null, 42, {}, quote])).toHaveLength(1)
    expect(migrateQueue('nope' as unknown)).toEqual([])
  })
})

describe('itemTitle', () => {
  it('describes each kind', () => {
    expect(itemTitle(quoteToItem(quote))).toBe('Come Follow Me')
  })
})

describe('quoteToItem', () => {
  it('pulls a leading paragraph number out of the text into the slide marker', () => {
    const item = quoteToItem({ ...quote, text: '146 But the five streams you see', paragraphRef: '146-147' })
    expect(item.slides[0].marker).toBe('146')
    expect(item.slides[0].text).toBe('But the five streams you see')
  })
  it('falls back to the paragraph ref when the text has no leading number', () => {
    const item = quoteToItem({ ...quote, text: 'By faith Abraham', paragraphRef: 'p1' })
    expect(item.slides[0].marker).toBe('p1')
    expect(item.slides[0].text).toBe('By faith Abraham')
  })

  it('splits a long paragraph into projector-sized pages, keeping the citation', () => {
    const long = '26 ' + 'This is a sentence that keeps going on and on. '.repeat(12)
    const item = quoteToItem({ ...quote, text: long, paragraphRef: '26' })
    expect(item.slides.length).toBeGreaterThan(1)
    expect(item.slides[0].marker).toBe('26')
    for (const s of item.slides) {
      expect(s.text.length).toBeLessThanOrEqual(260)
      expect(s.reference).toBe('Come Follow Me · 63-0901M · 26')
    }
  })

  it('cites the actual paragraph within a range as pages advance', () => {
    // Range "5-7": page-sized chunks with the inline numbers "6" and "7".
    const p5 = 'Paragraph five text that runs on for quite a while to fill a whole page here. '.repeat(3)
    const p6 = '6 Paragraph six also runs on and on for a good while to fill another page here. '.repeat(3)
    const p7 = '7 And paragraph seven closes it out with plenty more words to spill onto a third. '.repeat(3)
    const item = quoteToItem({ ...quote, text: '5 ' + p5 + p6 + p7, paragraphRef: '5-7' })
    const refs = item.slides.map((s) => s.reference)
    // first page cites 5 (or 5-6 if the "6" landed on it), last cites 7
    expect(refs[0]).toMatch(/· 5(-6)?$/)
    expect(refs[refs.length - 1]).toMatch(/· 7$/)
    // never cites the whole "5-7" range on a page that only shows one paragraph
    expect(refs.some((r) => /· 6$/.test(r) || /· 7$/.test(r))).toBe(true)
  })
})

describe('buildBibleSlides', () => {
  it('one slide per verse with a per-verse reference + marker', () => {
    const { slides, slideStarts } = buildBibleSlides(43, 3, 'KJV', [
      { verse: 16, text: 'For God so loved the world…' },
      { verse: 17, text: 'For God sent not his Son…' }
    ])
    expect(slides).toHaveLength(2)
    expect(slides[0].reference).toBe('John 3:16 · KJV')
    expect(slides[0].marker).toBe('16')
    expect(slides[1].marker).toBe('17')
    expect(slideStarts).toEqual([0, 1])
  })

  it('paginates a very long verse into a/b pages and tracks slide starts', () => {
    const long = 'word '.repeat(120).trim() // ~600 chars
    const { slides, slideStarts } = buildBibleSlides(19, 119, 'KJV', [
      { verse: 5, text: long },
      { verse: 6, text: 'short' }
    ])
    expect(slides.length).toBeGreaterThan(2)
    expect(slides[0].reference).toMatch(/Psalms 119:5a · KJV/)
    expect(slides[1].reference).toMatch(/Psalms 119:5b · KJV/)
    expect(slideStarts[0]).toBe(0)
    expect(slideStarts[1]).toBeGreaterThan(1)
    expect(slides[slideStarts[1]].reference).toBe('Psalms 119:6 · KJV')
  })
})
