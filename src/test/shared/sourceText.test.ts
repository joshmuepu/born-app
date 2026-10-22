import { describe, it, expect } from 'vitest'
import { cleanSourceText } from '../../shared/sourceText'

const PUA = '' // the private-use symbol the sermon source puts at the start of many paragraphs

describe('cleanSourceText (display only)', () => {
  it('removes the symbol (and the space after it) from the start of a paragraph', () => {
    expect(cleanSourceText(`${PUA} Let us bow our heads.`)).toBe('Let us bow our heads.')
    expect(cleanSourceText(`${PUA}${PUA}Let us bow our heads.`)).toBe('Let us bow our heads.')
  })
  it('removes it in the middle too, without leaving a double space', () => {
    expect(cleanSourceText(`First part. ${PUA} Second part.`)).toBe('First part. Second part.')
  })
  it('text without the symbol comes back as the very same string, whatever else it contains', () => {
    for (const s of ['', 'Plain text.', '  keeps   its   spacing  ', 'Qué bueno — “quoted” … 🙏', 'שלום مرحبا', '<b>not html</b> & more']) {
      expect(cleanSourceText(s)).toBe(s)
    }
  })
  it('only touches the private-use range: neighbouring symbols stay', () => {
    expect(cleanSourceText(`a\uDFFF b${PUA}c  豈 �`)).toBe('a\uDFFF bc 豈 �')
  })
})
