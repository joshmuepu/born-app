import { describe, it, expect } from 'vitest'
import { paraLabel } from '../../renderer/src/components/SermonFollowView'

describe('what the reader calls each part of a sermon', () => {
  it('the opening title line reads "Title", never the internal "header"', () => {
    expect(paraLabel('header')).toBe('Title')
  })
  it('numbered paragraphs and pages are unchanged', () => {
    expect(paraLabel('12')).toBe('¶12')
    expect(paraLabel('12a')).toBe('¶12a')
    expect(paraLabel('§55#2')).toBe('Slide 3')
  })
})
