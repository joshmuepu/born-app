import { describe, it, expect, vi, afterEach } from 'vitest'
import { probeVideo, preflightYouTube, testPlay, type ProbeDeps, type ProbeHost } from '../../main/youtubeProbe'
import type { HostMessage } from '../../main/youtubeHost'

/** A pretend YouTube: for each video id, the messages its player page would send (and when). */
function fakeDeps(script: Record<string, HostMessage[]>, o: { internet?: boolean; timeoutMs?: number } = {}): { deps: ProbeDeps; opened: string[]; closed: number[] } {
  const listeners = new Map<string, (m: HostMessage) => void>()
  const opened: string[] = []
  const closed: number[] = []
  let n = 0
  const host: ProbeHost = {
    start: async () => 1,
    newSession: () => `s${++n}`,
    listen: (sid, cb) => { listeners.set(sid, cb); return () => listeners.delete(sid) },
    urlFor: (v, x) => `http://127.0.0.1:1/player.html?v=${v}&sid=${x.sid}&mode=${x.mode}`
  }
  const open = (url: string): { close(): void } => {
    opened.push(url)
    const q = new URL(url).searchParams
    const msgs = script[q.get('v') ?? ''] ?? []
    const sid = q.get('sid') ?? ''
    msgs.forEach((m, i) => setTimeout(() => listeners.get(sid)?.(m), 5 + i * 5))
    const idx = opened.length
    return { close: () => { closed.push(idx) } }
  }
  return { deps: { host, openHidden: open, openVisible: open, checkInternet: async () => o.internet ?? true, timeoutMs: o.timeoutMs ?? 400 }, opened, closed }
}

afterEach(() => vi.useRealTimers())

describe('probing one video with a hidden player', () => {
  it('cued = ready (with its length), and the hidden window is closed', async () => {
    const { deps, closed } = fakeDeps({ AAAAAAAAAAA: [{ t: 'ready' }, { t: 'state', state: 5, duration: 212 }] })
    expect(await probeVideo(deps, 'AAAAAAAAAAA')).toEqual({ kind: 'ready', duration: 212, live: false })
    expect(closed).toEqual([1])
  })
  it('an error code from the player is passed on as it is', async () => {
    const { deps } = fakeDeps({ BBBBBBBBBBB: [{ t: 'ready' }, { t: 'error', code: 101 }] })
    expect(await probeVideo(deps, 'BBBBBBBBBBB')).toEqual({ kind: 'error', code: 101 })
  })
  it('the page could not load YouTube at all (code -1) counts as "did not answer"', async () => {
    const { deps } = fakeDeps({ CCCCCCCCCCC: [{ t: 'error', code: -1 }] })
    expect(await probeVideo(deps, 'CCCCCCCCCCC')).toEqual({ kind: 'timeout' })
  })
  it('silence times out (and the window is still closed)', async () => {
    const { deps, closed } = fakeDeps({ DDDDDDDDDDD: [] }, { timeoutMs: 60 })
    expect(await probeVideo(deps, 'DDDDDDDDDDD')).toEqual({ kind: 'timeout' })
    expect(closed).toEqual([1])
  })
  it('a page that settles with no length is a live video', async () => {
    const { deps } = fakeDeps({ EEEEEEEEEEE: [{ t: 'ready' }, { t: 'settled', duration: 0 }] })
    expect(await probeVideo(deps, 'EEEEEEEEEEE')).toMatchObject({ kind: 'ready', live: true, duration: null })
  })
  it('only the first answer counts', async () => {
    const { deps } = fakeDeps({ FFFFFFFFFFF: [{ t: 'state', state: 5, duration: 10 }, { t: 'error', code: 100 }] })
    expect((await probeVideo(deps, 'FFFFFFFFFFF')).kind).toBe('ready')
  })
})

