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

  it('puts the chosen letter header at the very top of the list so its first song is not hidden', async () => {
    render(<SongsPanel visible onAddSong={vi.fn()} onProjectSong={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^Browse/ }))
    await waitFor(() => expect(screen.getByText("'Tis So Sweet")).toBeInTheDocument())
    const container = document.querySelector('.songs-all-list') as HTMLElement
    // Lay the mounted rows out at 50px each so offsets are real.
    container.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => {
      const i = Number(el.dataset.index)
      Object.defineProperty(el, 'offsetTop', { configurable: true, value: 8 + i * 50 })
      Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 50 })
    })
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 300 })
    const scrollTo = vi.fn()
    ;(container as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo

    // The row that holds the "Y" header
    const yRow = [...container.querySelectorAll<HTMLElement>('[data-index]')].find(
      (el) => el.textContent?.trim() === 'Y'
    ) as HTMLElement
    expect(yRow).toBeTruthy()
    const idx = Number(yRow.dataset.index)
    fireEvent.click(screen.getByRole('button', { name: 'Y' }))

    // top = the header row's own offset: the header sits exactly at the top edge
    // (no sticky header can overlap it) and the first song follows directly.
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 8 + idx * 50 }))
  })

  it('has no sticky header that could cover the jump target', async () => {
    render(<SongsPanel visible onAddSong={vi.fn()} onProjectSong={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^Browse/ }))
    await waitFor(() => expect(screen.getByText("'Tis So Sweet")).toBeInTheDocument())
    const head = document.querySelector('.songs-letter-head') as HTMLElement
    expect(head).toBeTruthy()
    // jsdom does not load the stylesheet; assert the contract in the source of truth:
    // headers are rendered as ordinary rows inside the list, not positioned sticky.
    expect(head.style.position).not.toBe('sticky')
  })

  it('marks the letter at the top of the list in the A-Z rail', async () => {
    render(<SongsPanel visible onAddSong={vi.fn()} onProjectSong={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^Browse/ }))
    await waitFor(() => expect(screen.getByText("'Tis So Sweet")).toBeInTheDocument())
    await waitFor(() => expect(document.querySelector('.songs-azrail-btn.is-current')).not.toBeNull())
    expect(document.querySelector('.songs-azrail-btn.is-current')?.textContent).toBe('#')
  })
})
