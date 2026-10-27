// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { fetchAdjacentSlide } from '../../renderer/src/liveNav'

// synthetic rows: a numbered range written inline, then the next row (the library's real shape)
const rows = [
  { text: '10 Alpha opens. 11 Charlie speaks of the river. 12 Delta closes the part.', sermonTitle: 'S', dateCode: '99-0101M', sermonId: 7, paragraphIndex: 0, paragraphRef: '10-12' },
  { text: '13 Echo starts the next row.', sermonTitle: 'S', dateCode: '99-0101M', sermonId: 7, paragraphIndex: 1, paragraphRef: '13' }
]

describe('Next / Back from a single paragraph shown from a search result (cut out of its stored range)', () => {
  window.electronAPI.getSermonParagraphs = vi.fn(async () => rows) as never
  const at = (ref: string) => ({ kind: 'quote' as const, sermonId: 7, language: 'en', paragraphRef: ref, page: 0 })
  it('Next goes to the following paragraph of the same row, then on into the next row', async () => {
    const cache = new Map()
    const a = await fetchAdjacentSlide(at('11'), 'next', cache)
    expect(a?.slide.marker).toBe('12')
    const b = await fetchAdjacentSlide(a!.cursor, 'next', cache)
    expect(b?.slide.marker).toBe('13')
  })
  it('Back goes to the paragraph before it in the row', async () => {
    const r = await fetchAdjacentSlide(at('11'), 'prev', new Map())
    expect(r?.slide.marker).toBe('10')
  })
  it('a number no row holds stops (no wrong paragraph)', async () => {
    expect(await fetchAdjacentSlide(at('99'), 'next', new Map())).toBeNull()
  })
})
