// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useContextMenu, type MenuItem } from '../../renderer/src/components/ContextMenu'
import { quoteMenu, verseMenu, songMenu } from '../../renderer/src/contextMenus'
import { loadFavorites, toggleFavorite, favId } from '../../renderer/src/favorites'
import SavedPanel from '../../renderer/src/components/SavedPanel'
import type { AppActions } from '../../renderer/src/AppActions'
import type { Quote } from '../../renderer/src/types'

function Harness({ items }: { items: MenuItem[] }): JSX.Element {
  const ctx = useContextMenu()
  return (
    <div>
      <div data-testid="target" tabIndex={0} {...ctx.bind(items)}>
        row
      </div>
      {ctx.element}
    </div>
  )
}

const quote: Quote = {
  text: '12 In the beginning God made it',
  sermonTitle: 'Perfect Faith',
  dateCode: '63-0825E',
  sermonId: 7,
  paragraphIndex: 12,
  paragraphRef: '12'
}
const actions = (): AppActions => ({
  addNext: vi.fn(),
  openSermon: vi.fn(),
  openVerse: vi.fn(),
  openSong: vi.fn(),
  notify: vi.fn()
})

beforeEach(() => localStorage.clear())

describe('ContextMenu', () => {
  it('opens on right click, moves with arrows and runs the chosen item with Enter', async () => {
    const a = vi.fn()
    const b = vi.fn()
    render(<Harness items={[{ id: 'a', label: 'First', onSelect: a }, { id: 'b', label: 'Second', onSelect: b }]} />)
    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 20, clientY: 20 })
    expect(screen.getByRole('menu')).toBeDefined()
    const menu = screen.getByRole('menu')
    // nothing is highlighted on open, so an immediate Enter runs nothing
    fireEvent.keyDown(menu, { key: 'Enter' })
    expect(a).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeNull()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    fireEvent.keyDown(menu, { key: 'Enter' })
    expect(b).toHaveBeenCalledOnce()
    expect(a).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens from the keyboard (Menu key and Shift+F10)', () => {
    render(<Harness items={[{ id: 'a', label: 'First', onSelect: vi.fn() }]} />)
    const target = screen.getByTestId('target')
    fireEvent.keyDown(target, { key: 'ContextMenu' })
    expect(screen.getByRole('menu')).toBeDefined()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.keyDown(target, { key: 'F10', shiftKey: true })
    expect(screen.getByRole('menu')).toBeDefined()
  })

  it('swallows Escape so it can never reach the blackout shortcut', () => {
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    render(<Harness items={[{ id: 'a', label: 'First', onSelect: vi.fn() }]} />)
    fireEvent.contextMenu(screen.getByTestId('target'))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(onWindowKey).not.toHaveBeenCalled()
    window.removeEventListener('keydown', onWindowKey)
  })

  it('does not run a disabled item', async () => {
    const run = vi.fn()
    const user = userEvent.setup()
    render(<Harness items={[{ id: 'a', label: 'Nope', onSelect: run, disabled: true }, { id: 'b', label: 'Yes', onSelect: vi.fn() }]} />)
    fireEvent.contextMenu(screen.getByTestId('target'))
    await user.click(screen.getByText('Nope'))
    expect(run).not.toHaveBeenCalled()
  })
})

describe('menus and favorites', () => {
  it('quote menu offers project / queue / add-next / favorite / copy, and add-next carries the quote', () => {
    const a = actions()
    const items = quoteMenu(quote, { actions: a, project: vi.fn(), addToQueue: vi.fn() })
    expect(items.map((i) => i.id)).toEqual(['project', 'queue', 'next', 'open', 'favorite', 'copy', 'copytext'])
    items.find((i) => i.id === 'next')!.onSelect()
    expect(a.addNext).toHaveBeenCalledWith({ type: 'quote', quote })
  })

  it('verse and song menus add next by reference / id', () => {
    const a = actions()
    verseMenu({ reference: 'John 3:16', bookNum: 43, chapter: 3, verse: 16 }, { actions: a }).find((i) => i.id === 'next')!.onSelect()
    expect(a.addNext).toHaveBeenCalledWith({ type: 'bible', reference: 'John 3:16' })
    songMenu({ id: 5, title: 'Amazing Grace' }, { actions: a }).find((i) => i.id === 'next')!.onSelect()
    expect(a.addNext).toHaveBeenCalledWith({ type: 'song', songId: 5 })
  })

  it('favoriting toggles and persists locally', () => {
    const a = actions()
    const fav = quoteMenu(quote, { actions: a }).find((i) => i.id === 'favorite')!
    expect(fav.label).toMatch(/^Favorite/)
    fav.onSelect()
    expect(loadFavorites().map((f) => f.id)).toEqual([favId.sermon(7, '12')])
    expect(a.notify).toHaveBeenCalledWith('Added to favorites')
    // the label now offers removal
    expect(quoteMenu(quote, { actions: a }).find((i) => i.id === 'favorite')!.label).toMatch(/^Remove/)
    toggleFavorite(loadFavorites()[0])
    expect(loadFavorites()).toEqual([])
  })
})

describe('SavedPanel', () => {
  beforeEach(() => {
    window.electronAPI.getRecentSermons = vi.fn(() => Promise.resolve([]))
    window.electronAPI.getRecentBibleRefs = vi.fn(() => Promise.resolve([]))
    window.electronAPI.getRecentSongs = vi.fn(() => Promise.resolve([]))
  })

  it('lists favorites, opens one (navigation only) and can queue or remove it', async () => {
    toggleFavorite({ id: 'm:5', kind: 'song', title: 'Amazing Grace', subtitle: 'Song', songId: 5 })
    const onOpenSong = vi.fn()
    const onClose = vi.fn()
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <SavedPanel open onClose={onClose} onOpenSermon={vi.fn()} onOpenVerse={vi.fn()} onOpenSong={onOpenSong} onAddFavorite={onAdd} />
    )
    await user.click(screen.getByText('Amazing Grace'))
    expect(onOpenSong).toHaveBeenCalledWith(5)
    expect(onClose).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Add Amazing Grace to the queue/ }))
    expect(onAdd).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Remove Amazing Grace from favorites/ }))
    await waitFor(() => expect(loadFavorites()).toEqual([]))
  })

  it('shows an empty state that says how to add a favorite', () => {
    render(<SavedPanel open onClose={vi.fn()} onOpenSermon={vi.fn()} onOpenVerse={vi.fn()} onOpenSong={vi.fn()} onAddFavorite={vi.fn()} />)
    expect(screen.getByText(/Nothing starred yet/)).toBeDefined()
  })

  it('closes on Escape without letting it reach the blackout shortcut', async () => {
    const onClose = vi.fn()
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    render(<SavedPanel open onClose={onClose} onOpenSermon={vi.fn()} onOpenVerse={vi.fn()} onOpenSong={vi.fn()} onAddFavorite={vi.fn()} />)
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Favorites and recents'), { key: 'Escape' })
    })
    expect(onClose).toHaveBeenCalled()
    expect(onWindowKey).not.toHaveBeenCalled()
    window.removeEventListener('keydown', onWindowKey)
  })
})
