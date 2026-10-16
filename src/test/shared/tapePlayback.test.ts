import { describe, it, expect } from 'vitest'
import { initialTape, tapeReduce, tapePositionNow, toTapeWire, tapeWirePosition, tapeStatusNote, tapeTimeLeft, clampSpeed, TAPE_SPEEDS } from '../../shared/tapePlayback'

const T0 = 1_000_000
const base = () => initialTape({ recordingId: 'r_1', fileId: 't_1', sermonId: 1115, position: 100, duration: 8688 }, T0)
const ready = () => tapeReduce(base(), { type: 'report', position: 100, playing: false, duration: 8688, ready: true }, T0)

describe('a loaded tape waits; nothing plays by itself', () => {
  it('starts as "loading", becomes "paused" when the engine says the file is ready, and keeps the resume position', () => {
    expect(base()).toMatchObject({ status: 'loading', position: 100, hasPlayedOnce: false })
    const r = ready()
    expect(r).toMatchObject({ status: 'paused', hasPlayedOnce: false, position: 100 })
    expect(tapeStatusNote(r)).toMatch(/Nothing plays until you press Play/)
  })
})

describe('play, pause and the clock', () => {
  it('playing advances the position at the tape speed; pausing freezes it', () => {
    let s = tapeReduce(ready(), { type: 'play' }, T0)
    expect(s.hasPlayedOnce).toBe(true)
    expect(tapePositionNow(s, T0 + 10_000)).toBeCloseTo(110, 3)
    s = tapeReduce(s, { type: 'speed', value: 1.25 }, T0 + 10_000)
    expect(tapePositionNow(s, T0 + 20_000)).toBeCloseTo(110 + 12.5, 3) // 10 s at 1.25× = 12.5 s — and the earlier 10 s was not re-counted
    s = tapeReduce(s, { type: 'pause' }, T0 + 20_000)
    expect(s).toMatchObject({ status: 'paused', pausedBy: 'operator' })
    expect(tapePositionNow(s, T0 + 99_000)).toBeCloseTo(122.5, 3)
  })
  it('the position never passes the end, and time left is exact', () => {
    const s = tapeReduce(ready(), { type: 'play' }, T0)
    expect(tapePositionNow(s, T0 + 99_999_000)).toBe(8688)
    expect(tapeTimeLeft(tapeReduce(s, { type: 'seek', to: 8000 }, T0), T0)).toBe(688)
  })
  it('toggle flips between play and pause', () => {
    let s = tapeReduce(ready(), { type: 'toggle' }, T0)
    expect(s.status).toBe('playing')
    s = tapeReduce(s, { type: 'toggle' }, T0 + 1000)
    expect(s.status).toBe('paused')
  })
})

describe('seeking and skipping', () => {
  it('a seek bumps the epoch (the engine seeks only then) and is clamped to the tape', () => {
    const s = ready()
    const a = tapeReduce(s, { type: 'seek', to: 4323.5 }, T0)
    expect(a).toMatchObject({ position: 4323.5, epoch: s.epoch + 1 })
    expect(tapeReduce(s, { type: 'seek', to: -50 }, T0).position).toBe(0)
    expect(tapeReduce(s, { type: 'seek', to: 99999 }, T0).position).toBe(8688)
    expect(tapeReduce(s, { type: 'seek', to: NaN }, T0).position).toBe(0)
  })
  it('±10 s skips from where the tape is NOW (not from the last message)', () => {
    const s = tapeReduce(ready(), { type: 'play' }, T0)
    expect(tapeReduce(s, { type: 'skip', by: -10 }, T0 + 30_000).position).toBeCloseTo(120, 3)
    expect(tapeReduce(s, { type: 'skip', by: 10 }, T0 + 30_000).position).toBeCloseTo(140, 3)
  })
  it('the engine\'s own position reports never bump the epoch (it must not seek because of itself)', () => {
    let s = tapeReduce(ready(), { type: 'play' }, T0)
    const e = s.epoch
    s = tapeReduce(s, { type: 'report', position: 101.2, playing: true }, T0 + 1000)
    s = tapeReduce(s, { type: 'report', position: 102.1, playing: true }, T0 + 2000)
    expect(s.epoch).toBe(e)
    expect(s.position).toBe(102.1)
  })
})

