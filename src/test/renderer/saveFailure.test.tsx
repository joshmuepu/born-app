// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, act, fireEvent, cleanup } from '@testing-library/react'
import { installApi, renderApp } from './appHarness'

// Saving a service to a folder that cannot be written (read-only, full, a USB stick pulled out) showed nothing at all: the operator
// believed it was saved. It now says so under the queue toolbar.
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const item = { kind: 'song', id: 's1', songId: 1, title: 'Invented Song', slides: [{ text: 'Placeholder line' }] }

describe('a service that could not be saved', () => {
  it('says so', async () => {
    installApi({ loadQueue: vi.fn(() => Promise.resolve([item])), saveService: vi.fn(() => Promise.resolve('failed')) })
    await renderApp()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^save$/i })) })
    expect(document.querySelector('.queue-open-error')?.textContent).toMatch(/couldn.t save/i)
  })
  it('a cancelled save says nothing', async () => {
    installApi({ loadQueue: vi.fn(() => Promise.resolve([item])), saveService: vi.fn(() => Promise.resolve(false)) })
    await renderApp()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^save$/i })) })
    expect(document.querySelector('.queue-open-error')).toBeNull()
  })
})
