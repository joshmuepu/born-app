// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ServiceQueue from '../../renderer/src/components/ServiceQueue'
import { migrateQueue, serializeItem, NEWER_VERSION_LABEL, UNREADABLE_LABEL, slideshowToItem } from '../../shared/queueItem'

const noop = (): void => {}
function props(over: Record<string, unknown> = {}) {
  return {
    playedIds: new Set<string>(), readingAhead: false, activeIndex: null, activeSlide: 0, onScreen: null,
    projectionOpen: true, stageOpen: false, blanked: false,
    onProject: vi.fn(), onSelect: vi.fn(), onRemove: vi.fn(), onPrev: async () => false, onNext: async () => false,
    onReorder: vi.fn(), onNewService: noop, onOpenService: noop, onImportService: noop, onSaveService: noop,
    recents: [], onOpenRecent: noop, onDropItem: vi.fn(), ...over
  }
}
const song = { kind: 'song', id: 's1', songId: 1, title: 'Alpha', slides: [{ text: 'Verse' }] }

describe('the real queue panel with unknown, malformed and media items', () => {
  it('renders every kind without throwing and labels the unusable ones', () => {
    const q = migrateQueue([
      song,
      { kind: 'hologram', id: 'h', slides: [{ text: 'x' }] },
      null,
      serializeItem({ kind: 'media', id: 'm1', slides: [], mediaId: 'm_1', mediaKind: 'image', name: 'Welcome' })
    ])
    render(<ServiceQueue {...props()} queue={q} />)
    expect(document.querySelectorAll('.queue-row')).toHaveLength(4)
    expect(screen.getByText(NEWER_VERSION_LABEL)).toBeTruthy()
    expect(screen.getByText(UNREADABLE_LABEL)).toBeTruthy()
    expect(screen.getAllByText('Welcome').length).toBeGreaterThan(0)
  })

  it('offers no Project button for them, and clicking a row stages nothing', () => {
    const p = props()
    const q = migrateQueue([{ kind: 'hologram', id: 'h', slides: [] }])
    render(<ServiceQueue {...p} queue={q} />)
    expect(screen.queryByText('Project')).toBeNull()
    fireEvent.click(document.querySelector('.queue-row') as HTMLElement)
    expect(p.onSelect).not.toHaveBeenCalled()
    expect(p.onProject).not.toHaveBeenCalled()
  })

  it('can still be removed and reordered', () => {
    const p = props()
    const q = migrateQueue([song, { kind: 'hologram', id: 'h', slides: [] }])
    render(<ServiceQueue {...p} queue={q} />)
    fireEvent.click(screen.getAllByText('Remove')[1])
    expect(p.onRemove).toHaveBeenCalledWith(1)
  })

  it('a picture row offers Project; a slideshow row offers fit, auto-advance and loop in its menu', () => {
    const p = props()
    const show = slideshowToItem([{ id: 'm_000000000001', name: 'A' }, { id: 'm_000000000002', name: 'B' }], 'Announcements')
    const onMediaSettings = vi.fn()
    render(<ServiceQueue {...p} onMediaSettings={onMediaSettings} queue={[show]} />)
    expect(screen.getByText('Project')).toBeTruthy()
    expect(screen.getByText(/2 pictures · by hand/)).toBeTruthy()
    fireEvent.contextMenu(document.querySelector('.queue-row') as HTMLElement)
    fireEvent.click(screen.getByText('Advance every 5 s'))
    expect(onMediaSettings).toHaveBeenCalledWith(0, { autoAdvanceSec: 5 })
  })
})