describe('the end, errors, stalls', () => {
  it('ending: status ended; Play starts over from the beginning (and the engine is told to seek)', () => {
    let s = tapeReduce(tapeReduce(ready(), { type: 'play' }, T0), { type: 'report', position: 8688, playing: false, ended: true }, T0 + 1000)
    expect(s).toMatchObject({ status: 'ended', position: 8688 })
    expect(tapeStatusNote(s)).toMatch(/finished/)
    const e = s.epoch
    s = tapeReduce(s, { type: 'play' }, T0 + 2000)
    expect(s).toMatchObject({ status: 'playing', position: 0, epoch: e + 1 })
  })
  it('a decode error stops it with the engine\'s words, and Play does nothing until it is loaded again', () => {
    let s = tapeReduce(ready(), { type: 'report', position: 0, playing: false, error: 'This computer cannot play the recording.', errorKind: 'decode' }, T0)
    expect(s).toMatchObject({ status: 'error', errorKind: 'decode' })
    expect(tapeReduce(s, { type: 'play' }, T0).status).toBe('error')
  })
  it('frozen sound is flagged only while playing', () => {
    let s = tapeReduce(ready(), { type: 'play' }, T0)
    s = tapeReduce(s, { type: 'report', position: 100, playing: true, stalled: true }, T0 + 5000)
    expect(s.stalled).toBe(true)
    expect(tapeStatusNote(s)).toMatch(/stopped moving/)
    s = tapeReduce(s, { type: 'pause' }, T0 + 6000)
    expect(s.stalled).toBe(false)
  })
})

describe('sound device', () => {
  it('losing the device PAUSES the tape (never moves the sound to another room) and says so; choosing a device clears it', () => {
    let s = tapeReduce(tapeReduce(ready(), { type: 'device', id: 'usb', label: 'USB mixer' }, T0), { type: 'play' }, T0)
    s = tapeReduce(s, { type: 'device-lost' }, T0 + 5000)
    expect(s).toMatchObject({ status: 'paused', pausedBy: 'device', errorKind: 'device' })
    expect(tapePositionNow(s, T0 + 60_000)).toBeCloseTo(105, 3)
    expect(tapeStatusNote(s)).toMatch(/disconnected/)
    s = tapeReduce(s, { type: 'device', id: 'spk', label: 'Sanctuary speakers' }, T0 + 6000)
    expect(s).toMatchObject({ deviceId: 'spk', error: null, errorKind: null })
    expect(tapeReduce(s, { type: 'play' }, T0 + 7000).status).toBe('playing')
  })
})

describe('other reasons to pause', () => {
  it('each pause reason has its own plain sentence', () => {
    for (const by of ['video', 'sleep', 'panic'] as const) {
      const s = tapeReduce(tapeReduce(ready(), { type: 'play' }, T0), { type: 'pause', by }, T0 + 1000)
      expect(s.pausedBy).toBe(by)
      expect(tapeStatusNote(s)).toBeTruthy()
    }
  })
  it('a pause that is not playing changes nothing (pausing twice is harmless)', () => {
    const s = ready()
    expect(tapeReduce(s, { type: 'pause', by: 'video' }, T0)).toBe(s)
  })
})

describe('what travels to the windows', () => {
  it('the wire carries the position already brought up to date; a window interpolates from its own clock', () => {
    const s = tapeReduce(ready(), { type: 'play' }, T0)
    const w = toTapeWire(s, T0 + 4000)
    expect(w.position).toBeCloseTo(104, 3)
    expect(tapeWirePosition(w, 2500)).toBeCloseTo(106.5, 3)
    const paused = toTapeWire(tapeReduce(s, { type: 'pause' }, T0 + 4000), T0 + 4000)
    expect(tapeWirePosition(paused, 9999)).toBeCloseTo(104, 3)
  })
  it('volume and speed are clamped to sane values', () => {
    expect(tapeReduce(ready(), { type: 'volume', value: 5 }, T0).volume).toBe(1)
    expect(tapeReduce(ready(), { type: 'volume', value: -1 }, T0).volume).toBe(0)
    expect(clampSpeed(9)).toBe(2)
    expect(clampSpeed(0.01)).toBe(0.5)
    expect(clampSpeed(NaN)).toBe(1)
    expect(TAPE_SPEEDS.wide).toContain(1.25)
    expect(TAPE_SPEEDS.off).toEqual([1])
  })
})
