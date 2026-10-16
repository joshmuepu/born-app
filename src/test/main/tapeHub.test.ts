import { describe, it, expect } from 'vitest'
import { TapeHub, type EngineMessage, type TapeHubDeps } from '../../main/tapeHub'
import type { TapeWire } from '../../shared/tapePlayback'
import type { TapeRecording } from '../../shared/tape'

const file = { id: 't_aaaaaaaaaaaa', hash: 'h', name: 'x', origFilename: 'x.m4a', ext: 'm4a', container: 'm4a', codec: 'mp4a', bytes: 1, durationSec: 8688, bitrate: 1, vbr: null, seekTableOk: true, storage: 'managed' as const, linkPath: null, addedAt: '' }
const mk = (id: string, sermonId = 1115): TapeRecording => ({ id, sermonId, language: 'en', label: '', createdAt: '', file: { ...file, id: 't_' + id.padEnd(12, 'a').slice(0, 12) }, synced: false })

function setup(o: { resume?: number | null; videoPlaying?: boolean } = {}) {
  let t = 1_000_000
  const sent: Array<TapeWire | null> = [], engine: EngineMessage[] = [], saved: Array<[string, number]> = [], notices: string[] = []
  let video = !!o.videoPlaying, videoPaused = 0
  const d: TapeHubDeps = {
    now: () => t,
    emit: (w) => sent.push(w),
    engine: (m) => engine.push(m),
    savePosition: (id, s) => saved.push([id, s]),
    loadRecording: (id) => ({ recording: mk(id), resume: o.resume ?? null }),
    settings: () => ({ outputDeviceId: 'spk', outputDeviceLabel: 'Sanctuary speakers', volume: 0.8 }),
    videoPlaying: () => video,
    pauseVideo: () => { video = false; videoPaused++ },
    notice: (m) => notices.push(m)
  }
  const hub = new TapeHub(d)
  const ready = (pos = 0): void => hub.report({ position: pos, playing: false, duration: 8688, ready: true })
  return { hub, sent, engine, saved, notices, advance: (ms: number) => { t += ms }, ready, videoPaused: () => videoPaused }
}

describe('loading', () => {
  it('loads PAUSED at the resume position, with the saved device and volume; nothing plays', () => {
    const { hub, engine } = setup({ resume: 4323.5 })
    const r = hub.load('r_1')!
    expect(r).toMatchObject({ status: 'loading', position: 4323.5, deviceId: 'spk', volume: 0.8, hasPlayedOnce: false })
    expect(engine.at(-1)).toMatchObject({ type: 'apply', status: 'loading', position: 4323.5 })
  })
  it('play-on-load waits for the file to be ready, then plays', () => {
    const { hub, ready } = setup()
    hub.load('r_1', { play: true })
    expect(hub.record?.status).toBe('loading')
    ready(0)
    expect(hub.record).toMatchObject({ status: 'playing', hasPlayedOnce: true })
  })
  it('loading another recording saves where the first one stopped', () => {
    const { hub, saved, advance, ready } = setup()
    hub.load('r_nope')
    ready(); hub.command({ type: 'play' }); advance(30_000)
    hub.load('r_2')
    expect(saved.at(-1)?.[0]).toBe('r_nope')
    expect(saved.at(-1)?.[1]).toBeCloseTo(30, 0)
  })
})

describe('commands and the engine', () => {
  it('every command is applied to the record and sent to the engine, which seeks only when the epoch changes', () => {
    const { hub, engine, ready } = setup()
    hub.load('r_1'); ready()
    hub.command({ type: 'play' })
    const e1 = (engine.at(-1) as { epoch: number }).epoch
    hub.command({ type: 'speed', value: 1.1 })
    expect((engine.at(-1) as { epoch: number }).epoch).toBe(e1)
    hub.command({ type: 'seek', to: 1000 })
    expect((engine.at(-1) as { epoch: number }).epoch).toBe(e1 + 1)
  })
  it('without a tape every command is ignored', () => {
    const { hub } = setup()
    expect(hub.command({ type: 'play' })).toBeNull()
  })
  it('the engine\'s reports are the clock', () => {
    const { hub, ready } = setup()
    hub.load('r_1'); ready(); hub.command({ type: 'play' })
    hub.report({ position: 12.5, playing: true })
    expect(hub.record?.position).toBe(12.5)
  })
})

