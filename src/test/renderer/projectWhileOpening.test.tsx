// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, cleanup } from '@testing-library/react'
import { installApi, renderApp } from './appHarness'

// With the projection window closed, Project on item A starts opening it (that takes a moment). Project on item B in that moment showed
// B, and then A, still waiting for the window, was put on screen over it: the congregation saw the older choice.
afterEach(() => cleanup())
const song = (id: string, title: string): unknown => ({ kind: 'song', id, songId: 0, title, slides: [{ text: `Verse of ${title}` }] })

describe('Project twice while the projection window is opening', () => {
  it('the last choice is what stays on screen', async () => {
    let finishOpening: () => void = () => {}
    let opened = false
    let project: (id: string) => void = () => {}
    const api = installApi({
      loadQueue: vi.fn(() => Promise.resolve([song('a', 'Invented Song A'), song('b', 'Invented Song B')])),
      openProjection: vi.fn(() => (opened ? Promise.resolve() : new Promise<void>((r) => { finishOpening = () => { opened = true; r() } }))),
      onWebRemoteProject: vi.fn((cb: (id: string) => void) => { project = cb; return () => {} })
    })
    await renderApp()
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    await act(async () => { project('a') })
    // the window exists now (main answers at once), but A's own wait is not over yet
    opened = true
    await act(async () => { project('b'); await new Promise((r) => setTimeout(r, 10)) })
    await act(async () => { finishOpening(); await new Promise((r) => setTimeout(r, 10)) })
    const shown = (window.electronAPI as unknown as { showSlide: ReturnType<typeof vi.fn> }).showSlide.mock.calls.map((c) => c[0]?.text as string)
    expect(shown[shown.length - 1]).toBe('Verse of Invented Song B')
    void api
  })
})
