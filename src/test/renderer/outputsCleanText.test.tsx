// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import ProjectionApp from '../../renderer/src/ProjectionApp'
import StageApp from '../../renderer/src/StageApp'
import ServiceQueue from '../../renderer/src/components/ServiceQueue'
import type { QueueItem } from '../../renderer/src/types'

// A service saved before the sermon text was cleaned still carries the source's private-use symbol (U+F6E1) in its slides.
// What is DRAWN must not show the empty box; the saved item itself is not touched.
const PUA = ''
const api = (): Record<string, ReturnType<typeof vi.fn>> => window.electronAPI as unknown as Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom has no layout; the fit hook only needs these to exist
  Element.prototype.scrollTo = vi.fn()
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe(): void {} disconnect(): void {} unobserve(): void {} }
})

describe('old saved text with the private-use symbol is drawn clean', () => {
  it('on the projector', async () => {
    let push!: (s: unknown) => void
    api().onShowSlide = vi.fn((cb: (s: unknown) => void) => { push = cb; return () => {} })
    render(<ProjectionApp />)
    const slide = { kind: 'quote', text: `${PUA} Let us bow our heads.`, reference: 'Test 00-0101' }
    await act(async () => { push(slide) })
    expect(screen.getByText('Let us bow our heads.')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(PUA)
    expect(slide.text).toBe(`${PUA} Let us bow our heads.`) // the slide payload itself is untouched
  })

  it('on the stage monitor (current and next)', async () => {
    let push!: (d: unknown) => void
    api().onStageUpdate = vi.fn((cb: (d: unknown) => void) => { push = cb; return () => {} })
    api().onStageSetBlank = vi.fn(() => () => {})
    api().onStageAlert = vi.fn(() => () => {})
    api().notifyStageReady = vi.fn()
    render(<StageApp />)
    await act(async () => {
      push({ current: { kind: 'quote', text: `${PUA} Current words.` }, next: { kind: 'quote', text: `${PUA} Next words.` } })
    })
    expect(document.body.textContent).toContain('Current words.')
    expect(document.body.textContent).toContain('Next words.')
    expect(document.body.textContent).not.toContain(PUA)
  })

  it('in a queue row preview', () => {
    const item = { kind: 'quote', id: 'q1', quote: { text: `${PUA} Row words.`, sermonTitle: 'Test', dateCode: '00-0101', sermonId: 1, paragraphIndex: 0, paragraphRef: '1' }, slides: [{ text: `${PUA} Row words.` }] } as unknown as QueueItem
    const noop = (): void => {}
    render(
      <ServiceQueue
        queue={[item]} playedIds={new Set()} readingAhead={false} activeIndex={null} activeSlide={0} onScreen={null} projectionOpen={false} stageOpen={false} blanked={false}
        onProject={noop} onSelect={noop} onRemove={noop} onPrev={async () => false} onNext={async () => false} onReorder={noop} onNewService={noop} onOpenService={noop}
        onImportService={noop} onSaveService={noop} recents={[]} onOpenRecent={noop}
      />
    )
    expect(document.body.textContent).toContain('Row words.')
    expect(document.body.textContent).not.toContain(PUA)
    expect(item.slides[0].text).toBe(`${PUA} Row words.`)
  })
})
