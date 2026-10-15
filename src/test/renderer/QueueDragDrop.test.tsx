// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ServiceQueue from '../../renderer/src/components/ServiceQueue'
import { QUEUE_DRAG_MIME } from '../../renderer/src/dragItem'
import type { QueueItem } from '../../renderer/src/types'

const song = (id: string, title: string): QueueItem =>
  ({ kind: 'song', id, songId: 1, title, slides: [{ text: `Verse of ${title}` }] }) as QueueItem

const noop = (): void => {}
function props(over: Record<string, unknown> = {}) {
  return {
    playedIds: new Set<string>(),
    readingAhead: false,
    activeIndex: null,
    activeSlide: 0,
    onScreen: null,
    projectionOpen: false,
    stageOpen: false,
    blanked: false,
    onProject: vi.fn(),
    onSelect: noop,
    onRemove: noop,
    onPrev: async () => false,
    onNext: async () => false,
    onReorder: vi.fn(),
    onNewService: noop,
    onOpenService: noop,
    onImportService: noop,
    onSaveService: noop,
    recents: [],
    onOpenRecent: noop,
    onDropItem: vi.fn(),
    ...over
  }
}

const payload = { type: 'bible', reference: 'John 3:16' }
const dt = (): Partial<DataTransfer> => ({
  types: [QUEUE_DRAG_MIME, 'text/plain'],
  getData: (t: string) => (t === QUEUE_DRAG_MIME ? JSON.stringify(payload) : ''),
  setData: vi.fn(),
  effectAllowed: 'copy'
})

const rows = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.queue-row'))

describe('queue drop targets and keyboard reorder', () => {
  it('drops an item from a browse pane at the slot before the row it lands on, without projecting', () => {
    const p = props()
    render(<ServiceQueue {...p} queue={[song('a', 'Alpha'), song('b', 'Beta'), song('c', 'Gamma')]} />)
    const target = rows()[1]
    fireEvent.dragOver(target, { dataTransfer: dt(), clientY: 0 })
    expect(target.classList.contains('queue-row--drop-before')).toBe(true)
    fireEvent.drop(target, { dataTransfer: dt(), clientY: 0 })
    expect(p.onDropItem).toHaveBeenCalledWith(payload, 1)
    expect(p.onProject).not.toHaveBeenCalled()
  })

  it('drops at the end when released below the last row', () => {
    const p = props()
    render(<ServiceQueue {...p} queue={[song('a', 'Alpha'), song('b', 'Beta')]} />)
    const list = document.querySelector('.queue-list') as HTMLElement
    fireEvent.dragOver(list, { dataTransfer: dt() })
    fireEvent.drop(list, { dataTransfer: dt() })
    expect(p.onDropItem).toHaveBeenCalledWith(payload, 2)
  })

  it('accepts a drop into an empty queue', () => {
    const p = props()
    render(<ServiceQueue {...p} queue={[]} />)
    const zone = document.querySelector('.queue-empty-drop') as HTMLElement
    fireEvent.dragOver(zone, { dataTransfer: dt() })
    fireEvent.drop(zone, { dataTransfer: dt() })
    expect(p.onDropItem).toHaveBeenCalledWith(payload, 0)
  })

  it('ignores drags that are not queue items (a file, selected text)', () => {
    const p = props()
    render(<ServiceQueue {...p} queue={[song('a', 'Alpha')]} />)
    const other = { types: ['Files'], getData: () => '' }
    fireEvent.drop(rows()[0], { dataTransfer: other })
    expect(p.onDropItem).not.toHaveBeenCalled()
  })

  it('moves the focused row with Alt+Arrow keys (the keyboard alternative to dragging)', () => {
    const p = props()
    render(<ServiceQueue {...p} queue={[song('a', 'Alpha'), song('b', 'Beta'), song('c', 'Gamma')]} />)
    fireEvent.keyDown(rows()[1], { key: 'ArrowDown', altKey: true })
    expect(p.onReorder).toHaveBeenCalledWith(1, 2)
    fireEvent.keyDown(rows()[1], { key: 'ArrowUp', altKey: true })
    expect(p.onReorder).toHaveBeenCalledWith(1, 0)
  })

  it('does not move past either end', () => {
    const p = props()
    render(<ServiceQueue {...p} queue={[song('a', 'Alpha'), song('b', 'Beta')]} />)
    fireEvent.keyDown(rows()[0], { key: 'ArrowUp', altKey: true })
    fireEvent.keyDown(rows()[1], { key: 'ArrowDown', altKey: true })
    expect(p.onReorder).not.toHaveBeenCalled()
  })
})
