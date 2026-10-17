// @vitest-environment jsdom
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ServiceQueue from '../../renderer/src/components/ServiceQueue'
import type { QueueItem } from '../../renderer/src/types'

function songItem(id: string, title: string, source?: { deviceId: string; label: string }): QueueItem {
  return {
    kind: 'song',
    id,
    songId: 1,
    title,
    slides: [{ text: `Verse 1 of ${title}` }],
    ...(source ? { source } : {})
  } as QueueItem
}

const noop = (): void => {}
const baseProps = {
  playedIds: new Set<string>(),
  readingAhead: false,
  activeIndex: null,
  activeSlide: 0,
  onScreen: null,
  projectionOpen: false,
  stageOpen: false,
  blanked: false,
  onProject: noop,
  onSelect: noop,
  onRemove: noop,
  onPrev: async () => false,
  onNext: async () => false,
  onReorder: noop,
  onNewService: noop,
  onOpenService: noop,
  onImportService: noop,
  onSaveService: noop,
  recents: [],
  onOpenRecent: noop
}

describe('ServiceQueue grouping', () => {
  it('shows no section headers when every item shares one source (including none at all)', () => {
    const queue = [songItem('a', 'How Great Thou Art'), songItem('b', 'Amazing Grace')]
    render(<ServiceQueue {...baseProps} queue={queue} />)
    expect(screen.queryByText('Added on desktop')).not.toBeInTheDocument()
    expect(screen.getByText('How Great Thou Art')).toBeInTheDocument()
  })

  it('groups items by contributor label, with untagged items under "Added on desktop"', () => {
    const queue = [
      songItem('a', 'How Great Thou Art', { deviceId: 'dev-1', label: 'Song Leader' }),
      songItem('b', 'Come Follow Me', { deviceId: 'dev-2', label: 'Preacher' }),
      songItem('c', 'Blessed Assurance', { deviceId: 'dev-1', label: 'Song Leader' }),
      songItem('d', 'Hear Ye Him')
    ]
    render(<ServiceQueue {...baseProps} queue={queue} />)
    expect(screen.getByText('Song Leader')).toBeInTheDocument()
    expect(screen.getByText('Preacher')).toBeInTheDocument()
    expect(screen.getByText('Added on desktop')).toBeInTheDocument()
  })

  it('renders the "Added on desktop" section last regardless of where untagged items sit', () => {
    const queue = [
      songItem('a', 'First', undefined),
      songItem('b', 'Second', { deviceId: 'dev-1', label: 'Song Leader' })
    ]
    render(<ServiceQueue {...baseProps} queue={queue} />)
    const labels = screen.getAllByText(/Song Leader|Added on desktop/).map((el) => el.textContent)
    expect(labels).toEqual(['Song Leader', 'Added on desktop'])
  })

  it('groups two different devices sharing the same label into one section', () => {
    const queue = [
      songItem('a', 'First', { deviceId: 'dev-1', label: 'Song Leader' }),
      songItem('b', 'Second', { deviceId: 'dev-2', label: 'Song Leader' }),
      songItem('c', 'Third', { deviceId: 'dev-3', label: 'Preacher' })
    ]
    render(<ServiceQueue {...baseProps} queue={queue} />)
    expect(screen.getAllByText('Song Leader')).toHaveLength(1)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('has an Import action alongside Open, both under the File menu', async () => {
    const onImportService = vi.fn()
    const onOpenService = vi.fn()
    const user = userEvent.setup()
    render(<ServiceQueue {...baseProps} queue={[songItem('a', 'Song')]} onImportService={onImportService} onOpenService={onOpenService} />)
    await user.click(screen.getByRole('button', { name: /^File/ }))
    await user.click(screen.getByRole('menuitem', { name: /Open a saved service/ }))
    expect(onOpenService).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^File/ }))
    await user.click(screen.getByRole('menuitem', { name: /Import into this service/ }))
    expect(onImportService).toHaveBeenCalled()
  })

  it('the File menu holds New, Open, Import, Save, Save with pictures and Open pack, in one button', async () => {
    const user = userEvent.setup()
    render(<ServiceQueue {...baseProps} queue={[songItem('a', 'Song')]} onSavePack={vi.fn()} onOpenPack={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull()
    await user.click(screen.getByRole('button', { name: /^File/ }))
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      expect.stringContaining('New service'), 'Open a saved service…', 'Import into this service…', 'Save', 'Save with pictures…', 'Open a service pack…'
    ])
  })

  it('Save and Save with pictures are off while the queue is empty', async () => {
    const user = userEvent.setup()
    render(<ServiceQueue {...baseProps} queue={[]} onSavePack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^File/ }))
    expect(screen.getByRole('menuitem', { name: 'Save' }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('menuitem', { name: 'Save with pictures…' }).getAttribute('aria-disabled')).toBe('true')
  })

  it('the readiness chip says what the last check found, and runs the check when pressed', async () => {
    const onPreflight = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<ServiceQueue {...baseProps} queue={[songItem('a', 'Song')]} onPreflight={onPreflight} readiness={null} />)
    await user.click(screen.getByRole('button', { name: /Is tonight ready/ }))
    expect(onPreflight).toHaveBeenCalledOnce()
    rerender(<ServiceQueue {...baseProps} queue={[songItem('a', 'Song')]} onPreflight={onPreflight} readiness={{ fail: 0, warn: 0 }} />)
    expect(screen.getByRole('button', { name: /Ready/ })).toBeTruthy()
    rerender(<ServiceQueue {...baseProps} queue={[songItem('a', 'Song')]} onPreflight={onPreflight} readiness={{ fail: 0, warn: 2 }} />)
    expect(screen.getByRole('button', { name: /2 to look at/ })).toBeTruthy()
    rerender(<ServiceQueue {...baseProps} queue={[songItem('a', 'Song')]} onPreflight={onPreflight} readiness={{ fail: 3, warn: 2 }} />)
    expect(screen.getByRole('button', { name: /3 to fix/ })).toBeTruthy()
  })
})
