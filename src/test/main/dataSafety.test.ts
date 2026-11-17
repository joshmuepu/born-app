import { describe, it, expect, vi, afterEach } from 'vitest'
import { request } from 'http'
import { projectionOpensWindowed, cornerWindowBounds, projectionPlacementAfterChange } from '../../main/displays'
import { freeServiceName, safeServiceFileName } from '../../main/remoteServicePath'
import { withLiveScreen } from '../../main/remoteOnScreen'
import type { WebRemoteState } from '../../main/webRemote'

vi.mock('os', async () => ({ ...(await vi.importActual<typeof import('os')>('os')), networkInterfaces: () => ({}) }))
const { startWebRemote, stopWebRemote } = await import('../../main/webRemote')

const PORT = 43166 // own port: other remote tests use 43160, 43161 and 43163 in parallel workers
afterEach(async () => { stopWebRemote(); await new Promise((r) => setTimeout(r, 50)) })

function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? '' : JSON.stringify(body)
    const req = request({ host: '127.0.0.1', port: PORT, path, method, headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let b = ''
      res.on('data', (c) => (b += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: b }))
    })
    req.on('error', reject)
    req.end(data)
  })
}
const start = (handlers: Record<string, unknown>, onCommand: Parameters<typeof startWebRemote>[0] = () => undefined): Promise<void> =>
  new Promise<void>((resolve) => startWebRemote(onCommand, handlers as unknown as Parameters<typeof startWebRemote>[1], resolve, PORT))
const fails = (): Promise<never> => Promise.reject(new Error('SQLITE_CANTOPEN'))

describe('with no projector the congregation screen opens as a window in a corner', () => {
  const area = { x: 0, y: 25, width: 1440, height: 875 }
  it('only the automatic choice of the operator\'s own screen opens as a window', () => {
    expect(projectionOpensWindowed({ isFallback: true, isOverride: false })).toBe(true)
    expect(projectionOpensWindowed({ isFallback: true, isOverride: true })).toBe(false) // this computer's screen chosen under Screens
    expect(projectionOpensWindowed({ isFallback: false, isOverride: false })).toBe(false) // a projector
  })
  it('the window is smaller than the screen, 16:9, in the bottom-right corner', () => {
    const b = cornerWindowBounds(area)
    expect(b.width).toBeLessThan(area.width)
    expect(b.height).toBeLessThan(area.height)
    expect(Math.abs(b.width / b.height - 16 / 9)).toBeLessThan(0.02)
    expect(b.x + b.width).toBe(area.x + area.width)
    expect(b.y + b.height).toBe(area.y + area.height)
  })
  it('a screen change does not then put it full screen on the operator\'s own screen', () => {
    // opened as a window counts as moved off a projector: it stays a window until a projector is connected
    expect(projectionPlacementAfterChange({ automaticFallback: true, wasOnProjector: false, displaced: true })).toBe('windowed')
    expect(projectionPlacementAfterChange({ automaticFallback: false, wasOnProjector: false, displaced: true })).toBe('fullscreen')
  })
})

describe('the phone\'s "Keep both" name', () => {
  it('is "Name (2)", or the next number that is free', () => {
    expect(freeServiceName('Sunday', () => false)).toBe('Sunday (2)')
    const taken = new Set(['Sunday (2)', 'Sunday (3)'])
    expect(freeServiceName('Sunday', (f) => taken.has(f))).toBe('Sunday (4)')
    expect(safeServiceFileName(freeServiceName('Sunday', () => false))).toBe('Sunday (2)')
  })
})

