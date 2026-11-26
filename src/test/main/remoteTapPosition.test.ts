import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { request } from 'http'

vi.mock('os', async () => ({ ...(await vi.importActual<typeof import('os')>('os')), networkInterfaces: () => ({}) }))
const { startWebRemote, stopWebRemote, updateWebRemoteState, livePosition } = await import('../../main/webRemote')

// Own port: the other remote server tests use 43160 and 43161 in parallel workers.
const PORT = 43162
const noopSearch = {} as unknown as Parameters<typeof startWebRemote>[1]
type Cmd = { action: string; tap?: string; at?: string }
let acted: Cmd[] = []

/** the operator window, faked: a Next or Back moves the live page at once, as the real one does within a few milliseconds */
function showPage(slide: number): void {
  updateWebRemoteState({
    queue: [], activeIndex: 0, activeSlide: slide, blanked: false, bibleTranslation: 'KJV',
    onScreen: { kind: 'song', text: `Invented Song page ${slide + 1}` }
  })
}
let slide = 0
beforeEach(async () => {
  acted = []
  slide = 1
  showPage(slide)
  await new Promise<void>((resolve) =>
    startWebRemote((c) => { acted.push(c as Cmd); if (c.action === 'next' || c.action === 'prev') { slide += c.action === 'next' ? 1 : -1; setTimeout(() => showPage(slide), 5) } }, noopSearch, resolve, PORT))
})
afterEach(async () => {
  stopWebRemote()
  await new Promise((r) => setTimeout(r, 50))
})

function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? '' : JSON.stringify(body)
    const req = request({ host: '127.0.0.1', port: PORT, path, method, headers: { 'Content-Type': 'application/json' } }, (res) => {
      let b = ''
      res.on('data', (c) => (b += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, json: b ? JSON.parse(b) : null }))
    })
    req.on('error', reject)
    req.end(data)
  })
}
const state = async (): Promise<Record<string, unknown>> => (await call('GET', '/state')).json!
const later = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('/state', () => {
  it('says where the screen is, and lists the latest taps acted on', async () => {
    await call('POST', '/command', { action: 'blank', tap: 't1' })
    const s = await state()
    expect(typeof s.pos).toBe('string')
    expect(s.taps).toEqual(['t1'])
  })
  it('gives a different place for every page', () => {
    const a = { queue: [], activeIndex: 0, activeSlide: 1, blanked: false, bibleTranslation: 'KJV', onScreen: { kind: 'song', text: 'x' } }
    expect(livePosition(a)).not.toBe(livePosition({ ...a, activeSlide: 2 }))
    expect(livePosition(a)).not.toBe(livePosition({ ...a, onScreen: { kind: 'song', text: 'y' } }))
    expect(livePosition(a)).toBe(livePosition({ ...a, blanked: true }))
  })
})

describe('a Next that says where it was tapped', () => {
  it('is acted on from that place', async () => {
    const r = await call('POST', '/command', { action: 'next', tap: 'a', at: (await state()).pos })
    expect(r.status).toBe(204)
    expect(acted).toHaveLength(1)
  })
  it('two quick taps from the same place move one page', async () => {
    const pos = (await state()).pos
    const [one, two] = await Promise.all([call('POST', '/command', { action: 'next', tap: 'a', at: pos }), call('POST', '/command', { action: 'next', tap: 'b', at: pos })])
    await later(50)
    expect([one.status, two.status].sort()).toEqual([204, 409])
    expect(acted).toHaveLength(1)
    expect(slide).toBe(2)
  })
  it('from a place the screen has left is not acted on, and is told where the screen is', async () => {
    const old = (await state()).pos
    await call('POST', '/command', { action: 'next', tap: 'a', at: old })
    await later(50)
    const r = await call('POST', '/command', { action: 'next', tap: 'b', at: old })
    expect(r.status).toBe(409)
    expect(r.json).toEqual({ pos: (await state()).pos })
    expect(acted).toHaveLength(1)
  })
  it('a retry from the true place moves exactly one page more', async () => {
    await call('POST', '/command', { action: 'next', tap: 'a', at: (await state()).pos })
    await later(50)
    await call('POST', '/command', { action: 'next', tap: 'b', at: (await state()).pos })
    await later(50)
    expect(slide).toBe(3)
  })
  it('Back right after Next from the same place is still acted on', async () => {
    const pos = (await state()).pos
    await call('POST', '/command', { action: 'next', tap: 'a', at: pos })
    const r = await call('POST', '/command', { action: 'prev', tap: 'b', at: (await state()).pos })
    await later(50)
    expect(r.status).toBe(204)
    expect(slide).toBe(1)
  })
})

describe('older calls keep working', () => {
  it('a Next with no place or tap id is acted on, every time', async () => {
    await call('POST', '/command', { action: 'next' })
    await call('POST', '/command', { action: 'next' })
    expect(acted).toHaveLength(2)
  })
  it('the same tap sent twice is acted on once', async () => {
    await call('POST', '/command', { action: 'blank', tap: 'same' })
    const r = await call('POST', '/command', { action: 'blank', tap: 'same' })
    expect(r.status).toBe(204)
    expect(acted).toHaveLength(1)
  })
})
