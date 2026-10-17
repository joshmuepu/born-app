import { describe, it, expect } from 'vitest'
import { formatSince, liveSummary, slideTitle } from '../../renderer/src/liveSummary'
import type { LiveChannel, SlidePayload } from '../../renderer/src/types'

const slide = (label: string, reference?: string): SlidePayload => ({ text: 'x', label, reference } as SlidePayload)
const main = (current: SlidePayload | null): LiveChannel => ({ id: 'main', label: 'Main', current, next: null, blanked: false })

describe('what the Now dock says about the screens (P-05)', () => {
  it('says the screens are off when the projection window is closed, whatever else is true', () => {
    expect(liveSummary(main(slide('A')), false, false)).toEqual({ state: 'off' })
    expect(liveSummary(undefined, false, true)).toEqual({ state: 'off' })
  })
  it('names what is on air', () => {
    expect(liveSummary(main(slide('Psalm 23:1', 'KJV')), true, false)).toEqual({ state: 'live', title: 'Psalm 23:1 · KJV' })
  })
  it('says nothing is on screen when the screens are on and empty', () => {
    expect(liveSummary(main(null), true, false)).toEqual({ state: 'empty' })
    expect(liveSummary(undefined, true, false)).toEqual({ state: 'empty' })
  })
  it('says the screen is hidden, and what is kept for when it comes back', () => {
    expect(liveSummary(main(slide('Psalm 23:1', 'KJV')), true, true)).toEqual({ state: 'hidden', title: 'Psalm 23:1 · KJV' })
    expect(liveSummary(main(null), true, true)).toEqual({ state: 'hidden', title: '' })
  })
  it('falls back to "On screen" for an item with no label', () => {
    expect(liveSummary(main(slide('')), true, false)).toEqual({ state: 'live', title: 'On screen' })
  })
  it('slideTitle joins label and reference', () => {
    expect(slideTitle(slide('A', 'B'))).toBe('A · B')
    expect(slideTitle(null)).toBe('')
  })
  it('formats how long something has been on', () => {
    expect(formatSince(0)).toBe('0:00')
    expect(formatSince(42_000)).toBe('0:42')
    expect(formatSince(125_000)).toBe('2:05')
    expect(formatSince(3_723_000)).toBe('1:02:03')
    expect(formatSince(-5)).toBe('0:00')
  })
})
