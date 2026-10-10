// @vitest-environment jsdom
/**
 * remoteResume.test.ts — kept in its own file, separate from remoteCmd.test.ts:
 * this is the one test in the suite that actually runs the remote's full
 * DOMContentLoaded init (not just its top-level function declarations), and
 * doing that more than once per module/global scope produced cross-test
 * fetch-call leakage that had nothing to do with the behavior under test.
 */
import { describe, it, expect, vi } from 'vitest'
import { APP_JS, buildAppBody } from '../../main/remoteAssets'

function loadFullPageAndInit(): void {
  document.body.innerHTML = buildAppBody()
  // jsdom doesn't implement matchMedia (used by initA2HS's responsive
  // check) — same category of gap as Element.scrollTo elsewhere in this
  // app's test suite.
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })) as unknown as typeof window.matchMedia
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(APP_JS)()
  document.dispatchEvent(new Event('DOMContentLoaded'))
}

describe('remote: resuming a backgrounded tab polls immediately', () => {
  it('fetches /state again the instant the tab becomes visible, not on the next 1s tick', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
    global.fetch = fetchMock as unknown as typeof fetch

    loadFullPageAndInit()
    const callsAfterInit = fetchMock.mock.calls.filter((c) => c[0] === '/state').length
    expect(callsAfterInit).toBeGreaterThan(0) // the init's own poll()

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    const callsWhileHidden = fetchMock.mock.calls.filter((c) => c[0] === '/state').length
    expect(callsWhileHidden).toBe(callsAfterInit) // hidden → no extra poll

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    const callsAfterResume = fetchMock.mock.calls.filter((c) => c[0] === '/state').length
    expect(callsAfterResume).toBe(callsAfterInit + 1) // visible again → immediate poll, no 1s wait

    vi.useRealTimers()
  })
})