describe('the phone\'s status follows what is on the congregation screen', () => {
  const base: WebRemoteState = { queue: [], activeIndex: null, activeSlide: 0, blanked: false, bibleTranslation: 'KJV', onScreen: null }
  const slide = { kind: 'bible', text: 'For God so loved the world', reference: 'John 3:16 · KJV' }
  it('the operator window has nothing (it was started again) but the screen shows a verse: the phone is told the verse', () => {
    expect(withLiveScreen(base, { slide, blank: false }).onScreen).toMatchObject({ text: slide.text, reference: slide.reference })
  })
  it('the screen is hidden: the phone says so, and is not told a slide', () => {
    const out = withLiveScreen(base, { slide, blank: true })
    expect(out.blanked).toBe(true)
    expect(out.onScreen).toBeNull()
  })
  it('the operator window\'s own description is kept when it has one', () => {
    const own = { kind: 'bible', text: 'x', reference: 'Own' }
    expect(withLiveScreen({ ...base, onScreen: own }, { slide, blank: false }).onScreen).toBe(own)
  })
  it('the congregation screen closed: passed on unchanged', () => {
    expect(withLiveScreen(base, null)).toBe(base)
  })
})

describe('lists the computer cannot read are answered as errors, not as empty lists', () => {
  it('series, a series\' sermons, a sermon, a Bible chapter and a song', async () => {
    await start({ sermonSeries: fails, sermonsByIds: fails, sermonParagraphs: fails, bibleChapter: fails, song: fails })
    for (const p of ['/api/sermons/series', '/api/sermons/by-ids?ids=1,2', '/api/sermons/5/paragraphs', '/api/bible/chapter?book=43&chapter=3', '/api/song/7']) {
      const r = await call('GET', p)
      expect(r.status, p).toBe(500)
      expect(JSON.parse(r.body).error, p).toMatch(/could not be read/)
    }
  })
  it('a list that really is empty is still answered as one, and a song that is not there as null', async () => {
    await start({ sermonSeries: () => Promise.resolve([]), sermonsByIds: () => Promise.resolve([]), song: () => Promise.resolve(null) })
    expect(await call('GET', '/api/sermons/series')).toEqual({ status: 200, body: '[]' })
    expect(await call('GET', '/api/sermons/by-ids?ids=1')).toEqual({ status: 200, body: '[]' })
    expect(await call('GET', '/api/song/7')).toEqual({ status: 200, body: 'null' })
  })
})

describe('the phone\'s Save under a name that is taken', () => {
  it('passes on "exists" and the name it was saved under', async () => {
    await start({}, (c) => {
      const cmd = c as { action: string; onExisting?: string }
      if (cmd.action !== 'save-queue') return undefined
      return Promise.resolve(cmd.onExisting === 'ask' ? { ok: false, exists: true } : { ok: true, name: 'Sunday (2)' })
    })
    expect(await call('POST', '/command', { action: 'save-queue', name: 'Sunday', onExisting: 'ask' })).toEqual({ status: 200, body: '{"ok":false,"exists":true}' })
    expect(await call('POST', '/command', { action: 'save-queue', name: 'Sunday', onExisting: 'keep-both' })).toEqual({ status: 200, body: '{"ok":true,"name":"Sunday (2)"}' })
  })
})

describe('the bundled series could not be read at all', () => {
  afterEach(() => { vi.doUnmock('fs'); vi.doUnmock('electron'); vi.resetModules() })
  const electronStub = (): void => { vi.doMock('electron', () => ({ app: { getAppPath: () => '/nowhere/app' } })) }
  it('is told apart from a series list that is empty', async () => {
    vi.resetModules(); electronStub()
    vi.doMock('fs', async () => ({ ...(await vi.importActual<typeof import('fs')>('fs')), readFileSync: () => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }) } }))
    const m = await import('../../main/browseLocal')
    expect(m.loadBundledSeries()).toEqual([])
    expect(m.bundledSeriesUnreadable()).toBe(true)
  })
  it('a file that lists no series is not a read failure', async () => {
    vi.resetModules(); electronStub()
    vi.doMock('fs', async () => ({ ...(await vi.importActual<typeof import('fs')>('fs')), readFileSync: () => '{"series":[]}' }))
    const m = await import('../../main/browseLocal')
    expect(m.loadBundledSeries()).toEqual([])
    expect(m.bundledSeriesUnreadable()).toBe(false)
  })
})
