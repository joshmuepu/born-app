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

  it('preserves a per-item source tag on an already-shaped item (an imported/saved file)', () => {
    const item = { ...quoteToItem(quote), source: { deviceId: 'dev-1', label: 'Song Leader' } }
    expect(migrateQueue([item])[0].source).toEqual({ deviceId: 'dev-1', label: 'Song Leader' })
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

  it('stamps each page of a split paragraph with its own page index', () => {
    // A follow channel re-paginates the whole paragraph's own text the same
    // deterministic way and needs to know which page to pick.
    const long = '26 ' + 'This is a sentence that keeps going on and on. '.repeat(12)
    const item = quoteToItem({ ...quote, text: long, paragraphRef: '26' })
    expect(item.slides.length).toBeGreaterThan(1)
    expect(item.slides[0].page).toBe(0)
    expect(item.slides[1].page).toBe(1)
    expect(item.slides[0].paragraphRef).toBe('26')
    expect(item.slides[1].paragraphRef).toBe('26')
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

  // Real cases found live in the actual sermon database — a range quote
  // whose own text doesn't literally start with its first paragraph's
  // number was previously never split at all (the stale leadMarker gate
  // rejected the hyphenated fallback ref before splitSubParagraphs ever
  // ran), even though every one of these genuinely spans multiple
  // paragraphs and splitSubParagraphs only ever needs to find lo+1's inline
  // marker, never lo's own.
  it('splits a range even when paragraph 1 is rendered as a decorative glyph instead of a literal "1"', () => {
    // Real case: sermon_id=2, paragraph_ref='1-4' — the source renders the
    // sermon's very first paragraph number as a private-use-area glyph
    // instead of the digit, affecting roughly half of all sermons' openings.
    const text = ' We’re getting some new gadgets for recording. 2 We hardly know each night what all is going to happen.'
    const item = quoteToItem({ ...quote, text, paragraphRef: '1-4' })
    const refs = item.slides.map((s) => s.reference)
    expect(refs.some((r) => r.endsWith('· 1'))).toBe(true)
    expect(refs.some((r) => /· 2[a-z]?$/.test(r))).toBe(true)
    const p1Slide = item.slides.find((s) => s.text.includes('new gadgets'))
    expect(p1Slide?.text.includes('We hardly know')).toBe(false)
  })

  it('splits a range whose stored text opens with trailing dialogue from before the first paragraph', () => {
    // Real case: sermon_id=48, paragraph_ref='91-92' — the stored text
    // starts with a bit of congregational back-and-forth before paragraph
    // 91 itself begins; this used to make leadMarker fall back to the
    // hyphenated ref ("91-92"), fail the old /^\d+$/ gate, and skip
    // splitting 91 from 92 entirely.
    const text = 'Shall we bow our heads. 91 Dear Heavenly Father, I am very thankful tonight. 92 Lord, bless this service.'
    const item = quoteToItem({ ...quote, text, paragraphRef: '91-92' })
    const refs = item.slides.map((s) => s.reference)
    expect(refs.some((r) => r.endsWith('· 91'))).toBe(true)
    expect(refs.some((r) => /· 92[a-z]?$/.test(r))).toBe(true)
    const p91Slide = item.slides.find((s) => s.text.includes('very thankful'))
    expect(p91Slide?.text.includes('bless this service')).toBe(false)
  })

  it('recognizes a paragraph that opens with a bracketed/parenthetical aside, not straight into prose', () => {
    // Real case: sermon_id=106, paragraph_ref='52-54' — "53 (Got your…)"
    // wasn't followed by a quote char or capital letter, so the old inline
    // regex missed it as a boundary — and because matching is strictly
    // sequential, that one miss also silently swallowed 54.
    const text =
      '52 And Jesus said unto them, believe. 53 (Got your pencil ready? How many missing?) Ninety-one. 54 Look on the back of the card now.'
    const item = quoteToItem({ ...quote, text, paragraphRef: '52-54' })
    const refs = item.slides.map((s) => s.reference)
    expect(refs.some((r) => r.endsWith('· 52'))).toBe(true)
    expect(refs.some((r) => /· 53[a-z]?$/.test(r))).toBe(true)
    expect(refs.some((r) => /· 54[a-z]?$/.test(r))).toBe(true)
  })

  it('recognizes a paragraph boundary immediately followed by another digit ("21st verse…")', () => {
    // Real case: sermon_id=211, paragraph_ref='210-211' — "211 21st verse of
    // the 3rd chapter" — the number after the paragraph marker, not a
    // capital letter or quote, so the old lookahead missed it.
    const text = '210 And prophets since the world began. 211 21st verse of the 3rd chapter of Saint Luke.'
    const item = quoteToItem({ ...quote, text, paragraphRef: '210-211' })
    const refs = item.slides.map((s) => s.reference)
    expect(refs.some((r) => r.endsWith('· 210'))).toBe(true)
    expect(refs.some((r) => /· 211[a-z]?$/.test(r))).toBe(true)
  })

  it('stamps each split sub-paragraph slide with its own paragraphRef, not the merged range', () => {
    // A follow channel resolves content by paragraphRef — if every slide of
    // a merged range carried the whole range, a channel following paragraph
    // 173 alone would receive 174's text mixed in too.
    const text = '173 Dear Heavenly Father, I am very thankful tonight. 174 Lord, bless this service.'
    const item = quoteToItem({ ...quote, text, paragraphRef: '173-174' })
    const p173 = item.slides.find((s) => s.text.includes('very thankful'))
    const p174 = item.slides.find((s) => s.text.includes('bless this service'))
    expect(p173?.paragraphRef).toBe('173')
    expect(p174?.paragraphRef).toBe('174')
  })

  it('stamps a slide with the one real paragraph it covers, even when the item ref names a wider range', () => {
    // paragraphRef is "146-147" but the text only actually contains 146 (no
    // inline "147" boundary found) — the slide's own ref must say "146", the
    // paragraph it truly covers, not the unresolved "146-147" range.
    const item = quoteToItem({ ...quote, text: '146 But the five streams you see', paragraphRef: '146-147' })
    expect(item.slides[0].paragraphRef).toBe('146')
  })

  it('stamps the no-leading-number fallback slide with the quote paragraphRef', () => {
    const item = quoteToItem({ ...quote, text: 'By faith Abraham', paragraphRef: 'p1' })
    expect(item.slides[0].paragraphRef).toBe('p1')
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