describe('checking a whole queue', () => {
  const script = {
    GOODGOODGOO: [{ t: 'state', state: 5, duration: 100 }] as HostMessage[],
    GONEGONEGON: [{ t: 'error', code: 100 }] as HostMessage[],
    NOEMBEDNOEM: [{ t: 'error', code: 150 }] as HostMessage[],
    IDENTITY153: [{ t: 'error', code: 153 }] as HostMessage[]
  }
  it('gives each item its own plain verdict, in order', async () => {
    const { deps } = fakeDeps(script)
    const r = await preflightYouTube(deps, [
      { videoId: 'GOODGOODGOO', hasFallback: true },
      { videoId: 'GONEGONEGON', hasFallback: false },
      { videoId: 'NOEMBEDNOEM', hasFallback: true },
      { videoId: 'IDENTITY153', hasFallback: true }
    ])
    expect(r.map((x) => x.status)).toEqual(['ready', 'blocked', 'not-embeddable', 'blocked'])
    expect(r.map((x) => x.level)).toEqual(['pass', 'fail', 'fail', 'fail'])
    expect(r[0].duration).toBe(100)
    expect(r[3].title).toMatch(/identify BORN/)
  })
  it('offline: no player is opened at all, every item is "can\'t check", and nothing is removed', async () => {
    const { deps, opened } = fakeDeps(script, { internet: false })
    const r = await preflightYouTube(deps, [{ videoId: 'GOODGOODGOO', hasFallback: false }, { videoId: 'GONEGONEGON', hasFallback: true }])
    expect(opened).toHaveLength(0)
    expect(r).toHaveLength(2)
    for (const x of r) { expect(x.status).toBe('unreachable'); expect(x.level).toBe('warn') }
  })
  it('the same video twice is asked once; an empty queue asks nothing', async () => {
    const { deps, opened } = fakeDeps(script)
    await preflightYouTube(deps, [{ videoId: 'GOODGOODGOO', hasFallback: true }, { videoId: 'GOODGOODGOO', hasFallback: false }])
    expect(opened).toHaveLength(1)
    expect(await preflightYouTube(deps, [])).toEqual([])
  })
  it('one slow video does not stop the rest being checked', async () => {
    const { deps } = fakeDeps({ ...script, SLOWSLOWSLO: [] }, { timeoutMs: 50 })
    const r = await preflightYouTube(deps, [{ videoId: 'SLOWSLOWSLO', hasFallback: true }, { videoId: 'GOODGOODGOO', hasFallback: true }])
    expect(r.map((x) => x.status)).toEqual(['unreachable', 'ready'])
  })
})

describe('Test play', () => {
  it('passes only when the player really reached "playing" with no error', async () => {
    const { deps } = fakeDeps({ PLAYPLAYPLA: [{ t: 'ready' }, { t: 'state', state: 3 }, { t: 'tick', state: 1, time: 2.4 }] })
    const r = await testPlay(deps, 'PLAYPLAYPLA', 80)
    expect(r).toMatchObject({ ok: true, state: 1, code: null })
    expect(r.seconds).toBeGreaterThan(2)
  })
  it('fails with the error code when YouTube refuses', async () => {
    const { deps } = fakeDeps({ REFUSEREFUS: [{ t: 'ready' }, { t: 'error', code: 101 }] })
    expect(await testPlay(deps, 'REFUSEREFUS', 60)).toMatchObject({ ok: false, code: 101 })
  })
  it('fails (not hangs) when nothing ever plays, and closes the window', async () => {
    const { deps, closed } = fakeDeps({ NOTHINGNOTH: [{ t: 'ready' }] })
    expect(await testPlay(deps, 'NOTHINGNOTH', 60)).toMatchObject({ ok: false, code: null })
    expect(closed).toHaveLength(1)
  })
  it('shows the plain explanation inside the test window when YouTube refuses, and keeps that window open to be read', async () => {
    const { deps, closed } = fakeDeps({ REFUSEREFUS: [{ t: 'ready' }, { t: 'error', code: 150 }] })
    const shown: Array<[string, number]> = []
    const open = deps.openVisible
    deps.openVisible = (url) => ({ ...open(url), showMessage: (t, k) => { shown.push([t, k]) } })
    await testPlay(deps, 'REFUSEREFUS', 60)
    expect(shown).toHaveLength(1)
    expect(shown[0][0]).toMatch(/owner of this video does not allow it/)
    expect(shown[0][0]).toMatch(/Media library/)
    expect(closed).toHaveLength(0) // the window closes itself after the message has been up a while
  })
})
