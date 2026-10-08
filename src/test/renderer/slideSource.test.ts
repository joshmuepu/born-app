import { describe, it, expect } from 'vitest'
import { slideSource } from '../../renderer/src/App'
import { quoteToItem } from '../../shared/queueItem'
import type { Quote } from '../../shared/queueItem'

const quote: Quote = {
  text: '173 Dear Heavenly Father, I am very thankful tonight. 174 Lord, bless this service.',
  sermonTitle: 'Come Follow Me',
  dateCode: '63-0901M',
  sermonId: 42,
  paragraphIndex: 0,
  paragraphRef: '173-174'
}

describe('slideSource', () => {
  it('uses the specific sub-paragraph of a merged range, not the whole range — a follow channel must not resolve 174 while this slide is 173', () => {
    const item = quoteToItem(quote)
    const p173 = item.slides.find((s) => s.text.includes('very thankful'))
    const p174 = item.slides.find((s) => s.text.includes('bless this service'))
    expect(p173).toBeDefined()
    expect(p174).toBeDefined()
    expect(slideSource(item, p173!)).toEqual({ kind: 'quote', sermonId: 42, paragraphRef: '173', page: 0 })
    expect(slideSource(item, p174!)).toEqual({ kind: 'quote', sermonId: 42, paragraphRef: '174', page: 0 })
  })

  it('falls back to the item paragraphRef for a slide that never got its own stamped ref', () => {
    const item = quoteToItem({ ...quote, text: 'By faith Abraham', paragraphRef: 'p1' })
    // Simulate an older/foreign slide shape with no paragraphRef of its own.
    const bareSlide = { ...item.slides[0], paragraphRef: undefined }
    expect(slideSource(item, bareSlide)).toEqual({ kind: 'quote', sermonId: 42, paragraphRef: 'p1', page: 0 })
  })

  it('resolves a flow-through-appended slide (a different paragraph than the item was queued with) to its own ref', () => {
    const item = quoteToItem(quote)
    // Flow-through (liveNav.ts advance()) appends a slide from an adjacent
    // paragraph onto the same item without touching item.quote.paragraphRef —
    // slideSource must key off the appended slide's own paragraphRef.
    const appended = { text: '175 Another paragraph entirely.', marker: '175', paragraphRef: '175' }
    expect(slideSource(item, appended)).toEqual({ kind: 'quote', sermonId: 42, paragraphRef: '175', page: 0 })
  })

  it('carries which page of a split paragraph this slide is, so a follow channel re-paginates to the same break', () => {
    const long = '26 ' + 'This is a sentence that keeps going on and on. '.repeat(12)
    const item = quoteToItem({ ...quote, text: long, paragraphRef: '26' })
    expect(item.slides.length).toBeGreaterThan(1)
    expect(slideSource(item, item.slides[0])).toEqual({ kind: 'quote', sermonId: 42, paragraphRef: '26', page: 0 })
    expect(slideSource(item, item.slides[1])).toEqual({ kind: 'quote', sermonId: 42, paragraphRef: '26', page: 1 })
  })
})
