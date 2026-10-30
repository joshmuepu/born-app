// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, act, fireEvent, cleanup } from '@testing-library/react'
import { installApi, renderApp, press } from './appHarness'

// Shift+Esc is the panic key: the Help page, the shortcuts list and the changelog promise it hides the congregation screen
// "even with a window or menu open". The Keyboard shortcuts list and the Message dialog used to swallow it.

beforeEach(() => { installApi() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const blankCalls = (): number => ((window.electronAPI as unknown as { setBlankScreen: ReturnType<typeof vi.fn> }).setBlankScreen.mock.calls.length)
async function openProjection(): Promise<void> {
  await press('W', { metaKey: true, ctrlKey: true, shiftKey: true }, document.body)
}

describe('Shift+Esc hides the screen with a dialog open', () => {
  it('the Keyboard shortcuts list', async () => {
    await renderApp()
    await openProjection()
    await press('?', {}, document.body)
    expect(screen.getByText(/keyboard shortcuts/i)).toBeTruthy()
    const before = blankCalls()
    await press('Escape', { shiftKey: true }, document.body)
    expect(blankCalls()).toBe(before + 1)
  })

  it('the Message dialog (focus in its text box), and the dialog stays open', async () => {
    await renderApp()
    await openProjection()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^message/i })) })
    const input = screen.getByPlaceholderText(/silence your phones/i)
    const before = blankCalls()
    await press('Escape', { shiftKey: true }, input)
    expect(blankCalls()).toBe(before + 1)
    expect(screen.queryByPlaceholderText(/silence your phones/i)).not.toBeNull()
  })

  it('plain Esc in the Message dialog still just closes it', async () => {
    await renderApp()
    await openProjection()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^message/i })) })
    const input = screen.getByPlaceholderText(/silence your phones/i)
    const before = blankCalls()
    await press('Escape', {}, input)
    expect(blankCalls()).toBe(before)
    expect(screen.queryByPlaceholderText(/silence your phones/i)).toBeNull()
  })
})
