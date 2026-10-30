import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchAllSeries, fetchLanguages, clearBrowseCache } from '../../main/tableApi'

// Calls to the online sermon source had no time limit: on a network that takes the connection but never answers (a captive portal,
// weak church Wi-Fi) Browse > Series waited about five minutes before falling back to the bundled list, and a Next that needed an
// online paragraph held up every Next press behind it. Every call now gives up after a fixed time.
afterEach(() => { vi.restoreAllMocks(); clearBrowseCache() })

function hangingFetch(): { calls: Array<RequestInit | undefined> } {
  const calls: Array<RequestInit | undefined> = []
  global.fetch = vi.fn((_url: string, init?: RequestInit) => {
    calls.push(init)
    return new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('timed out', 'TimeoutError'))))
  }) as never
  return { calls }
}

describe('calls to the online sermon source give up instead of waiting forever', () => {
  it('every call carries a time limit', async () => {
    const { calls } = hangingFetch()
    void fetchAllSeries().catch(() => {})
    void fetchLanguages().catch(() => {})
    await new Promise((r) => setTimeout(r, 10))
    expect(calls.length).toBeGreaterThanOrEqual(2)
    for (const c of calls) expect(c?.signal).toBeInstanceOf(AbortSignal)
  })
})
