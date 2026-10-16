import { describe, it, expect } from 'vitest'
import { toWire, wirePosition, initialPlayback, playbackReduce as R, positionNow, timeRemaining, playbackBlank, FollowerController, SYNC, formatClock, judgeVideo } from '../../shared/videoPlayback'

const T0 = 1_000_000
const fresh = (o = {}) => initialPlayback('m_1', { duration: 60, ...o }, T0)

describe('playback record', () => {
  it('starts paused at 0 and nothing plays by itself', () => {
    const s = fresh()
    expect(s).toMatchObject({ status: 'paused', position: 0, hasPlayedOnce: false })
    expect(positionNow(s, T0 + 5000)).toBe(0)
  })
  it('play / pause keep the position by the clock', () => {
    let s = R(fresh(), { type: 'play' }, T0)
    expect(s).toMatchObject({ status: 'playing', hasPlayedOnce: true })
    expect(positionNow(s, T0 + 12_500)).toBeCloseTo(12.5)
    s = R(s, { type: 'pause' }, T0 + 12_500)
    expect(s.position).toBeCloseTo(12.5)
    expect(positionNow(s, T0 + 99_000)).toBeCloseTo(12.5)
  })
  it('seek clamps to the length; seeking after the end brings it back to paused', () => {
    let s = R(fresh(), { type: 'seek', to: 999 }, T0)
    expect(s.position).toBe(60)
    s = R(fresh(), { type: 'seek', to: -3 }, T0)
    expect(s.position).toBe(0)
    const ended = { ...fresh(), status: 'ended' as const, position: 60 }
    expect(R(ended, { type: 'seek', to: 10 }, T0).status).toBe('paused')
  })
  it('stops at the end (no loop) and wraps (loop)', () => {
    let s = R(fresh({ duration: 10 }), { type: 'play' }, T0)
    expect(positionNow(s, T0 + 25_000)).toBe(10)
    s = R(fresh({ duration: 10, loop: true }), { type: 'play' }, T0)
    expect(positionNow(s, T0 + 25_000)).toBeCloseTo(5)
  })
  it('play on an ended video starts again from 0', () => {
    const ended = R(R(fresh({ duration: 10 }), { type: 'play' }, T0), { type: 'report', position: 10, playing: false, ended: true }, T0 + 10_000)
    expect(ended.status).toBe('ended')
    const again = R(ended, { type: 'play' }, T0 + 20_000)
    expect(again).toMatchObject({ status: 'playing', position: 0 })
  })
  it('a leader report corrects the clock; a looping video never "ends"', () => {
    let s = R(fresh(), { type: 'play' }, T0)
    s = R(s, { type: 'report', position: 20, playing: true }, T0 + 19_000)
    expect(positionNow(s, T0 + 19_000)).toBe(20)
    const loop = R(R(fresh({ loop: true }), { type: 'play' }, T0), { type: 'report', position: 0, playing: true, ended: true }, T0 + 60_000)
    expect(loop.status).toBe('playing')
  })
  it('an error report stops it and keeps the message', () => {
    const s = R(R(fresh(), { type: 'play' }, T0), { type: 'report', position: 3, playing: false, error: 'decode error' }, T0 + 3000)
    expect(s).toMatchObject({ status: 'error', error: 'decode error' })
    expect(R(s, { type: 'play' }, T0 + 4000).status).toBe('error') // cannot "play" a broken video
  })
  it('stalled is only meaningful while playing', () => {
    const p = R(fresh(), { type: 'play' }, T0)
    expect(R(p, { type: 'report', position: 5, playing: false, stalled: true }, T0 + 5000).stalled).toBe(true)
    expect(R(fresh(), { type: 'report', position: 5, playing: false, stalled: true }, T0).stalled).toBe(false)
  })
  it('panic/blank pauses at once and never resumes by itself', () => {
    const p = R(fresh(), { type: 'play' }, T0)
    const b = playbackBlank(p, T0 + 7000)
    expect(b).toMatchObject({ status: 'paused', position: 7 })
    expect(positionNow(b, T0 + 70_000)).toBe(7)
  })
  it('volume is clamped; time remaining counts down', () => {
    expect(R(fresh(), { type: 'volume', value: 5 }).volume).toBe(1)
    expect(R(fresh(), { type: 'volume', value: -1 }).volume).toBe(0)
    const p = R(fresh({ duration: 100 }), { type: 'play' }, T0)
    expect(timeRemaining(p, T0 + 30_000)).toBeCloseTo(70)
    expect(timeRemaining(initialPlayback('x', {}, T0), T0)).toBeNull()
  })
})

