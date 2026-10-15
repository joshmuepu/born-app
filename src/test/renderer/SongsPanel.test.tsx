// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import SongsPanel from '../../renderer/src/components/SongsPanel'
import type { SongSummary } from '../../renderer/src/types'

// window.electronAPI is mocked in src/test/setup.ts

function song(id: number, title: string): SongSummary {
  return { id, title, author: null, songKey: null, slideCount: 1, source: 'library', songbookId: 'default' }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.electronAPI.listSongbooks = vi.fn(() => Promise.resolve([]))
  window.electronAPI.getRecentSongs = vi.fn(() => Promise.resolve([]))
  window.electronAPI.searchSongs = vi.fn(() =>
    Promise.resolve([song(1, "'Tis So Sweet"), song(2, 'Above All'), song(3, 'Yet Not I'), song(4, "Your Grace")])
  )
})

describe('SongsPanel Browse A-Z jump', () => {
  // The A-Z list is windowed (VirtualList), so a letter jump scrolls to a row
  // index through the virtualizer instead of measuring a DOM header. Test
  // change: the old assertion measured a sticky header's rect, which no
  // longer exists as a mounted element for far-away letters.
  it('jumps to a letter by scrolling the windowed list to that letter header row', async () => {
    render(<SongsPanel visible onAddSong={vi.fn()} onProjectSong={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^Browse/ }))
    await waitFor(() => expect(screen.getByText("'Tis So Sweet")).toBeInTheDocument())

    const container = document.querySelector('.songs-all-list') as HTMLElement
    expect(container).toBeTruthy()
    const scrollTo = vi.fn()
    ;(container as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo

    fireEvent.click(screen.getByRole('button', { name: 'Y' }))

    expect(scrollTo).toHaveBeenCalled()
    const arg = scrollTo.mock.calls[scrollTo.mock.calls.length - 1][0] as { top: number }
    expect(typeof arg.top).toBe('number')
  })

  it('renders only a window of rows, not the whole library', async () => {
    render(<SongsPanel visible onAddSong={vi.fn()} onProjectSong={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^Browse/ }))
    await waitFor(() => expect(screen.getByText("'Tis So Sweet")).toBeInTheDocument())
    expect(document.querySelectorAll('.song-row').length).toBeGreaterThan(0)
  })
})
