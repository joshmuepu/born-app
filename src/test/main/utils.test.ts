import { describe, it, expect } from 'vitest'
import { stripHtml, parseParagraphIndex } from '../../main/utils'

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
