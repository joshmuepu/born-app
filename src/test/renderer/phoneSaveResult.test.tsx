// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, cleanup } from '@testing-library/react'
import { installApi, renderApp } from './appHarness'

// A save asked for from the phone: the operator window does the save and reports back whether it worked, so the phone can say so.
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function phoneSave(result: unknown): Promise<ReturnType<typeof vi.fn>> {
  let handler: ((name: string, id: number) => Promise<void>) | null = null
  const api = installApi({
    onWebRemoteSaveQueue: vi.fn((cb) => { handler = cb; return () => {} }),
    saveServiceNamed: typeof result === 'function' ? vi.fn(result as () => Promise<unknown>) : vi.fn(() => Promise.resolve(result)),
    reportWebRemoteSaveResult: vi.fn()
  })
  await renderApp()
  await act(async () => { await handler!('Sunday', 7) })
  return api.reportWebRemoteSaveResult
}

describe('a save asked for from the phone', () => {
  it('reports a save that worked', async () => {
    expect(await phoneSave(true)).toHaveBeenCalledWith(7, true)
  })
  it('reports a save that failed', async () => {
    expect(await phoneSave(false)).toHaveBeenCalledWith(7, false)
  })
  it('reports a save that threw as failed', async () => {
    expect(await phoneSave(() => Promise.reject(new Error('EROFS')))).toHaveBeenCalledWith(7, false)
  })
})
