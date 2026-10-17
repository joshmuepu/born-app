import { request as httpRequest } from 'http'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { WebSocket } from 'ws'

const { startWebRemote, stopWebRemote, setTapeProviders, setAutomationToken } = await import('../../main/webRemote')

const PORT = 43183 // (others use 43160, 43161, 43172 and 43181)
const noopSearch = { sermons: async () => [], bible: async () => ({ kind: 'error', message: '' }), songs: async () => [], song: async () => null, bibleBooks: async () => [], bibleChapter: async () => ({ error: '' }) } as never

const SUMMARY = { recordingId: 'r_1', sermonId: 1, status: 'paused', position: 150, duration: 1000, canPlay: false, hasTiming: true, timingVersion: 'v1', paragraph: 2, nextParagraph: 3, nextInSec: 50, sync: 'in-sync', speed: 1, volume: 0.5, stalled: false, error: null, note: null }
let tapeOn = true
const calls: string[] = []
const automation = {
  goNext() {}, goPrevious() {}, clear() {}, blank() {}, show() {}, getState: () => [],
  getTape: () => (tapeOn ? SUMMARY : null),
  tapeCommand: (a: string) => { calls.push(a); return a === 'play' ? { ok: false, reason: 'not-started', message: 'Start the tape on the main computer first.' } : { ok: true } }
} as never
const commands: unknown[] = []

beforeAll(async () => {
  setTapeProviders(() => (tapeOn ? SUMMARY : null), () => (tapeOn ? { recordingId: 'r_1', items: [{ n: 1, t: 10, snippet: 'First words' }] } : null))
  await new Promise<void>((resolve) => startWebRemote((c) => commands.push(c), noopSearch, automation, resolve, PORT))
})
afterAll(() => { setAutomationToken(null); stopWebRemote() })

const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port: PORT, path, method, headers: { 'Content-Type': 'application/json', ...headers } }, (res) => {
      let b = ''
      res.on('data', (c) => (b += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: b }))
    })
    req.on('error', reject)
    if (body !== undefined) req.write(JSON.stringify(body))
    req.end()
  })
const getJson = async (path: string, headers: Record<string, string> = {}): Promise<unknown> => JSON.parse((await call('GET', path, undefined, headers)).body)

describe('the phone remote: state and paragraph list', () => {
  it('/state gains a tape field (and nothing else about it changes)', async () => {
    const s = (await getJson('/state')) as Record<string, unknown>
    expect(s.tape).toMatchObject({ recordingId: 'r_1', paragraph: 2, canPlay: false, sync: 'in-sync' })
    expect('queue' in s).toBe(true)
    expect('playback' in s).toBe(true)
  })
  it('the same state under /api/v1 (the versioned path)', async () => {
    expect(((await getJson('/api/v1/state')) as { tape: unknown }).tape).toMatchObject({ recordingId: 'r_1' })
  })
  it('the paragraph list is its own route (it is not carried on every state poll)', async () => {
    expect(await getJson('/api/v1/tape/paragraphs')).toEqual({ recordingId: 'r_1', items: [{ n: 1, t: 10, snippet: 'First words' }] })
    expect(await getJson('/api/tape/paragraphs')).toMatchObject({ recordingId: 'r_1' })
  })
  it('with no tape loaded: tape is null and the list is null', async () => {
    tapeOn = false
    expect(((await getJson('/state')) as { tape: unknown }).tape).toBeNull()
    expect(await getJson('/api/v1/tape/paragraphs')).toBeNull()
    tapeOn = true
  })
  it('the phone\'s /command carries tape actions through to the app, which applies the rules', async () => {
    const r = await call('POST', '/command', { action: 'tape-jump', n: 3, confirm: true })
    expect(r.status).toBe(204)
    expect(commands).toContainEqual({ action: 'tape-jump', n: 3, confirm: true })
  })
})

describe('the automation API: /api/v1/automation/tape', () => {
  it('GET returns the summary (and the old route is an alias)', async () => {
    expect(await getJson('/api/v1/automation/tape')).toMatchObject({ recordingId: 'r_1', position: 150, paragraph: 2, nextParagraph: 3, nextInSec: 50, speed: 1, volume: 0.5 })
    expect(await getJson('/api/automation/tape')).toMatchObject({ recordingId: 'r_1' })
  })
  it.each(['play', 'pause', 'back', 'forward', 'next-paragraph', 'prev-paragraph'])('POST …/tape/%s is accepted and passed on', async (a) => {
    calls.length = 0
    const r = await call('POST', `/api/v1/automation/tape/${a}`)
    expect(calls).toEqual([a])
    expect([200, 409]).toContain(r.status)
  })
  it('a refusal is a 409 with the plain reason (Play before the operator started the tape)', async () => {
    const r = await call('POST', '/api/v1/automation/tape/play')
    expect(r.status).toBe(409)
    expect(JSON.parse(r.body)).toMatchObject({ ok: false, reason: 'not-started', message: expect.stringMatching(/main computer first/) })
  })
  it('there is NO seek-to-time, jump, volume or speed route: they are plain 404s', async () => {
    calls.length = 0
    for (const a of ['seek', 'seek/500', 'jump/3', 'volume/1', 'speed/2', 'load', 'load/r_2']) {
      const r = await call('POST', `/api/v1/automation/tape/${a}`)
      expect(r.status).toBe(404)
    }
    expect(calls).toEqual([])
  })
  it('only POST changes anything: a GET on an action route does not play', async () => {
    calls.length = 0
    const r = await call('GET', '/api/v1/automation/tape/play')
    expect(r.status).toBe(404)
    expect(calls).toEqual([])
  })
  it('when an automation token is set, the tape routes need it like every other automation route', async () => {
    setAutomationToken('s3cret')
    expect((await call('GET', '/api/v1/automation/tape')).status).toBe(401)
    expect((await call('POST', '/api/v1/automation/tape/pause')).status).toBe(401)
    expect((await call('GET', '/api/v1/automation/tape', undefined, { 'X-BORN-Token': 's3cret' })).status).toBe(200)
    expect((await call('POST', '/api/v1/automation/tape/pause', undefined, { 'X-BORN-Token': 's3cret' })).status).toBe(200)
    setAutomationToken(null)
  })
})

describe('the automation WebSocket', () => {
  it('its "v":1 frame gains a tape field (additive: state is still there)', async () => {
    const frame = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/v1/automation/ws`)
      ws.on('message', (d) => { resolve(JSON.parse(String(d))); ws.close() })
      ws.on('error', reject)
    })
    expect(frame.v).toBe(1)
    expect(Array.isArray(frame.state)).toBe(true)
    expect(frame.tape).toMatchObject({ recordingId: 'r_1', paragraph: 2 })
  })
})
