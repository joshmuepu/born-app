// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { installApi, renderApp, press } from './appHarness'

// "?" opens the Keyboard shortcuts list only when you are not typing: a question mark typed into a search box ("Where could I be?") is just text.

beforeEach(() => { installApi() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('"?" while typing', () => {
  it('a question mark typed in the search box does not open the shortcuts list', async () => {
    await renderApp()
    const box = document.getElementById('born-search-input') as HTMLInputElement
    expect(box).not.toBeNull()
    await press('?', {}, box)
    expect(screen.queryByText(/keyboard shortcuts/i)).toBeNull()
  })
  it('outside a text box "?" still opens it', async () => {
    await renderApp()
    await press('?', {}, document.body)
    expect(screen.getByText(/keyboard shortcuts/i)).toBeTruthy()
  })
})
