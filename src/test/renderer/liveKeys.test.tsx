// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent } from '@testing-library/react'
import { installApi, renderApp, press } from './appHarness'

// Keys that changed the live screen by accident: Alt+←/→, a held arrow, Ctrl/⌘ or Shift with B, Ctrl+Space, ⌘/Ctrl+Enter away from the
// Sermons search, and Esc closing the Bible scope or status popover.

const verses = {
  kind: 'bible', id: 'b1', translation: 'KJV', reference: 'John 3:16-18', bookNum: 43, chapter: 3, verseStart: 16, verseEnd: 18,
  slides: [16, 17, 18].map((v) => ({ text: `Verse ${v}`, reference: `John 3:${v}` }))
}
const quote = { text: 'By faith Abraham obeyed', sermonTitle: 'Come Follow Me', dateCode: '63-0901M', sermonId: 1, paragraphIndex: 1, paragraphRef: 'p1' }

let api: Record<string, ReturnType<typeof vi.fn>>
beforeEach(() => {
  api = installApi({
    loadQueue: vi.fn(() => Promise.resolve([verses])),
    searchSermons: vi.fn(() => Promise.resolve([quote])),
    showSlide: vi.fn(),
    setBlankScreen: vi.fn()
  })
})
afterEach(() => cleanup())

const shown = (): string[] => api.showSlide.mock.calls.map((c) => c[0]?.text as string)
const settle = (): Promise<void> => act(async () => { await new Promise((r) => setTimeout(r, 30)) })
async function liveFirstVerse(): Promise<void> {
  await renderApp()
  await settle()
  ;(document.activeElement as HTMLElement | null)?.blur()
  await press('ArrowRight', { ctrlKey: true })
  await settle()
  expect(shown()).toEqual(['Verse 16'])
}

describe('stepping keys', () => {
  it('Alt+← / Alt+→ do not step the live slide', async () => {
    await liveFirstVerse()
    await press('ArrowRight', { altKey: true })
    await press('ArrowLeft', { altKey: true })
    await settle()
    expect(shown()).toEqual(['Verse 16'])
  })
  it('a held → steps once, not once per repeat', async () => {
    await liveFirstVerse()
    await press('ArrowRight')
    for (let i = 0; i < 5; i++) await press('ArrowRight', { repeat: true })
    await settle()
    expect(shown()).toEqual(['Verse 16', 'Verse 17'])
  })
  it('Ctrl+Space is not Next; plain Space still is', async () => {
    await liveFirstVerse()
    await press(' ', { ctrlKey: true })
    await settle()
    expect(shown()).toEqual(['Verse 16'])
    await press(' ')
    await settle()
    expect(shown()).toEqual(['Verse 16', 'Verse 17'])
  })
  it('Ctrl+B, ⌘B and Shift+B do not hide the screen; plain B does', async () => {
    await liveFirstVerse()
    await press('b', { ctrlKey: true })
    await press('b', { metaKey: true })
    await press('B', { shiftKey: true })
    await settle()
    expect(api.setBlankScreen).not.toHaveBeenCalled()
    await press('b')
    expect(api.setBlankScreen).toHaveBeenCalledWith(true)
  })
})

describe('⌘/Ctrl+Enter shows the top sermon result only from the Sermons search', () => {
  async function searched(): Promise<HTMLInputElement> {
    await renderApp()
    await settle()
    const box = document.getElementById('born-search-input') as HTMLInputElement
    fireEvent.change(box, { target: { value: 'faith' } })
    await press('Enter', {}, box)
    await settle()
    return box
  }
  it('from the search box it shows the top result', async () => {
    const box = await searched()
    await press('Enter', { ctrlKey: true }, box)
    await settle()
    expect(shown()).toEqual(['By faith Abraham obeyed'])
  })
  it('not from the Bible panel', async () => {
    await searched()
    await act(async () => { (document.querySelector('.panel-tab--bible') as HTMLElement).click() })
    await settle()
    ;(document.activeElement as HTMLElement | null)?.blur()
    await press('Enter', { ctrlKey: true })
    await settle()
    expect(shown()).toEqual([])
  })
  it('not when a list already used the key', async () => {
    const box = await searched()
    const used = (e: Event): void => e.preventDefault()
    box.addEventListener('keydown', used)
    await press('Enter', { ctrlKey: true }, box)
    box.removeEventListener('keydown', used)
    await settle()
    expect(shown()).toEqual([])
  })
})

describe('Esc closes the popover on top without hiding the screens', () => {
  it('the Bible scope popover', async () => {
    await liveFirstVerse()
    await act(async () => { (document.querySelector('.panel-tab--bible') as HTMLElement).click() })
    await settle()
    await act(async () => { (document.querySelector('.bible-scope-btn') as HTMLElement).click() })
    expect(document.querySelector('.bible-scope-popover')).not.toBeNull()
    await press('Escape')
    await settle()
    expect(document.querySelector('.bible-scope-popover')).toBeNull()
    expect(api.setBlankScreen).not.toHaveBeenCalled()
  })
  it('the status popover', async () => {
    await liveFirstVerse()
    await act(async () => { (document.querySelector('.status-trigger') as HTMLElement).click() })
    expect(document.querySelector('.status-popover')).not.toBeNull()
    await press('Escape')
    await settle()
    expect(document.querySelector('.status-popover')).toBeNull()
    expect(api.setBlankScreen).not.toHaveBeenCalled()
  })
})
