import { get as httpGet, type IncomingMessage } from 'http'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const {
  startWebRemote,
  stopWebRemote,
  registerGraphicsDestination,
  unregisterGraphicsDestination,
  pushGraphicsUpdate,
  parseProfileParam,
  graphicsTiming
} = await import('../../main/webRemote')

const PORT = 43181 // (other webRemote tests use 43160, 43161 and 43172)
const noopSearch = { sermons: async () => [], bible: async () => ({ kind: 'error', message: '' }), songs: async () => [], song: async () => null, bibleBooks: async () => [], bibleChapter: async () => ({ error: '' }) } as never
const noopAutomation = { goNext() {}, goPrevious() {}, clear() {}, blank() {}, show() {}, getState: () => [] } as never

beforeAll(async () => {
  await new Promise<void>((resolve) => startWebRemote(() => {}, noopSearch, noopAutomation, resolve, PORT))
})
afterAll(() => stopWebRemote())

const getPage = (path: string): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    httpGet({ host: '127.0.0.1', port: PORT, path }, (res) => {
      let b = ''
      res.on('data', (c) => (b += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: b }))
    }).on('error', reject)
  })

/** An SSE client: collects every message (and named events) until closed. */
function sse(path: string): { events: Array<{ event: string; data: string }>; frames: () => Array<{ slide: { text: string } | null; blanked: boolean; profileId: string }>; close: () => void; ready: Promise<void> } {
  const events: Array<{ event: string; data: string }> = []
  let req: ReturnType<typeof httpGet>
  let res: IncomingMessage
  const ready = new Promise<void>((resolve) => {
    req = httpGet({ host: '127.0.0.1', port: PORT, path }, (r) => {
      res = r
      let buf = ''
      r.on('data', (c) => {
        buf += c.toString()
        let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i)
          buf = buf.slice(i + 2)
          const ev = /^event: (.*)$/m.exec(block)?.[1] ?? 'message'
          const data = /^data: (.*)$/m.exec(block)?.[1] ?? ''
          events.push({ event: ev, data })
        }
      })
      resolve()
    })
  })
  return {
    events,
    frames: () => events.filter((e) => e.event === 'message').map((e) => JSON.parse(e.data)),
    close: () => { res?.destroy(); req?.destroy() },
    ready
  }
}
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const slide = (text: string, kind = 'bible') => ({ kind, text, reference: 'John 3:16 · KJV' }) as never

describe('the Graphics page, when nothing is live', () => {
  it('hides the whole panel (a lower third has its own backdrop and padding, so empty text alone leaves a dark bar over the camera)', async () => {
    registerGraphicsDestination('g-empty', 'lower-third', false)
    const html = (await getPage('/output/graphics/g-empty')).body
    const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'))
    // the empty branch of applyFrame hides the panel; content shows it again
    expect(script).toMatch(/!payload\.slide \|\| payload\.blanked\) \{[^}]*panelEl\.style\.display = 'none'/s)
    expect(script).toMatch(/panelEl\.style\.display = '';\s*var s = payload\.slide/)
    // a picture or video is its own frame: no empty text panel behind it
    expect(script).toMatch(/if \(s\.kind === 'media'\) \{\s*panelEl\.style\.display = 'none'/)
    expect(() => new Function(script)).not.toThrow()
    unregisterGraphicsDestination('g-empty')
  })
})

describe('backgrounds on a Graphics output', () => {
  it("the full-screen panel's opaque backdrop is made transparent while a still or motion background is drawn (it sat above the background and hid it), and restored after", async () => {
    registerGraphicsDestination('g-bg', 'fullscreen', false)
    const html = (await getPage('/output/graphics/g-bg')).body
    const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'))
    expect(script).toMatch(/panelEl\.style\.background = '';\s*picEl\.style\.display = 'none'/)
    expect(script).toMatch(/bgDimEl\.style\.display = 'block';[^}]*panelEl\.style\.background = 'transparent'/s)
    unregisterGraphicsDestination('g-bg')
  })
})

