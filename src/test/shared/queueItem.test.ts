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

  it('splits a long paragraph into projector-sized pages, with an a/b/c marker+citation on every page', () => {
    const long = '26 ' + 'This is a sentence that keeps going on and on. '.repeat(12)
    const item = quoteToItem({ ...quote, text: long, paragraphRef: '26' })
    expect(item.slides.length).toBeGreaterThan(1)
    expect(item.slides[0].marker).toBe('26a')
    expect(item.slides[1].marker).toBe('26b')
    for (const s of item.slides) {
      expect(s.text.length).toBeLessThanOrEqual(260)
    }
    expect(item.slides[0].reference).toBe('Come Follow Me · 63-0901M · 26a')
    expect(item.slides[1].reference).toBe('Come Follow Me · 63-0901M · 26b')
  })

  it('never combines two paragraphs onto the same slide within a range', () => {
    // Range "5-7": paragraph 5 is short (stays one slide); 6 and 7 are each
    // long enough to need their own extra page.
    const p5 = 'Paragraph five is short. '
    const p6 = '6 Paragraph six also runs on and on for a good while to fill more than one page here. '.repeat(3)
    const p7 = '7 And paragraph seven closes it out with plenty more words to spill onto another page. '.repeat(3)
    const item = quoteToItem({ ...quote, text: '5 ' + p5 + p6 + p7, paragraphRef: '5-7' })
    const refs = item.slides.map((s) => s.reference)

    // Every slide cites exactly one paragraph (optionally a/b/c-suffixed) —
    // never a combined range like "5-6", and never mixes two paragraphs'
    // text onto the same slide.
    for (const r of refs) expect(r).toMatch(/· \d+[a-z]?$/)
    expect(refs.some((r) => r.endsWith('· 5'))).toBe(true)
    expect(refs.some((r) => /· 6[a-z]?$/.test(r))).toBe(true)
    expect(refs.some((r) => /· 7[a-z]?$/.test(r))).toBe(true)

    // Paragraph 5's short text and paragraph 6's opening text never land on
    // the same slide.
    const p5Slide = item.slides.find((s) => s.text.includes('Paragraph five is short'))
    expect(p5Slide?.text.includes('Paragraph six')).toBe(false)
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