describe('follower correction (spike 3: nudge 40–500 ms, seek beyond, still when it cannot catch up)', () => {
  it('does nothing within 40 ms, nudges the rate ±5% in between, in the right direction', () => {
    const f = new FollowerController()
    expect(f.tick(10, 10.02, 0)).toEqual({ kind: 'rate', rate: 1 })
    expect(f.tick(10, 10.2, 1000)).toEqual({ kind: 'rate', rate: 0.95 }) // ahead: slow down
    expect(f.tick(10, 9.8, 2000)).toEqual({ kind: 'rate', rate: 1.05 }) // behind: speed up
    expect(f.tick(10, 10.45, 3000)).toEqual({ kind: 'rate', rate: 0.95 })
  })
  it('hard-seeks beyond 500 ms, once, then waits for it to settle', () => {
    const f = new FollowerController()
    expect(f.tick(30, 28, 0)).toEqual({ kind: 'seek', to: 30 })
    expect(f.tick(31, 28.5, 1000)).toEqual({ kind: 'rate', rate: 1 }) // settling: no second seek
    expect(f.tick(32, 32.01, SYNC.settleMs + 1)).toEqual({ kind: 'rate', rate: 1 })
  })
  it('shows the still frame when it still cannot catch up after repeated seeks, and comes back when close again', () => {
    const f = new FollowerController()
    let t = 0
    const actions: string[] = []
    for (let i = 0; i < 8; i++) { actions.push(f.tick(100 + i * 3, 50, t).kind); t += SYNC.settleMs + 100 }
    expect(actions).toContain('still')
    expect(f.showingStill).toBe(true)
    // in "still" it keeps trying (rate-limited seeks) and recovers when within range
    expect(f.tick(200, 200.01, t + 5000).kind).toBe('rate')
    expect(f.showingStill).toBe(false)
  })
  it('a single bad second does not flip to still', () => {
    const f = new FollowerController()
    expect(f.tick(30, 28, 0).kind).toBe('seek')
    expect(f.tick(31, 31.02, SYNC.settleMs + 10).kind).toBe('rate')
    expect(f.showingStill).toBe(false)
  })
  it('across the loop point the short way round is the error', () => {
    const f = new FollowerController()
    // leader just wrapped to 0.1 s, follower is at 29.95 s of a 30 s loop: 150 ms behind, not 29.85 s ahead
    expect(f.tick(0.1, 29.95, 0, { loop: true, duration: 30 })).toEqual({ kind: 'rate', rate: 1.05 })
  })
})

describe('time display', () => {
  it('formats minutes and hours', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(75.9)).toBe('1:15')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(null)).toBe('–:––')
  })
})

