// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { installApi, renderApp, press } from './appHarness'
import BiblePanel from '../../renderer/src/components/BiblePanel'
import BrowsePanel from '../../renderer/src/components/BrowsePanel'
import SongKeyPicker from '../../renderer/src/components/SongKeyPicker'
import SongsPanel from '../../renderer/src/components/SongsPanel'

// The operator window with the keyboard and a screen reader: focus comes back after a dialog, Show / + Queue keep it, controls are named, rows open
// from the keyboard, the key picker is a popover, and blocked browser storage does not stop a panel.

afterEach(() => cleanup())
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })
const settle = (ms = 30): Promise<void> => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

describe('closing a dialog gives the keyboard back to what opened it', () => {
  it('the Message dialog', async () => {
    installApi({ outputsOpen: vi.fn(() => Promise.resolve({ projection: true, stage: false, blank: false })) })
    await renderApp()
    await settle()
    const btn = screen.getByRole('button', { name: 'Message' })
    btn.focus()
    await act(async () => { fireEvent.click(btn) })
    expect(document.activeElement).not.toBe(btn) // the dialog takes the keyboard for its text box
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) })
    await settle()
    expect(document.activeElement).toBe(btn)
  })
})

describe('the Bible panel', () => {
  const bibleApi = (): void => {
    const api = window.electronAPI as unknown as Record<string, unknown>
    api.getBibleTranslations = vi.fn(() => Promise.resolve([{ code: 'KJV', name: 'King James' }]))
    api.getRecentBibleRefs = vi.fn(() => Promise.resolve([]))
    api.searchBible = vi.fn(() => Promise.resolve({ kind: 'search', hits: [] }))
  }
  it('names its scope clear button and its search-mode switch, with which mode is on', async () => {
    installApi(); bibleApi()
    const { container } = render(<BiblePanel visible onAddPassage={vi.fn()} onProjectPassage={vi.fn()} onScreen={null} />)
    fireEvent.change(container.querySelector('input')!, { target: { value: 'faith hope' } })
    await settle()
    const group = screen.getByRole('group', { name: 'Search mode' })
    const pressed = [...group.querySelectorAll('button')].map((b) => b.getAttribute('aria-pressed'))
    expect(pressed.filter((x) => x === 'true')).toHaveLength(1)
    fireEvent.click(container.querySelector('.bible-scope-btn')!)
    fireEvent.click(screen.getByRole('button', { name: 'New Testament' }))
    expect(screen.getByRole('button', { name: 'Search the whole Bible again' })).toBeTruthy()
  })
  it('opens when browser storage is blocked', () => {
    installApi({ getBrowseSeries: vi.fn(() => Promise.resolve([])), getBrowseLocation: vi.fn(() => Promise.resolve([])), getBrowseDateTree: vi.fn(() => Promise.resolve({ years: [], undatedIds: [] })), getRecentSermons: vi.fn(() => Promise.resolve([])) }); bibleApi()
    const orig = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('blocked', 'SecurityError') } })
    try {
      expect(() => render(<BiblePanel visible onAddPassage={vi.fn()} onProjectPassage={vi.fn()} onScreen={null} />)).not.toThrow()
      expect(() => render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} onScreen={null} />)).not.toThrow()
    } finally {
      if (orig) Object.defineProperty(window, 'localStorage', orig)
    }
  })
})

describe('Browse > Location', () => {
  it('rows open from the keyboard', async () => {
    installApi({
      getBrowseSeries: vi.fn(() => Promise.resolve([])),
      getBrowseLocation: vi.fn(() => Promise.resolve([{ id: 1, name: 'Invented State', cities: [{ id: 5, name: 'Invented City', sermonIds: [40] }] }])),
      getBrowseDateTree: vi.fn(() => Promise.resolve({ years: [], undatedIds: [] }))
    })
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} onScreen={null} />)
    fireEvent.click(screen.getByRole('button', { name: /location/i }))
    const row = await waitFor(() => screen.getByRole('button', { name: /Invented State/ }))
    expect(row.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(row, { key: 'Enter' })
    await waitFor(() => expect(screen.getByRole('button', { name: /Invented City/ })).toBeTruthy())
  })
})

describe('the song key picker', () => {
  it('says it opens a popover, and the keyboard goes into it, to the chosen key', async () => {
    installApi({ getRecentKeys: vi.fn(() => Promise.resolve([])) })
    render(<SongKeyPicker songKey="G" onChange={() => {}} />)
    const btn = screen.getByRole('button', { name: /key of g/i })
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
    await act(async () => { fireEvent.click(btn) })
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('dialog', { name: 'Choose the key' })).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('G')
    expect(document.activeElement?.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('Show and + Queue keep the keyboard when used from the keyboard', () => {
  it('a song\'s Show button pressed with Enter (no mouse) keeps focus; a mouse click lets it go', async () => {
    installApi({
      getRecentSongs: vi.fn(() => Promise.resolve([])),
      getSong: vi.fn(() => Promise.resolve({ id: 1, title: 'Invented Song', author: null, songKey: null, source: 'import', provenance: null, slides: [{ label: 'Verse 1', text: 'Placeholder' }] }))
    })
    render(<SongsPanel visible onScreen={null} focusSongId={1} onAddSong={vi.fn()} onProjectSong={vi.fn()} />)
    await settle()
    const add = screen.getAllByRole('button').find((b) => /queue/i.test(b.textContent ?? '') && b.closest('.song-detail, .songs-detail, [class*="detail"]'))!
    add.focus()
    fireEvent.click(add, { detail: 0 })
    expect(document.activeElement).toBe(add)
    fireEvent.click(add, { detail: 1 })
    expect(document.activeElement).not.toBe(add)
  })
})
