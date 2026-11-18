// @vitest-environment jsdom
/**
 * The phone's Save asks before replacing a saved service and never says "Saved" for a save that did not reach the computer; a list or sheet
 * that cannot load says so with Try again, and a song that cannot be opened says so. Runs the real APP_JS in jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { APP_JS } from '../../main/remoteAssets'

type Api = {
  doSaveQueue: () => void
  saveQueueSheet: () => void
  openSavedSheet: () => void
  openOnThisDay: () => void
  openSeriesList: () => void
  openSermonDetailSheet: (id: number, title: string, dateCode: string) => void
  openRecentSermons: () => void
  pickChapter: (c: number) => void
  selectSongById: (id: number) => void
  state: Record<string, unknown>
  saveQueueAs: (onExisting: string) => void
  retrySheet: () => void
  loadSongs: () => void
  renderSongsTab: () => void
  openKeyPickerSheet: () => void
  filterSongs: (v: string) => void
  openChapterContext: (book: number, chapter: number, focus: number[]) => void
  retryRecentSongs: () => void
}
function load(): Api {
  Object.assign(window, { matchMedia: () => ({ matches: false, addEventListener: () => {}, addListener: () => {} }) })
  document.body.innerHTML = '<div id="toast"></div><div id="conn-p"><span class="connLabel"></span></div>'
    + '<div class="sheet-overlay" id="sheetOverlay"><div class="sheet" id="sheetBody"></div></div><div id="view-songs"></div><div id="view-bible"></div>'
  // (the buttons' own clicks are checked in a real browser by scripts/qa/phone-data-safety.cjs; here their functions are called)
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const api = new Function(`${APP_JS}\nreturn { doSaveQueue: doSaveQueue, saveQueueSheet: saveQueueSheet, openSavedSheet: openSavedSheet, openOnThisDay: openOnThisDay, openSeriesList: openSeriesList, openSermonDetailSheet: openSermonDetailSheet, openRecentSermons: openRecentSermons, pickChapter: pickChapter, selectSongById: selectSongById, state: state, saveQueueAs: saveQueueAs, retrySheet: retrySheet, loadSongs: loadSongs, renderSongsTab: renderSongsTab, openKeyPickerSheet: openKeyPickerSheet, filterSongs: filterSongs, openChapterContext: openChapterContext, retryRecentSongs: retryRecentSongs };`)() as Api
  Object.assign(window, api)
  return api
}
const toastText = (): string => document.getElementById('toast')!.textContent ?? ''
const sheet = (): string => document.getElementById('sheetBody')!.textContent ?? ''
const buttons = (): string[] => [...document.querySelectorAll('#sheetBody button')].map((b) => (b.textContent ?? '').trim())
const flush = async (n = 4): Promise<void> => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)) }
const json = (v: unknown, status = 200): Response => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } })
const typeName = (name: string): void => { (document.getElementById('saveNameInput') as HTMLInputElement).value = name }

let unhandled: unknown[] = []
const onUnhandled = (r: unknown): void => { unhandled.push(r) }
beforeEach(() => { vi.restoreAllMocks(); unhandled = []; process.on('unhandledRejection', onUnhandled) })
afterEach(() => { process.off('unhandledRejection', onUnhandled) })

describe('Save under a name that already exists', () => {
  it('asks: Cancel (the default), Keep both, Replace it; nothing is saved while it asks', async () => {
    const sent: Array<Record<string, unknown>> = []
    global.fetch = vi.fn((_u: unknown, init?: { body?: string }) => {
      const b = JSON.parse(init?.body ?? '{}') as Record<string, unknown>
      sent.push(b)
      return Promise.resolve(json(b.onExisting === 'ask' ? { ok: false, exists: true } : { ok: true, name: b.onExisting === 'keep-both' ? 'Sunday (2)' : 'Sunday' }))
    }) as unknown as typeof fetch
    const api = load()
    api.saveQueueSheet(); typeName('Sunday'); api.doSaveQueue()
    await flush()
    expect(sent[0]).toMatchObject({ action: 'save-queue', name: 'Sunday', onExisting: 'ask' })
    expect(buttons()).toEqual(['Cancel', 'Keep both', 'Replace it'])
    expect(sheet()).toMatch(/already exists/)
    expect(toastText()).not.toMatch(/Saved/)
    await new Promise((r) => setTimeout(r, 5))
    expect(document.activeElement?.textContent).toBe('Cancel')
    expect(document.querySelectorAll('#sheetBody button')[1].getAttribute('onclick')).toMatch(/saveQueueAs\("keep-both"\)/)
    api.saveQueueAs('keep-both')
    await flush()
    expect(sent[1]).toMatchObject({ name: 'Sunday', onExisting: 'keep-both' })
    expect(toastText()).toMatch(/Saved .Sunday \(2\)/)
  })
  it('Replace it replaces it', async () => {
    const sent: Array<Record<string, unknown>> = []
    global.fetch = vi.fn((_u: unknown, init?: { body?: string }) => {
      const b = JSON.parse(init?.body ?? '{}') as Record<string, unknown>
      sent.push(b)
      return Promise.resolve(json(b.onExisting === 'ask' ? { ok: false, exists: true } : { ok: true }))
    }) as unknown as typeof fetch
    const api = load()
    api.saveQueueSheet(); typeName('Sunday'); api.doSaveQueue()
    await flush()
    expect(document.querySelectorAll('#sheetBody button')[2].getAttribute('onclick')).toMatch(/saveQueueAs\("replace"\)/)
    api.saveQueueAs('replace')
    await flush()
    expect(sent[1]).toMatchObject({ onExisting: 'replace' })
    expect(toastText()).toMatch(/Saved .Sunday/)
  })
})

describe('a Save whose connection drops', () => {
  it('says it was not saved, never "Saved", and leaves no unhandled error', async () => {
    global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch
    const api = load()
    api.saveQueueSheet(); typeName('Sunday'); api.doSaveQueue()
    await flush(6)
    expect(toastText()).toMatch(/was not saved/)
    expect(toastText()).not.toMatch(/^Saved/)
    expect(unhandled).toEqual([])
  })
  it('a refusal from BORN also says it was not saved', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('', { status: 500 }))) as unknown as typeof fetch
    const api = load()
    api.saveQueueSheet(); typeName('Sunday'); api.doSaveQueue()
    await flush(6)
    expect(toastText()).toMatch(/was not saved/)
    expect(unhandled).toEqual([])
  })
})

describe('lists and sheets that cannot load say so, with Try again', () => {
  const cases: Array<[string, (a: Api) => void]> = [
    ['Open a saved service', (a) => a.openSavedSheet()],
    ['On This Day', (a) => a.openOnThisDay()],
    ['Series', (a) => a.openSeriesList()],
    ['a sermon', (a) => a.openSermonDetailSheet(5, 'Placeholder', '')],
    ['Recently Played', (a) => a.openRecentSermons()]
  ]
  for (const [label, open] of cases) {
    it(label, async () => {
      let up = false
      global.fetch = vi.fn(() => Promise.resolve(up ? json([]) : json({ error: 'x' }, 500))) as unknown as typeof fetch
      const api = load()
      open(api)
      await flush(6)
      expect(sheet()).toMatch(/Couldn.t load this from BORN/)
      expect(sheet()).not.toMatch(/Loading/)
      expect(buttons()).toContain('Try again')
      up = true
      expect([...document.querySelectorAll('#sheetBody button')].find((b) => b.textContent === 'Try again')!.getAttribute('onclick')).toBe('retrySheet()')
      api.retrySheet()
      await flush(6)
      expect(sheet()).not.toMatch(/Couldn.t load/)
      expect(unhandled).toEqual([])
    })
  }
  it('a Bible chapter: not "Loading…" for ever', async () => {
    global.fetch = vi.fn(() => Promise.resolve(json({ error: 'x' }, 500))) as unknown as typeof fetch
    const api = load()
    api.state.tab = 'bible'
    api.state.bibleBook = { num: 43, name: 'John', chapters: 21 }
    api.pickChapter(3)
    await flush(6)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/Couldn.t load this from BORN/)
    expect(text).toMatch(/Try again/)
    expect(unhandled).toEqual([])
  })
  it('a song that cannot be opened says so', async () => {
    global.fetch = vi.fn(() => Promise.resolve(json({ error: 'x' }, 500))) as unknown as typeof fetch
    const api = load()
    api.selectSongById(7)
    await flush(6)
    expect(toastText()).toMatch(/Couldn.t open that song/)
    expect(unhandled).toEqual([])
  })
})

/* Requests the phone makes when it opens (or on a tap) that used to fail with nothing on the screen. */
describe('requests that used to fail without a word', () => {
  const songsView = (): string => document.getElementById('view-songs')!.textContent ?? ''
  it('the recent songs: says it could not load, with Try again, which loads them', async () => {
    let up = false
    global.fetch = vi.fn((u: unknown) => {
      const url = String(u)
      if (url.startsWith('/api/songs/recent')) return Promise.resolve(up ? json([{ id: 7, title: 'Placeholder Hymn' }]) : json({ error: 'x' }, 500))
      return Promise.resolve(json([{ id: 1, title: 'Another Placeholder', author: '' }]))
    }) as unknown as typeof fetch
    const api = load()
    api.state.tab = 'songs'
    api.loadSongs(); api.renderSongsTab()
    await flush(6)
    expect(songsView()).toMatch(/RECENTLY PLAYED/)
    expect(songsView()).toMatch(/Couldn.t load this from BORN\./)
    const retry = [...document.querySelectorAll('#view-songs button')].find((b) => b.textContent === 'Try again')!
    expect(retry).toBeTruthy()
    expect(retry.getAttribute('onclick')).toBe('retryRecentSongs()')
    up = true
    api.retryRecentSongs()
    await flush(6)
    expect(songsView()).not.toMatch(/Couldn.t load/)
    expect(songsView()).toMatch(/Placeholder Hymn/)
    expect(unhandled).toEqual([])
  })
  it('the recent songs: an empty list still shows nothing extra', async () => {
    global.fetch = vi.fn(() => Promise.resolve(json([]))) as unknown as typeof fetch
    const api = load()
    api.state.tab = 'songs'
    api.loadSongs(); api.renderSongsTab()
    await flush(6)
    expect(songsView()).not.toMatch(/RECENTLY PLAYED|Couldn.t load/)
  })
  it('Set key: the sheet says it could not load, with Try again', async () => {
    let up = false
    global.fetch = vi.fn(() => Promise.resolve(up ? json(['G']) : json({ error: 'x' }, 500))) as unknown as typeof fetch
    const api = load()
    api.state.selected = { kind: 'song', title: 'Placeholder Hymn', payload: { songId: 7 }, slides: [] }
    api.openKeyPickerSheet()
    await flush(6)
    expect(sheet()).toMatch(/Couldn.t load this from BORN\./)
    expect(buttons()).toContain('Try again')
    up = true
    api.retrySheet()
    await flush(6)
    expect(sheet()).not.toMatch(/Couldn.t load/)
    expect(buttons()).toContain('No key')
    expect(unhandled).toEqual([])
  })
  it('a song search whose request fails says so, not "Searching…" for ever', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    global.fetch = vi.fn(() => Promise.resolve(json({ error: 'x' }, 500))) as unknown as typeof fetch
    const api = load()
    api.state.tab = 'songs'
    api.renderSongsTab()
    api.filterSongs('placeholder')
    vi.advanceTimersByTime(250)
    vi.useRealTimers()
    await flush(6)
    expect(songsView()).not.toMatch(/SEARCHING/)
    expect(songsView()).toMatch(/Couldn.t reach BORN/)
    expect(unhandled).toEqual([])
  })
  it('a Bible passage that cannot be opened says so', async () => {
    global.fetch = vi.fn(() => Promise.resolve(json({ error: 'x' }, 500))) as unknown as typeof fetch
    const api = load()
    api.openChapterContext(43, 3, [16])
    await flush(6)
    expect(toastText()).toMatch(/Couldn.t load this from BORN/)
    expect(unhandled).toEqual([])
  })
})
