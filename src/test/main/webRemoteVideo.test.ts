import { get as httpGet, type IncomingMessage } from 'http'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const {
  startWebRemote,
  stopWebRemote,
  setMediaResolver,
  registerGraphicsDestination,
  unregisterGraphicsDestination,
  pushGraphicsPlayback
} = await import('../../main/webRemote')

const PORT = 43172 // (webRemote.test.ts uses 43160 and 43161)
const noopSearch = { sermons: async () => [], bible: async () => ({ kind: 'error', message: '' }), songs: async () => [], song: async () => null, bibleBooks: async () => [], bibleChapter: async () => ({ error: '' }) } as never
const noopAutomation = { goNext() {}, goPrevious() {}, clear() {}, blank() {}, show() {}, getState: () => [] } as never

let dir: string
const FILE = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251))
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'born-webvid-'))
  writeFileSync(join(dir, 'v.mp4'), FILE)
  setMediaResolver(async (id, kind) => (id === 'm_aaaaaaaaaaaa' && kind === 'file' ? { path: join(dir, 'v.mp4'), type: 'video/mp4' } : null))
  await new Promise<void>((resolve) => startWebRemote(() => {}, noopSearch, noopAutomation, resolve, PORT))
})
afterAll(() => {
  stopWebRemote()
  rmSync(dir, { recursive: true, force: true })
})

const get = (path: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: IncomingMessage['headers']; body: Buffer }> =>
  new Promise((resolve, reject) => {
    httpGet({ host: '127.0.0.1', port: PORT, path, headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }))
    }).on('error', reject)
  })

describe('the video file route (Range, so a browser can seek)', () => {
  it('serves the whole file with Accept-Ranges', async () => {
    const r = await get('/media/m_aaaaaaaaaaaa/file')
    expect(r.status).toBe(200)
    expect(r.headers['accept-ranges']).toBe('bytes')
    expect(r.headers['content-type']).toBe('video/mp4')
    expect(r.body.equals(FILE)).toBe(true)
  })
  it('answers a Range request with 206 and exactly those bytes', async () => {
    const r = await get('/media/m_aaaaaaaaaaaa/file', { Range: 'bytes=100-199' })
    expect(r.status).toBe(206)
    expect(r.headers['content-range']).toBe('bytes 100-199/1000')
    expect(r.body.equals(FILE.subarray(100, 200))).toBe(true)
    const tail = await get('/media/m_aaaaaaaaaaaa/file', { Range: 'bytes=-50' })
    expect(tail.body.equals(FILE.subarray(950))).toBe(true)
  })
  it('refuses a range outside the file (416) and an unknown or non-video id (404)', async () => {
    expect((await get('/media/m_aaaaaaaaaaaa/file', { Range: 'bytes=5000-6000' })).status).toBe(416)
    expect((await get('/media/m_bbbbbbbbbbbb/file')).status).toBe(404)
  })
})

describe('the Graphics page and its playback feed', () => {
  const ID = 'graphics-test'
  it('the page plays a video MUTED and follows the clock with the shared rule', async () => {
    registerGraphicsDestination(ID, 'fullscreen', false)
    const page = (await get(`/output/graphics/${ID}`)).body.toString()
    expect(page).toContain('id="vid"')
    expect(page).toContain('followerStep')
    expect(page).toContain('"seekMs":500')
    expect(page).toContain("'/media/' + mediaId + '/file'")
    expect(page).toMatch(/vidEl\.muted = true/)
    expect(page).not.toMatch(/vidEl\.muted = false/)
    expect(page).not.toMatch(/\bcontrols\b/) // no controls to click on an OBS page
    unregisterGraphicsDestination(ID)
  })

  it('pushes playback events to connected pages, replays the last one to a page that connects later, and says when the video is gone', async () => {
    registerGraphicsDestination(ID, 'fullscreen', false)
    const open = (): Promise<{ res: IncomingMessage; text: () => string }> =>
      new Promise((resolve) => {
        httpGet({ host: '127.0.0.1', port: PORT, path: `/output/graphics/${ID}/events` }, (res) => {
          let buf = ''
          res.setEncoding('utf8')
          res.on('data', (c) => { buf += c })
          resolve({ res, text: () => buf })
        })
      })
    const a = await open()
    pushGraphicsPlayback(ID, { mediaId: 'm_aaaaaaaaaaaa', status: 'playing', position: 12.5 })
    await new Promise((r) => setTimeout(r, 80))
    expect(a.text()).toContain('event: playback')
    expect(a.text()).toContain('"position":12.5')
    const b = await open() // connects mid-video
    await new Promise((r) => setTimeout(r, 80))
    expect(b.text()).toContain('event: playback')
    pushGraphicsPlayback(ID, null)
    await new Promise((r) => setTimeout(r, 80))
    expect(a.text()).toContain('event: playback-stop')
    a.res.destroy()
    b.res.destroy()
    unregisterGraphicsDestination(ID)
  })

  it('pushing to a destination that does not exist is harmless', () => {
    expect(() => pushGraphicsPlayback('nope', { x: 1 })).not.toThrow()
  })
})