describe('only one sound at a time', () => {
  it('starting the tape pauses a playing video, and says so', () => {
    const { hub, ready, videoPaused, notices } = setup({ videoPlaying: true })
    hub.load('r_1'); ready()
    hub.command({ type: 'play' })
    expect(videoPaused()).toBe(1)
    expect(notices[0]).toMatch(/only one sound at a time/)
    expect(hub.record?.status).toBe('playing')
  })
  it('a video (or YouTube) taking the screen pauses the tape with a reason the bar can show', () => {
    const { hub, ready } = setup()
    hub.load('r_1'); ready(); hub.command({ type: 'play' })
    hub.pauseFor('video')
    expect(hub.record).toMatchObject({ status: 'paused', pausedBy: 'video' })
    hub.pauseFor('video') // pausing a paused tape is harmless
    expect(hub.record?.status).toBe('paused')
  })
})

describe('resume position', () => {
  it('is saved when the tape pauses, when it jumps, on unload, and every 5 seconds while it plays', () => {
    const { hub, saved, advance, ready } = setup()
    hub.load('r_1'); ready(); hub.command({ type: 'play' })
    for (let i = 0; i < 5; i++) { advance(1000); hub.tick() }
    expect(saved.length).toBe(1)
    expect(saved[0][1]).toBeCloseTo(5, 0)
    advance(2000); hub.command({ type: 'pause' })
    expect(saved.at(-1)?.[1]).toBeCloseTo(7, 0)
    hub.command({ type: 'seek', to: 3000 })
    expect(saved.at(-1)?.[1]).toBeCloseTo(3000, 0)
    hub.unload()
    expect(hub.get()).toBeNull()
  })
})

describe('the phone', () => {
  it('cannot START the tape until the operator has started it once; can always pause; skips ±10 s', () => {
    const { hub, ready } = setup()
    expect(hub.phone('play')).toEqual({ ok: false, reason: 'nothing-loaded' })
    hub.load('r_1'); ready()
    expect(hub.phone('play')).toEqual({ ok: false, reason: 'not-started' })
    expect(hub.record?.status).toBe('paused')
    hub.command({ type: 'play' })
    expect(hub.phone('pause')).toEqual({ ok: true })
    expect(hub.record).toMatchObject({ status: 'paused', pausedBy: 'phone' })
    expect(hub.phone('play')).toEqual({ ok: true })
    const p = hub.record!.position
    hub.phone('fwd')
    expect(hub.record!.position).toBeCloseTo(p + 10, 0)
  })
})

describe('the sound device', () => {
  it('lost: pauses; chosen again: Play works', () => {
    const { hub, ready } = setup()
    hub.load('r_1'); ready(); hub.command({ type: 'play' })
    hub.deviceLost()
    expect(hub.record).toMatchObject({ status: 'paused', pausedBy: 'device' })
    hub.setDevice('def', 'Built-in')
    expect(hub.record?.errorKind).toBeNull()
    hub.command({ type: 'play' })
    expect(hub.record?.status).toBe('playing')
  })
})

describe('broadcasting', () => {
  it('followers get a fresh position once a second while playing, and nothing while paused', () => {
    const { hub, sent, advance, ready } = setup()
    hub.load('r_1'); ready()
    const n0 = sent.length
    hub.tick()
    expect(sent.length).toBe(n0)
    hub.command({ type: 'play' })
    const n1 = sent.length
    advance(1000); hub.tick()
    expect(sent.length).toBe(n1 + 1)
    expect(sent.at(-1)?.position).toBeCloseTo(1, 0)
  })
})
