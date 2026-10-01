// @vitest-environment jsdom
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

  it('renders an Import action alongside Open', () => {
    const onImportService = vi.fn()
    render(
      <ServiceQueue {...baseProps} queue={[songItem('a', 'Song')]} onImportService={onImportService} />
    )
    screen.getByText('Import').click()
    expect(onImportService).toHaveBeenCalled()
  })
})