describe('?profile= — one Graphics output, several layouts', () => {
  it('only real profile names count; anything else (including "auto") means "use the output setting"', () => {
    expect(parseProfileParam('lower-third')).toBe('lower-third')
    expect(parseProfileParam('fullscreen')).toBe('fullscreen')
    for (const v of ['auto', '', null, undefined, 'x', '__proto__', 'toString', 'LOWER-THIRD']) expect(parseProfileParam(v as never)).toBeNull()
  })
  it('the page passes its own query string on to its live feed', async () => {
    registerGraphicsDestination('g-q', 'fullscreen', false)
    const html = (await getPage('/output/graphics/g-q?profile=lower-third')).body
    expect(html).toContain('"/output/graphics/g-q/events" + location.search')
    unregisterGraphicsDestination('g-q')
  })
  it('each page gets its own layout from the same live content, and the output setting still serves pages with no override', async () => {
    registerGraphicsDestination('g-ov', 'fullscreen', false)
    const plain = sse('/output/graphics/g-ov/events')
    const lt = sse('/output/graphics/g-ov/events?profile=lower-third')
    const fs = sse('/output/graphics/g-ov/events?profile=fullscreen')
    const bad = sse('/output/graphics/g-ov/events?profile=nonsense')
    await Promise.all([plain.ready, lt.ready, fs.ready, bad.ready])
    pushGraphicsUpdate('g-ov', { slide: slide('For God so loved the world'), blanked: false })
    await wait(80)
    const last = (c: ReturnType<typeof sse>) => c.frames().at(-1)!
    expect(last(plain).profileId).toBe('fullscreen') // the output's own setting
    expect(last(lt).profileId).toBe('lower-third')
    expect(last(fs).profileId).toBe('fullscreen')
    expect(last(bad).profileId).toBe('fullscreen') // junk override is ignored
    for (const c of [plain, lt, fs, bad]) expect(last(c).slide?.text).toBe('For God so loved the world')
    // changing the OUTPUT's profile moves only the pages that did not ask for one
    pushGraphicsUpdate('g-ov', { slide: null, blanked: true })
    await wait(60)
    for (const c of [plain, lt, fs]) expect(last(c).blanked).toBe(true)
    for (const c of [plain, lt, fs, bad]) c.close()
    unregisterGraphicsDestination('g-ov')
  })
  it('a page that connects later (or reconnects) gets the current frame in ITS layout, not a stale one', async () => {
    registerGraphicsDestination('g-late', 'fullscreen', false)
    pushGraphicsUpdate('g-late', { slide: slide('The LORD is my shepherd'), blanked: false })
    const lt = sse('/output/graphics/g-late/events?profile=lower-third')
    await lt.ready
    await wait(60)
    expect(lt.frames()[0]).toMatchObject({ profileId: 'lower-third', blanked: false, slide: { text: 'The LORD is my shepherd' } })
    lt.close()
    unregisterGraphicsDestination('g-late')
  })
  it('long text is paginated for the layout that shows it (a lower third holds fewer lines)', async () => {
    registerGraphicsDestination('g-pg', 'fullscreen', false)
    const text = Array.from({ length: 12 }, (_, i) => `Line number ${i + 1}`).join('\n')
    const lt = sse('/output/graphics/g-pg/events?profile=lower-third')
    const fs = sse('/output/graphics/g-pg/events?profile=fullscreen')
    await Promise.all([lt.ready, fs.ready])
    pushGraphicsUpdate('g-pg', { slide: slide(text, 'song'), blanked: false })
    await wait(80)
    const lines = (c: ReturnType<typeof sse>): number => c.frames().at(-1)!.slide!.text.split('\n').length
    expect(lines(lt)).toBeLessThanOrEqual(lines(fs))
    expect(lines(lt)).toBeLessThan(12)
    lt.close()
    fs.close()
    unregisterGraphicsDestination('g-pg')
  })
})

describe('keeping the live feed alive', () => {
  it('sends a visible `ping` event on a steady interval, so a page can tell "quiet" from "dead"', async () => {
    const was = graphicsTiming.heartbeatMs
    graphicsTiming.heartbeatMs = 40
    registerGraphicsDestination('g-hb', 'fullscreen', false)
    const c = sse('/output/graphics/g-hb/events')
    await c.ready
    await wait(220)
    graphicsTiming.heartbeatMs = was
    const pings = c.events.filter((e) => e.event === 'ping')
    expect(pings.length).toBeGreaterThanOrEqual(3)
    c.close()
    unregisterGraphicsDestination('g-hb')
  })
  it('the shipped timings: a ping every 15 s, and the page starts over after 45 s of silence (three missed pings)', () => {
    expect(graphicsTiming.heartbeatMs).toBe(15000)
    expect(graphicsTiming.silenceMs).toBe(45000)
    expect(graphicsTiming.silenceMs / graphicsTiming.heartbeatMs).toBeGreaterThanOrEqual(3)
  })
  it('the page watches for silence and restarts its own feed, including after an HTTP error the browser would not retry', async () => {
    registerGraphicsDestination('g-w', 'fullscreen', false)
    const html = (await getPage('/output/graphics/g-w')).body
    expect(html).toContain('> 45000')
    expect(html).toMatch(/addEventListener\('ping'/)
    expect(html).toMatch(/readyState === 2\) setTimeout\(function\(\)\{ if \(live === es\) connect\(\); \}, 2000\)/)
    unregisterGraphicsDestination('g-w')
  })
  it('a removed output answers 404, so a stale OBS source says so instead of looking connected', async () => {
    registerGraphicsDestination('g-gone', 'fullscreen', false)
    unregisterGraphicsDestination('g-gone')
    expect((await getPage('/output/graphics/g-gone')).status).toBe(404)
    expect((await getPage('/output/graphics/g-gone/events')).status).toBe(404)
  })
})
