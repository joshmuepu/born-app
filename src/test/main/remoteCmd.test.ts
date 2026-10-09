// @vitest-environment jsdom
/**
 * remoteCmd.test.ts — exercises cmd()/toast() exactly as the phone remote's
 * browser-side code runs them, by evaluating the real APP_JS source (not a
 * reimplementation of it) in a jsdom document and capturing its top-level
 * functions. APP_JS is a plain <script>-tag string (see remoteAssets.ts) —
 * `new Function(...)` gives it the same "top-level var/function decls
 * resolve against the real global document/fetch/navigator" behavior a
 * browser's own script execution would, including respecting its own
 * 'use strict' without that strict mode hiding its locals from the trailing
 * return statement appended below.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { APP_JS } from '../../main/remoteAssets'

function loadRemoteScript(): { cmd: (action: string, extra?: unknown) => Promise<unknown> } {
  document.body.innerHTML = '<div id="toast"></div><div id="conn-p"><span class="connLabel"></span></div>'
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(`${APP_JS}\nreturn { cmd: cmd, toast: toast, setConn: setConn };`)
  return factory() as { cmd: (action: string, extra?: unknown) => Promise<unknown> }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('remote cmd() — fails visibly instead of silently', () => {
  it('shows an amber error toast and flips the connection dot when the network is down', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network error'))) as unknown as typeof fetch
    const { cmd } = loadRemoteScript()

    await cmd('next').catch(() => {}) // cmd() rejects by design; the point under test is its side effects

    const toastEl = document.getElementById('toast') as HTMLElement
    expect(toastEl.style.display).toBe('block')
    expect(toastEl.classList.contains('error')).toBe(true)
    expect(toastEl.textContent).toMatch(/couldn.t reach born/i)

    const connLabel = document.querySelector('.connLabel') as HTMLElement
    expect(connLabel.textContent).toBe('Reconnecting…')
  })

  it('shows the same visible failure for a non-OK HTTP response, not just a network error', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('', { status: 500 }))) as unknown as typeof fetch
    const { cmd } = loadRemoteScript()

    await cmd('blank').catch(() => {})

    const toastEl = document.getElementById('toast') as HTMLElement
    expect(toastEl.classList.contains('error')).toBe(true)
  })

  it('does not show an error toast, and reports connected, on a normal successful command', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as unknown as typeof fetch
    const { cmd } = loadRemoteScript()

    await cmd('next')

    const toastEl = document.getElementById('toast') as HTMLElement
    expect(toastEl.style.display).not.toBe('block')
    const connLabel = document.querySelector('.connLabel') as HTMLElement
    expect(connLabel.textContent).toBe('Connected')
  })

  it('rejects on failure so a caller\'s own success handler never fires for a command that never reached BORN', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network error'))) as unknown as typeof fetch
    const { cmd } = loadRemoteScript()

    const onSuccess = vi.fn()
    await cmd('save-queue', { name: 'Sunday' }).then(onSuccess).catch(() => {})

    expect(onSuccess).not.toHaveBeenCalled()
  })
})

