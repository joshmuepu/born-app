// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, act, fireEvent, cleanup } from '@testing-library/react'
import { installApi, renderApp, press } from './appHarness'

// Esc is the operator's "blank the screens" key. When it is pressed to close something that is open on top
// (the manual, the Remote or Screens popover, the Import menu, the key picker) or to clear a search box that
// has text in it, it must do only that — not also black out the congregation screens.

let api: Record<string, ReturnType<typeof vi.fn>>
beforeEach(() => { api = installApi() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function openProjection(): Promise<void> {
  // ⌘/Ctrl+Shift+W opens the projection window (openProjection is mocked)
  await press('W', { metaKey: true, ctrlKey: true, shiftKey: true }, document.body)
  expect(api.openProjection ?? (window.electronAPI as unknown as Record<string, unknown>).openProjection).toBeDefined()
}
const blankCalls = (): number => ((window.electronAPI as unknown as { setBlankScreen: ReturnType<typeof vi.fn> }).setBlankScreen.mock.calls.length)

describe('Esc with nothing open still blanks (unchanged)', () => {
  it('blanks the screens', async () => {
    await renderApp()
    await openProjection()
    const before = blankCalls()
    await press('Escape', {}, document.body)
    expect(blankCalls()).toBe(before + 1)
  })
})

describe('Esc that closes something on top does not also blank', () => {
  it('Remote popover', async () => {
    await renderApp()
    await openProjection()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /remote/i })) })
    expect(document.querySelector('.remote-popover')).not.toBeNull()
    const before = blankCalls()
    await press('Escape', {}, document.body)
    expect(document.querySelector('.remote-popover')).toBeNull()
    expect(blankCalls()).toBe(before)
  })

  it('the manual (F1)', async () => {
    await renderApp()
    await openProjection()
    await press('F1', {}, document.body)
    expect(document.querySelector('.help-modal')).not.toBeNull()
    const before = blankCalls()
    await press('Escape', {}, document.body)
    expect(document.querySelector('.help-modal')).toBeNull()
    expect(blankCalls()).toBe(before)
  })

  it('Shift+Esc still blanks with a popover open (panic key)', async () => {
    await renderApp()
    await openProjection()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /remote/i })) })
    const before = blankCalls()
    await press('Escape', { shiftKey: true }, document.body)
    expect(blankCalls()).toBe(before + 1)
  })

  it('Filters popover (Sermons search)', async () => {
    await renderApp()
    await openProjection()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /filters/i })) })
    expect(document.querySelector('.filter-popover')).not.toBeNull()
    const before = blankCalls()
    await press('Escape', {}, document.body)
    expect(document.querySelector('.filter-popover')).toBeNull()
    expect(blankCalls()).toBe(before)
  })

  it('Import menu (Songs)', async () => {
    await renderApp()
    await openProjection()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^songs$/i })) })
    await act(async () => { fireEvent.click(document.querySelector('.songs-import-btn') as Element) })
    expect(document.querySelector('.songs-import-popover')).not.toBeNull()
    const before = blankCalls()
    await press('Escape', {}, document.body)
    expect(document.querySelector('.songs-import-popover')).toBeNull()
    expect(blankCalls()).toBe(before)
  })
})

describe('Esc in a search box with text clears it and does not blank', () => {
  it('sermon search box', async () => {
    await renderApp()
    await openProjection()
    const input = document.getElementById('born-search-input') as HTMLInputElement
    await act(async () => { fireEvent.change(input, { target: { value: 'faith' } }) })
    input.focus()
    const before = blankCalls()
    await act(async () => { fireEvent.keyDown(input, { key: 'Escape' }) })
    expect(input.value).toBe('')
    expect(blankCalls()).toBe(before)
  })

  it('an empty search box: Esc still blanks (unchanged)', async () => {
    await renderApp()
    await openProjection()
    const input = document.getElementById('born-search-input') as HTMLInputElement
    input.focus()
    const before = blankCalls()
    await act(async () => { fireEvent.keyDown(input, { key: 'Escape' }) })
    expect(blankCalls()).toBe(before + 1)
  })
})