describe('what a file may be (the resolved limits)', () => {
  const ok = { brand: 'isom', videoCodec: 'avc1', audioCodec: 'mp4a', width: 1920, height: 1080, fps: 30, bitrate: 8_000_000 }
  it('accepts H.264 + AAC MP4 with no warnings', () => {
    expect(judgeVideo(ok)).toEqual({ ok: true, warnings: [] })
    expect(judgeVideo({ ...ok, audioCodec: null })).toEqual({ ok: true, warnings: [] })
  })
  it('refuses other containers, codecs and audio, and anything over 4K — with a reason', () => {
    expect(judgeVideo({ ...ok, brand: 'qt  ' })).toMatchObject({ ok: false, code: 'video-container' })
    expect(judgeVideo({ ...ok, videoCodec: 'hvc1' })).toMatchObject({ ok: false, code: 'video-codec', detail: 'HEVC (H.265)' })
    expect(judgeVideo({ ...ok, videoCodec: 'av01' })).toMatchObject({ ok: false, code: 'video-codec' })
    expect(judgeVideo({ ...ok, audioCodec: 'ac-3' })).toMatchObject({ ok: false, code: 'video-codec' })
    expect(judgeVideo({ ...ok, width: 7680, height: 4320 })).toMatchObject({ ok: false, code: 'video-too-large' })
  })
  it('warns (never refuses) for 4K, high frame rate and high bit rate', () => {
    const k = judgeVideo({ ...ok, width: 3840, height: 2160, bitrate: 30_000_000 })
    expect(k.ok && k.warnings).toHaveLength(1)
    expect(k.ok && k.warnings[0]).toMatch(/4K/)
    const hi = judgeVideo({ ...ok, bitrate: 25_000_000, fps: 60 })
    expect(hi.ok && hi.warnings).toHaveLength(2)
    const k2 = judgeVideo({ ...ok, width: 3840, height: 2160, bitrate: 45_000_000 })
    expect(k2.ok && k2.warnings).toHaveLength(2)
  })
})

describe('what travels to the other screens', () => {
  it('a message carries the position at send time and a receiver extrapolates on its own clock', () => {
    const p = R(fresh({ duration: 100 }), { type: 'play' }, T0)
    const w = toWire('main', p, T0 + 20_000)
    expect(w).toMatchObject({ channelId: 'main', mediaId: 'm_1', status: 'playing', duration: 100 })
    expect(w.position).toBeCloseTo(20)
    expect(wirePosition(w, 1500)).toBeCloseTo(21.5)
    expect(wirePosition({ ...w, status: 'paused' }, 5000)).toBeCloseTo(20)
  })
  it('the epoch changes only on commands that move the position, never on the leader\'s own reports', () => {
    let s = fresh()
    const e0 = s.epoch
    s = R(s, { type: 'play' }, T0)
    expect(s.epoch).toBe(e0)
    s = R(s, { type: 'report', position: 4, playing: true }, T0 + 4000)
    expect(s.epoch).toBe(e0)
    s = R(s, { type: 'seek', to: 30 }, T0 + 5000)
    expect(s.epoch).toBe(e0 + 1)
    s = R(s, { type: 'pause' }, T0 + 6000)
    expect(s.epoch).toBe(e0 + 1)
  })
  it('wraps a looping position', () => {
    const w = toWire('main', R(fresh({ duration: 10, loop: true }), { type: 'play' }, T0), T0 + 9000)
    expect(wirePosition(w, 3000)).toBeCloseTo(2)
  })
})

import { followerStep, newFollowerMemory } from '../../shared/videoPlayback'
describe('the rule the Graphics page embeds', () => {
  it('followerStep is self-contained: rebuilt from its own source it gives the same answers', () => {
    // exactly what the Graphics page does: evaluate the function's source text with nothing else in scope
    const rebuilt = new Function('return ' + followerStep.toString())() as typeof followerStep
    const a = newFollowerMemory()
    const b = newFollowerMemory()
    let t = 0
    for (const [leader, mine] of [[10, 10.01], [10, 10.2], [10, 9.7], [30, 10], [31, 10], [34, 10], [40, 10], [50, 10], [60, 60.01]]) {
      expect(rebuilt(b, SYNC, leader, mine, t, false, null)).toEqual(followerStep(a, SYNC, leader, mine, t, false, null))
      t += 1200
    }
  })
})
