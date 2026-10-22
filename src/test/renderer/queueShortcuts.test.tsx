// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup } from '@testing-library/react'
import { installApi, renderApp, press } from './appHarness'

// ⌘/Ctrl + →  walks the service queue: each press projects the next item and takes the source panel to it.
// If jumping to an item put the cursor into that panel's search box, the next press would be treated as typing and ignored.

const bible = (id: string, reference: string, verse: number): unknown => ({
  kind: 'bible', id, translation: 'KJV', reference, bookNum: 43, chapter: 3, verseStart: verse, verseEnd: verse,
  slides: [{ text: `Text of ${reference}`, reference }]
})
const song = (id: string, title: string, songId: number): unknown => ({
  kind: 'song', id, songId, title, slides: [{ text: `Verse of ${title}` }]
})

let api: Record<string, ReturnType<typeof vi.fn>>
beforeEach(() => {
  api = installApi({
    loadQueue: vi.fn(() => Promise.resolve([bible('b1', 'John 3:16', 16), song('s1', 'Amazing Grace', 7), bible('b2', 'John 3:17', 17), song('s2', 'Blessed Assurance', 9)])),
    getSong: vi.fn((id: number) => Promise.resolve({ id, title: id === 7 ? 'Amazing Grace' : 'Blessed Assurance', author: null, songKey: null, source: 'test', provenance: null, slides: [{ label: null, text: 'Verse' }] }))
  })
})
afterEach(() => cleanup())

describe('⌘/Ctrl+→ keeps walking the queue across different kinds of item', () => {
  it('projects every item in turn, however the source panel reacts', async () => {
    await renderApp()
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    ;(document.activeElement as HTMLElement | null)?.blur() // hands on the shortcut, not in a box
    const shown = (): string[] => (window.electronAPI as unknown as { showSlide: ReturnType<typeof vi.fn> }).showSlide.mock.calls.map((c) => c[0]?.text as string)
    for (let i = 0; i < 4; i++) {
      await press('ArrowRight', { ctrlKey: true, metaKey: true })
      await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    }
    expect(shown()).toEqual(['Text of John 3:16', 'Verse of Amazing Grace', 'Text of John 3:17', 'Verse of Blessed Assurance'])
  })
})
