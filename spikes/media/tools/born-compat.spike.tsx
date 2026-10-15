// @vitest-environment jsdom
// Spike 8: what do the REAL queue loader and the REAL queue UI do with an item kind they don't know?
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import ServiceQueue from '../../../src/renderer/src/components/ServiceQueue'
import { migrateQueue, itemTitle } from '../../../src/shared/queueItem'
import { stepForward } from '../../../src/shared/queueNav'

const song = { kind: 'song', id: 's1', songId: 1, title: 'Alpha', slides: [{ text: 'Verse' }] }
const youtubeWithSlides = { kind: 'youtube', id: 'y1', videoId: 'dQw4w9WgXcQ', title: 'How Great', slides: [{ text: 'YouTube: How Great (needs a newer Born Again)' }] }
const mediaNoSlides = { kind: 'media', id: 'm1', mediaId: 'm_1', name: 'Kenya.mp4' }
const noop = (): void => {}
const props = () => ({ playedIds: new Set<string>(), readingAhead: false, activeIndex: null, activeSlide: 0, onScreen: null, projectionOpen: false, stageOpen: false, blanked: false,
  onProject: vi.fn(), onSelect: noop, onRemove: noop, onPrev: async () => false, onNext: async () => false, onReorder: vi.fn(), onNewService: noop, onOpenService: noop,
  onImportService: noop, onSaveService: noop, recents: [], onOpenRecent: noop, onDropItem: vi.fn() })

describe('spike 8: unknown item kinds in a .born file (current v2 code; v1 main has the same migrateQueue)', () => {
  it('A. unknown kind WITH slides[] passes through migrateQueue untouched', () => {
    const out = migrateQueue([song, youtubeWithSlides])
    expect(out.length).toBe(2)
    expect((out[1] as { kind: string }).kind).toBe('youtube')
  })
  it('B. unknown kind WITHOUT slides[] is silently DROPPED (no message)', () => {
    const out = migrateQueue([song, mediaNoSlides])
    expect(out.length).toBe(1)
  })
  it('C. itemTitle() returns undefined for an unknown kind (switch has no default)', () => {
    const [, y] = migrateQueue([song, youtubeWithSlides])
    expect(itemTitle(y)).toBeUndefined()
  })
  it('D. stepping through the queue treats the unknown item as a normal slide holder', () => {
    const q = migrateQueue([song, youtubeWithSlides]) as never[]
    const pos = stepForward(q, { itemIndex: 0, slideIndex: 0 } as never)
    expect(pos).toEqual({ itemIndex: 1, slideIndex: 0 })
  })
  it('E0. control: the real ServiceQueue renders known kinds', () => {
    const { container } = render(<ServiceQueue {...props()} queue={migrateQueue([song]) as never[]} />)
    expect(container.querySelectorAll('.queue-row').length).toBe(1)
  })
  it('E. the real ServiceQueue with an unknown kind: does it throw?', () => {
    const q = migrateQueue([song, youtubeWithSlides]) as never[]
    let threw: string | null = null
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try { render(<ServiceQueue {...props()} queue={q} />) } catch (e) { threw = (e as Error).message.slice(0, 160) }
    spy.mockRestore()
    console.log('E_RESULT threw=' + JSON.stringify(threw))
    expect(threw).not.toBeNull() // DOCUMENTS the current (unsafe) behaviour: an unknown kind with slides[] crashes the queue render
  })
  // The proposed fix: serialize every new kind as a *compat shell* of a known kind (a quote row that reads as a
  // warning in an old app) carrying the real item under `ext`. A new reader promotes it back.
  const shell = { kind: 'quote', id: 'y1', slides: [{ text: 'This service has a YouTube video: How Great Is Our God. Open it in a newer Born Again.' }],
    quote: { text: 'This service has a YouTube video: How Great Is Our God. Open it in a newer Born Again.', sermonTitle: 'YouTube video (needs a newer Born Again)', dateCode: '', sermonId: -1, paragraphIndex: 0, paragraphRef: '' },
    ext: { v: 1, kind: 'youtube', videoId: 'dQw4w9WgXcQ', start: 12, end: 210 } }
  it('F. a compat shell survives migrateQueue, renders in the real queue, and keeps its payload', () => {
    const out = migrateQueue([song, shell])
    expect(out.length).toBe(2)
    expect((out[1] as unknown as { ext: { kind: string } }).ext.kind).toBe('youtube')
    const { container } = render(<ServiceQueue {...props()} queue={out as never[]} />)
    expect(container.querySelectorAll('.queue-row').length).toBe(2)
    console.log('F_ROW_TEXT=' + JSON.stringify(container.querySelectorAll('.queue-row')[1].textContent))
    expect(itemTitle(out[1])).toBe('YouTube video (needs a newer Born Again)')
  })
  it('G. the old app can step through it and re-save it without losing ext', () => {
    const out = migrateQueue([song, shell]) as never[]
    expect(stepForward(out, { itemIndex: 0, slideIndex: 0 } as never)).toEqual({ itemIndex: 1, slideIndex: 0 })
    const roundTrip = migrateQueue(JSON.parse(JSON.stringify(out)))
    expect((roundTrip[1] as unknown as { ext: unknown }).ext).toEqual(shell.ext)
  })
})
