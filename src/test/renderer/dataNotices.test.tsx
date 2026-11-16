// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react'
import { installApi, renderApp } from './appHarness'
import SongsPanel from '../../renderer/src/components/SongsPanel'

// A saved queue, settings or song library that could not be read must be said, with what to do, never shown as an empty list.

afterEach(() => cleanup())
const settle = (ms = 30): Promise<void> => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const notice = (): string => document.querySelector('.operator-notice')?.textContent ?? ''

describe('the operator is told when saved data could not be read', () => {
  it('a saved queue that could not be read', async () => {
    installApi({ getDataRecoveryInfo: vi.fn(() => Promise.resolve({ sermons: { recovered: false }, library: { recovered: false }, queue: { recovered: true, keptAs: 'queue.corrupt-x.json' } })) })
    await renderApp()
    await settle()
    expect(notice()).toMatch(/saved queue could not be read/)
    expect(notice()).toMatch(/Open data folder/)
  })
  it('settings that could not be read', async () => {
    installApi({ getDataRecoveryInfo: vi.fn(() => Promise.resolve({ sermons: { recovered: false }, library: { recovered: false }, settings: { recovered: true, keptAs: 'settings.corrupt-x.json', writeFailed: false } })) })
    await renderApp()
    await settle()
    expect(notice()).toMatch(/settings could not be read/)
  })
  it('a queue that could not be asked for: said, and what is added afterwards is still saved', async () => {
    let queueBible: ((x: unknown) => Promise<void>) | null = null
    const api = installApi({
      loadQueue: vi.fn(() => Promise.reject(new Error('not ready'))),
      saveQueue: vi.fn(),
      onWebRemoteQueueBible: vi.fn((cb: (x: unknown) => Promise<void>) => { queueBible = cb; return () => {} }),
      lookupPassage: vi.fn(() => Promise.resolve({ translation: 'KJV', reference: 'John 3:16', bookNum: 43, chapter: 3, verseStart: 16, verseEnd: 16, verses: [{ verse: 16, text: 'For God so loved the world' }], slides: [{ text: 'For God so loved the world', reference: 'John 3:16' }], slideStarts: [16] }))
    })
    await renderApp()
    await settle()
    expect(notice()).toMatch(/saved queue could not be read/)
    await act(async () => { await queueBible!({ reference: 'John 3:16', translation: 'KJV' }) })
    await settle()
    expect(api.saveQueue).toHaveBeenCalled()
  })
})

describe('Songs: a song library that could not be read', () => {
  it('says so in All Songs, instead of "Loading…" for ever', async () => {
    installApi({ searchSongs: vi.fn(() => Promise.reject(new Error('SQLITE_CANTOPEN'))), getRecentSongs: vi.fn(() => Promise.resolve([])) })
    render(<SongsPanel visible onScreen={null} focusSongId={null} onAddSong={vi.fn()} onProjectSong={vi.fn()} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^browse$/i })) })
    await settle()
    expect(screen.getByRole('alert').textContent).toMatch(/song library could not be read/)
    expect(screen.queryByText('Loading…')).toBeNull()
  })
  it('says so for a search, instead of "No songs found."', async () => {
    installApi({ searchSongs: vi.fn(() => Promise.reject(new Error('SQLITE_CANTOPEN'))), getRecentSongs: vi.fn(() => Promise.resolve([])) })
    render(<SongsPanel visible onScreen={null} focusSongId={null} onAddSong={vi.fn()} onProjectSong={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'grace' } })
    await settle(300)
    expect(screen.getByRole('alert').textContent).toMatch(/song library could not be read/)
    expect(screen.queryByText('No songs found.')).toBeNull()
  })
})
