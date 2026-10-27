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

describe('Next / Back from an item saved with a range reference the library no longer has as one row', () => {
  const perPara = [
    { text: '10 Alpha opens.', sermonTitle: 'S', dateCode: '99-0101M', sermonId: 8, paragraphIndex: 0, paragraphRef: '10' },
    { text: '11 Charlie speaks.', sermonTitle: 'S', dateCode: '99-0101M', sermonId: 8, paragraphIndex: 1, paragraphRef: '11' },
    { text: '12 Delta closes.', sermonTitle: 'S', dateCode: '99-0101M', sermonId: 8, paragraphIndex: 2, paragraphRef: '12' },
    { text: '13 Echo next.', sermonTitle: 'S', dateCode: '99-0101M', sermonId: 8, paragraphIndex: 3, paragraphRef: '13' }
  ]
  it('Next from its end goes to the paragraph after the range; Back from its start to the one before', async () => {
    window.electronAPI.getSermonParagraphs = vi.fn(async () => perPara) as never
    const old = { kind: 'quote' as const, sermonId: 8, language: 'en', paragraphRef: '11-12', page: 0 }
    expect((await fetchAdjacentSlide({ ...old, page: 3 }, 'next', new Map()))?.slide.marker).toBe('13')
    expect((await fetchAdjacentSlide(old, 'prev', new Map()))?.slide.marker).toBe('10')
  })
})
