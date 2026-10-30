// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { installApi, renderApp, press } from './appHarness'

// B and Esc are the same key in the shortcuts list ("Hide / show the congregation screen"). With no projection window open, Esc did
// nothing but B quietly set the screen to hidden, so the projector then opened black with no sign why.

beforeEach(() => { installApi() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const blankCalls = (): number => ((window.electronAPI as unknown as { setBlankScreen: ReturnType<typeof vi.fn> }).setBlankScreen.mock.calls.length)

describe('B hides / shows the screen only while the projection window is open, like Esc', () => {
  it('projection closed: B does nothing', async () => {
    await renderApp()
    const before = blankCalls()
    await press('b', {}, document.body)
    expect(blankCalls()).toBe(before)
  })
  it('projection open: B still hides the screen', async () => {
    await renderApp()
    await press('W', { metaKey: true, ctrlKey: true, shiftKey: true }, document.body)
    const before = blankCalls()
    await press('b', {}, document.body)
    expect(blankCalls()).toBe(before + 1)
  })
})
