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
  it('scrolls the list by the exact distance between the container and the target letter header, not a sticky-unaware scrollIntoView', async () => {
    render(<SongsPanel visible onAddSong={vi.fn()} onProjectSong={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^Browse/ }))
    await waitFor(() => expect(screen.getByText("'Tis So Sweet")).toBeInTheDocument())

    const container = document.querySelector('.songs-all-list') as HTMLElement
    expect(container).toBeTruthy()

    // jsdom has no real layout engine — every element reports a 0-rect by
    // default, and Element.scrollIntoView is a no-op stub, so the pre-fix
    // scrollIntoView-based jump couldn't move scrollTop at all here. Mock
    // just enough geometry to simulate the sticky-overlap scenario the fix
    // addresses: the target letter's header sits 400px above the container's
    // own top edge, with the container currently scrolled to 100px.
    container.scrollTop = 100
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 0 } as DOMRect)
    const yHeader = [...container.querySelectorAll('div')].find((d) => d.textContent === 'Y') as HTMLElement
    expect(yHeader).toBeTruthy()
    vi.spyOn(yHeader, 'getBoundingClientRect').mockReturnValue({ top: 400 } as DOMRect)

    fireEvent.click(screen.getByRole('button', { name: 'Y' }))

    // 100 (prior scrollTop) + (400 - 0) (header top − container top) = 500.
    expect(container.scrollTop).toBe(500)
  })
})
