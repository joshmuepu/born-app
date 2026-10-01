import { describe, it, expect } from 'vitest'
import { stripHtml, parseParagraphIndex, isHeadingLike, mergeHeadingSections } from '../../main/utils'

describe('stripHtml', () => {
  it('removes simple tags', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello')
  })

  it('removes nested tags', () => {
    expect(stripHtml('<div><span>Hello <b>world</b></span></div>')).toBe('Hello world')
  })

  it('decodes HTML entities', () => {
    expect(stripHtml('faith &amp; hope')).toBe('faith & hope')
    expect(stripHtml('&lt;quote&gt;')).toBe('<quote>')
    expect(stripHtml('&quot;text&quot;')).toBe('"text"')
    expect(stripHtml('it&#39;s')).toBe("it's")
    expect(stripHtml('non&nbsp;breaking')).toBe('non breaking')
  })

  it('collapses whitespace', () => {
    expect(stripHtml('  hello   world  ')).toBe('hello world')
    expect(stripHtml('<p>  lots   of   spaces  </p>')).toBe('lots of spaces')
  })

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('')
  })

  it('handles string with no HTML', () => {
    expect(stripHtml('plain text')).toBe('plain text')
  })

  it('handles self-closing tags', () => {
    expect(stripHtml('line one<br/>line two')).toBe('line one line two')
  })

  it('handles attributes in tags', () => {
    expect(stripHtml('<span class="highlight" data-id="42">text</span>')).toBe('text')
  })

  it('handles typical sermon HTML', () => {
    const html = '<p class="paragraph">And the <b>Lord</b> said, &quot;Come.&quot;</p>'
    expect(stripHtml(html)).toBe('And the Lord said, "Come."')
  })
})

describe('parseParagraphIndex', () => {
  it('returns 0 for header', () => {
    expect(parseParagraphIndex('header')).toBe(0)
  })

  it('parses p1 through p9', () => {
    for (let i = 1; i <= 9; i++) {
      expect(parseParagraphIndex(`p${i}`)).toBe(i)
    }
  })

  it('parses multi-digit paragraph numbers', () => {
    expect(parseParagraphIndex('p42')).toBe(42)
    expect(parseParagraphIndex('p100')).toBe(100)
    expect(parseParagraphIndex('p999')).toBe(999)
  })

  it('returns 0 for unrecognised refs', () => {
    expect(parseParagraphIndex('intro')).toBe(0)
    expect(parseParagraphIndex('')).toBe(0)
    expect(parseParagraphIndex('para1')).toBe(0)
    expect(parseParagraphIndex('1')).toBe(0)
  })
})

describe('isHeadingLike', () => {
  // Real rows from "An Exposition of the Seven Church Ages" (sermon_index
  // ids 1386-1395, 5230) — every one of these is a genuine chapter/section
  // heading stored by the source as if it were an ordinary paragraph.
  const realHeadings = [
    'CHAPTER THREE',
    'THE EPHESIAN CHURCH AGE',
    'THE MESSAGE TO THE EPHESIAN CHURCH AGE Revelation 2:1-7',
    'THE MESSENGER',
    'THE CITY OF EPHESUS',
    'CONCLUSION',
    'Revelation 1:9-20',
    'AN EXPOSITION OF THE SEVEN CHURCH AGES',
    'INTRODUCTION',
    'A RESUME OF THE AGES'
  ]

  it('flags real Seven Church Ages chapter/section headings', () => {
    for (const h of realHeadings) expect(isHeadingLike(h)).toBe(true)
  })

  it('does not flag real body paragraphs, however short', () => {
    expect(isHeadingLike('Now it says that John was in the Spirit on the Lord’s Day.')).toBe(false)
    expect(isHeadingLike('That is right.')).toBe(false)
    expect(isHeadingLike('See?')).toBe(false)
    expect(isHeadingLike('Amen!')).toBe(false)
  })

  it('does not flag long text regardless of ending punctuation', () => {
    const long = 'Now, we want to speak now upon faith, and a different type of faith '.repeat(3)
    expect(isHeadingLike(long)).toBe(false)
  })

  it('handles empty/whitespace-only text', () => {
    expect(isHeadingLike('')).toBe(false)
    expect(isHeadingLike('   ')).toBe(false)
  })
})

describe('mergeHeadingSections', () => {
  it('merges a single leading heading into the next real paragraph', () => {
    const out = mergeHeadingSections([
      { ref: 'header', index: 0, text: 'CHAPTER THREE' },
      { ref: '', index: 0, text: 'Introduction to the Church Ages.' }
    ])
    expect(out).toHaveLength(1)
    expect(out[0].text).toBe('CHAPTER THREE\n\nIntroduction to the Church Ages.')
    // Keeps the real paragraph's own ref/index, not the heading's.
    expect(out[0].ref).toBe('')
  })

  it('stacks consecutive heading lines into one combined prefix', () => {
    const out = mergeHeadingSections([
      { text: 'AN EXPOSITION OF THE SEVEN CHURCH AGES' },
      { text: 'INTRODUCTION' },
      { text: 'Though this volume will concern itself with various major doctrines.' }
    ])
    expect(out).toHaveLength(1)
    expect(out[0].text).toBe(
      'AN EXPOSITION OF THE SEVEN CHURCH AGES\nINTRODUCTION\n\nThough this volume will concern itself with various major doctrines.'
    )
  })

  it('merges a heading wherever it appears, not just at the start', () => {
    const out = mergeHeadingSections([
      { text: 'Some real opening paragraph.' },
      { text: 'THE MESSENGER' },
      { text: 'A real paragraph about the messenger.' }
    ])
    expect(out).toHaveLength(2)
    expect(out[0].text).toBe('Some real opening paragraph.')
    expect(out[1].text).toBe('THE MESSENGER\n\nA real paragraph about the messenger.')
  })

  it('leaves normal sermon-shaped content completely unchanged', () => {
    const sections = [
      { text: 'Now, we want to speak now upon faith.' },
      { text: 'That is a great thing.' },
      { text: 'Thank you kindly.' }
    ]
    expect(mergeHeadingSections(sections)).toEqual(sections)
  })

  it('keeps a trailing heading with nothing after it rather than dropping it', () => {
    const out = mergeHeadingSections([{ text: 'Real paragraph.' }, { text: 'TRAILING HEADING' }])
    expect(out).toHaveLength(2)
    expect(out[1].text).toBe('TRAILING HEADING')
  })

  it('handles an empty input', () => {
    expect(mergeHeadingSections([])).toEqual([])
  })
})
