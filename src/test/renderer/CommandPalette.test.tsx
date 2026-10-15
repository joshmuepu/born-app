// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommandPalette, { type PaletteCommand } from '../../renderer/src/components/CommandPalette'

const base = {
  translation: 'KJV',
  onOpenSermon: vi.fn(),
  onOpenSong: vi.fn(),
  onOpenVerse: vi.fn()
}

function setup(commands: PaletteCommand[], open = true) {
  const onClose = vi.fn()
  const utils = render(<CommandPalette open={open} onClose={onClose} commands={commands} {...base} />)
  return { onClose, ...utils }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.electronAPI.lookupPassage = vi.fn(() => Promise.resolve({ error: 'not a reference' }))
  window.electronAPI.searchSermons = vi.fn(() => Promise.resolve([]))
  window.electronAPI.searchSongs = vi.fn(() => Promise.resolve([]))
  window.electronAPI.searchBible = vi.fn(() => Promise.resolve([]))
})

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    const { container } = setup([], false)
    expect(container.firstChild).toBeNull()
  })

  it('lists actions and filters them as you type', async () => {
    const user = userEvent.setup()
    setup([
      { id: 'a', label: 'Go to Bible', run: vi.fn() },
      { id: 'b', label: 'Turn on high contrast', keywords: 'accessibility', run: vi.fn() }
    ])
    expect(screen.getByText('Go to Bible')).toBeDefined()
    expect(screen.getByText('Turn on high contrast')).toBeDefined()
    await user.type(screen.getByRole('combobox'), 'access')
    expect(screen.queryByText('Go to Bible')).toBeNull()
    expect(screen.getByText('Turn on high contrast')).toBeDefined()
  })

  it('runs the highlighted action on Enter and closes', async () => {
    const user = userEvent.setup()
    const run = vi.fn()
    const { onClose } = setup([{ id: 'a', label: 'Go to Songs', run }])
    await user.keyboard('{Enter}')
    expect(onClose).toHaveBeenCalled()
    expect(run).toHaveBeenCalledOnce()
  })

  it('moves with the arrow keys', async () => {
    const user = userEvent.setup()
    const first = vi.fn()
    const second = vi.fn()
    setup([
      { id: 'a', label: 'First', run: first },
      { id: 'b', label: 'Second', run: second }
    ])
    await user.keyboard('{ArrowDown}{Enter}')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })

  it('closes on Escape without running anything', async () => {
    const user = userEvent.setup()
    const run = vi.fn()
    const { onClose } = setup([{ id: 'a', label: 'Go to Songs', run }])
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('finds a verse reference and opens it (navigation only)', async () => {
    window.electronAPI.lookupPassage = vi.fn(() =>
      Promise.resolve({
        reference: 'John 3:16',
        translation: 'KJV',
        bookNum: 43,
        chapter: 3,
        verseStart: 16,
        verseEnd: 16,
        verses: [{ verse: 16, text: 'For God so loved the world' }],
        slides: [],
        slideStarts: []
      })
    )
    const user = userEvent.setup()
    setup([])
    await user.type(screen.getByRole('combobox'), 'John 3:16')
    await waitFor(() => expect(screen.getByText(/John 3:16 · KJV/)).toBeDefined())
    await user.keyboard('{Enter}')
    expect(base.onOpenVerse).toHaveBeenCalledWith({ bookNum: 43, chapter: 3, verse: 16 })
  })

  it('shows sermon and song matches from one query', async () => {
    window.electronAPI.searchSermons = vi.fn(() =>
      Promise.resolve([
        { text: 'Grace is free', sermonTitle: 'Grace', dateCode: '60-0101', sermonId: 5, paragraphIndex: 1, paragraphRef: '12' }
      ])
    )
    window.electronAPI.searchSongs = vi.fn(() =>
      Promise.resolve([{ id: 9, title: 'Amazing Grace' }])
    )
    const user = userEvent.setup()
    setup([])
    await user.type(screen.getByRole('combobox'), 'grace')
    await waitFor(() => expect(screen.getByText('Amazing Grace')).toBeDefined())
    expect(screen.getByText(/60-0101/)).toBeDefined()
    await user.click(screen.getByText('Amazing Grace'))
    expect(base.onOpenSong).toHaveBeenCalledWith(9)
  })
})
