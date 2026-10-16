import { describe, it, expect, beforeEach } from 'vitest'
import { PlaybackHub } from '../../main/mediaPlayback'
import type { PlaybackWire } from '../../shared/videoPlayback'

let t = 1_000_000
let sent: PlaybackWire[] = []
let stops: string[] = []
let hub: PlaybackHub
beforeEach(() => {
  t = 1_000_000
  sent = []
  stops = []
  hub = new PlaybackHub({ now: () => t, emit: (m) => sent.push(m), emitStop: (c) => stops.push(c) })
})

describe('PlaybackHub', () => {
  it('Take waits paused on the first frame; nothing plays by itself', () => {
    const s = hub.take('main', 'm_1', { duration: 30 })
    expect(s).toMatchObject({ status: 'paused', position: 0, hasPlayedOnce: false })
    expect(sent.at(-1)).toMatchObject({ channelId: 'main', mediaId: 'm_1', status: 'paused' })
    t += 60_000
    hub.tick()
    expect(sent).toHaveLength(1) // a paused video sends no ticks
  })

  it('Play / Pause / seek from the operator, with the clock running between', () => {
    hub.take('main', 'm_1', { duration: 100 })
    hub.command('main', { type: 'play' })
    t += 10_000
    hub.tick()
    expect(sent.at(-1)!.position).toBeCloseTo(10)
    hub.command('main', { type: 'seek', to: 50 })
    expect(sent.at(-1)).toMatchObject({ position: 50, status: 'playing' })
    hub.command('main', { type: 'pause' })
    t += 20_000
    expect(hub.get('main')!.position).toBeCloseTo(50)
  })

  it('commands on a channel with nothing live do nothing, and unknown commands are refused', () => {
    expect(hub.command('main', { type: 'play' })).toBeNull()
    hub.take('main', 'm_1', { duration: 10 })
    expect(hub.command('main', { type: 'explode' } as never)).toBeNull()
  })

  it('the leader\'s reports become the clock, but only changes of state are broadcast', () => {
    hub.take('main', 'm_1', { duration: 100 })
    hub.command('main', { type: 'play' })
    const n = sent.length
    t += 5000
    hub.report('main', { position: 5.2, playing: true })
    expect(sent).toHaveLength(n) // just time: followers get it on the 1 s tick
    expect(hub.get('main')!.position).toBeCloseTo(5.2)
    hub.report('main', { position: 5.2, playing: false, stalled: true })
    expect(sent.at(-1)).toMatchObject({ stalled: true })
    hub.report('main', { position: 100, playing: false, ended: true })
    expect(sent.at(-1)).toMatchObject({ status: 'ended' })
  })

  it('a leader that learns the real length tells everyone', () => {
    hub.take('main', 'm_1', { duration: null })
    hub.report('main', { position: 0, playing: false, duration: 42.5 })
    expect(sent.at(-1)).toMatchObject({ duration: 42.5 })
  })

  it('PANIC: blank pauses at once, silently resumes nothing, and a later play is a deliberate act', () => {
    hub.take('main', 'm_1', { duration: 100 })
    hub.command('main', { type: 'play' })
    t += 7000
    hub.blank('main')
    expect(sent.at(-1)).toMatchObject({ status: 'paused', position: 7 })
    t += 99_000
    hub.tick()
    expect(hub.get('main')).toMatchObject({ status: 'paused' })
    expect(hub.get('main')!.position).toBeCloseTo(7)
  })

  it('stop forgets the video and tells everyone once', () => {
    hub.take('main', 'm_1', { duration: 10 })
    hub.stop('main')
    hub.stop('main')
    expect(stops).toEqual(['main'])
    expect(hub.get('main')).toBeNull()
  })

  it('volume and mute carry over to the next video the operator takes', () => {
    hub.take('main', 'm_1', { duration: 10 })
    hub.command('main', { type: 'volume', value: 0.4 })
    hub.command('main', { type: 'muted', value: true })
    const next = hub.take('main', 'm_2', { duration: 20 })
    expect(next).toMatchObject({ volume: 0.4, muted: true, mediaId: 'm_2', position: 0 })
  })

  describe('the phone', () => {
    it('cannot start a video that has not been played yet (no first play with sound)', () => {
      hub.take('main', 'm_1', { duration: 10 })
      expect(hub.phone('main', 'media-play')).toEqual({ ok: false, reason: 'not-started' })
      expect(hub.get('main')!.status).toBe('paused')
    })
    it('can pause at any time and resume once the operator has started it', () => {
      hub.take('main', 'm_1', { duration: 10 })
      hub.command('main', { type: 'play' })
      expect(hub.phone('main', 'media-pause')).toEqual({ ok: true })
      expect(hub.get('main')!.status).toBe('paused')
      expect(hub.phone('main', 'media-play')).toEqual({ ok: true })
      expect(hub.get('main')!.status).toBe('playing')
    })
    it('refuses when nothing is live', () => {
      expect(hub.phone('main', 'media-pause')).toEqual({ ok: false, reason: 'nothing-live' })
    })
  })
})
