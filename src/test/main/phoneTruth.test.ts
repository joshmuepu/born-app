// @vitest-environment jsdom
/**
 * The phone tells the truth: a tap gives up after about 4 s and is not sent while the phone knows it is offline; a refusal is not called
 * "Couldn't reach"; the item sheet follows its item; a sheet or a library list that cannot load says so. Runs the real APP_JS in jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { APP_JS } from '../../main/remoteAssets'

type Api = {
  cmd: (action: string, extra?: unknown) => Promise<unknown>
  setConn: (ok: boolean) => void
  state: Record<string, unknown> & { qs: { queue: Array<{ id: string }> }; detailIndex: number | null }
  poll: () => Promise<void>
  openQueueItemDetail: (i: number) => void
  openOnThisDay: () => void
  loadSongs: () => void
  renderSongsBody: () => void
  setTab: (t: string) => void
}
function load(): Api {
  // the phone page asks for its layout with matchMedia, which jsdom does not have: a phone, not a tablet
  Object.assign(window, { matchMedia: () => ({ matches: false, addEventListener: () => {}, addListener: () => {} }) })
  document.body.innerHTML = '<div id="toast"></div><div id="conn-p"><span class="connLabel"></span></div>'
    + '<div class="sheet-overlay" id="sheetOverlay"><div class="sheet" id="sheetBody"></div></div><div id="view-songs"></div>'
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const api = new Function(`${APP_JS}\nreturn { cmd: cmd, setConn: setConn, state: state, poll: poll, openQueueItemDetail: openQueueItemDetail, openOnThisDay: openOnThisDay, loadSongs: loadSongs, renderSongsBody: renderSongsBody, setTab: setTab };`)() as Api
  Object.assign(window, api)
  return api
}
const toastText = (): string => document.getElementById('toast')!.textContent ?? ''
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.useRealTimers())

describe('taps', () => {
  it('a tap that gets no answer gives up after about 4 seconds, asks BORN whether it acted, and says so when it cannot tell', async () => {
    vi.useFakeTimers()
    global.fetch = vi.fn((_u: unknown, init?: { signal?: AbortSignal }) => new Promise((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))
    })) as unknown as typeof fetch
    const { cmd } = load()
    let settled = false
    cmd('next').catch(() => { settled = true })
    await vi.advanceTimersByTimeAsync(4100)
    expect(settled).toBe(false) // it is asking BORN (2.5 s at most)
    await vi.advanceTimersByTimeAsync(2600)
    expect(settled).toBe(true)
    expect(toastText()).toMatch(/couldn.t reach born/i)
  })
  it('is not sent while the phone knows it is offline; Hide screen still tries', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))) as unknown as typeof fetch
    const { cmd, setConn } = load()
    setConn(false)
    await cmd('next').catch(() => {})
    expect(global.fetch).not.toHaveBeenCalled()
    expect(toastText()).toMatch(/not connected/i)
    await cmd('blank').catch(() => {})
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
  it('a refusal is not called "Couldn\'t reach", and the phone stays Connected', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('', { status: 413 }))) as unknown as typeof fetch
    const { cmd } = load()
    await cmd('queue-batch', { items: [] }).catch(() => {})
    expect(toastText()).not.toMatch(/couldn.t reach/i)
    expect(toastText()).toMatch(/too large/i)
    expect(document.querySelector('.connLabel')!.textContent).toBe('Connected')
  })
})

describe('the item sheet follows its item', () => {
  const qs = (ids: string[]): unknown => ({ queue: ids.map((id) => ({ id, kind: 'bible', title: id, slides: [{ text: id }] })), activeIndex: null, activeSlide: 0, blanked: false, onScreen: null })
  it('an item added above it does not turn the sheet into another item; a removed item closes it with a note', async () => {
    const api = load()
    let next = qs(['a', 'b', 'c'])
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify(next), { status: 200 }))) as unknown as typeof fetch
    await api.poll()
    api.openQueueItemDetail(1) // "b"
    next = qs(['new', 'a', 'b', 'c'])
    await api.poll()
    expect(api.state.detailIndex).toBe(2)
    next = qs(['new', 'a', 'c'])
    await api.poll()
    expect(api.state.detailIndex).toBeNull()
    expect(toastText()).toMatch(/taken out of the service/)
  })
})

describe('sheets and lists that cannot load say so', () => {
  it('a sheet does not say "Loading…" for ever', async () => {
    const quiet = (): void => {} // the sheet's own read rejects, as it always did; only what the sheet shows is under test
    process.on('unhandledRejection', quiet)
    global.fetch = vi.fn(() => Promise.reject(new Error('network'))) as unknown as typeof fetch
    const api = load()
    api.openOnThisDay()
    await flush(); await flush()
    expect(document.getElementById('sheetBody')!.textContent).not.toMatch(/Loading/)
    expect(document.getElementById('sheetBody')!.textContent).toMatch(/Couldn.t load/)
    await flush()
    process.off('unhandledRejection', quiet)
  })
  it('the song list says it could not be read (not "No songs found") and is read again when the tab is opened', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('{"error":"x"}', { status: 500 }))) as unknown as typeof fetch
    const api = load()
    api.state.tab = 'songs'
    api.loadSongs()
    await flush(); await flush(); await flush()
    const calls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length
    api.setTab('songs')
    await flush()
    expect((global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBeGreaterThan(calls)
    await flush(); await flush()
    expect(document.body.textContent).toMatch(/could not be read/)
    expect(document.body.textContent).not.toMatch(/No songs found/)
  })
})
