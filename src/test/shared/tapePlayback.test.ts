import { describe, it, expect } from 'vitest'
import { initialTape, tapeReduce, tapePositionNow, toTapeWire, tapeWirePosition, tapeStatusNote, tapeTimeLeft, clampSpeed, TAPE_SPEEDS, escPausesTape, sanitizeTapeAction } from '../../shared/tapePlayback'

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

describe('Esc and the tape (one rule for every window)', () => {
  it('plain Esc blanks and leaves the tape playing by default; it never pauses when UN-blanking', () => {
    expect(escPausesTape('keep', false, true)).toBe(false)
    expect(escPausesTape('keep', false, false)).toBe(false)
  })
  it('with "Also pauses", plain Esc pauses when it blanks, and only then', () => {
    expect(escPausesTape('pause', false, true)).toBe(true)
    expect(escPausesTape('pause', false, false)).toBe(false)
  })
  it('Shift+Esc is the panic key: it always pauses, whatever the setting', () => {
    for (const rule of ['keep', 'pause'] as const) for (const blanking of [true, false]) expect(escPausesTape(rule, true, blanking)).toBe(true)
  })
})

describe('seeking works in every state', () => {
  const states: Array<[string, () => ReturnType<typeof base>]> = [
    ['loading (not ready yet)', () => base()],
    ['loaded, never played', () => ready()],
    ['playing', () => tapeReduce(ready(), { type: 'play' }, T0)],
    ['paused after playing', () => tapeReduce(tapeReduce(ready(), { type: 'play' }, T0), { type: 'pause' }, T0 + 2000)],
    ['stalled', () => tapeReduce(tapeReduce(ready(), { type: 'play' }, T0), { type: 'report', position: 100, playing: true, stalled: true }, T0 + 1000)],
    ['ended', () => tapeReduce(ready(), { type: 'report', position: 8688, playing: false, ended: true }, T0)]
  ]
  for (const [name, make] of states) {
    it(`${name}: a seek lands on the time asked and bumps the epoch so the sound follows`, () => {
      const s = make()
      const r = tapeReduce(s, { type: 'seek', to: 3000 }, T0 + 5000)
      expect(r.position).toBe(3000)
      expect(r.epoch).toBe(s.epoch + 1)
      expect(r.status).toBe(s.status === 'ended' ? 'paused' : s.status)
    })
    it(`${name}: a seek never leaves the recording (clamped to 0 and to the length)`, () => {
      expect(tapeReduce(make(), { type: 'seek', to: -5 }, T0).position).toBe(0)
      expect(tapeReduce(make(), { type: 'seek', to: 99999 }, T0).position).toBe(8688)
    })
  }
  it('a seek while the file is still loading is kept (the engine applies it when the file is ready)', () => {
    const r = tapeReduce(base(), { type: 'seek', to: 3000 }, T0)
    expect(r.status).toBe('loading')
    expect(r.position).toBe(3000)
  })
})

describe('commands from a window are checked', () => {
  it('passes plain, finite values', () => {
    expect(sanitizeTapeAction({ type: 'seek', to: 1200 })).toEqual({ type: 'seek', to: 1200 })
    expect(sanitizeTapeAction({ type: 'skip', by: -10 })).toEqual({ type: 'skip', by: -10 })
    expect(sanitizeTapeAction({ type: 'volume', value: 0.2 })).toEqual({ type: 'volume', value: 0.2 })
    expect(sanitizeTapeAction({ type: 'toggle' })).toEqual({ type: 'toggle' })
  })
  it('drops a seek with no time instead of jumping to the start (the old behaviour read it as 0)', () => {
    expect(sanitizeTapeAction({ type: 'seek', position: 1200 })).toBeNull()
    expect(sanitizeTapeAction({ type: 'seek' })).toBeNull()
    expect(sanitizeTapeAction({ type: 'seek', to: null })).toBeNull()
    expect(sanitizeTapeAction({ type: 'seek', to: '20' })).toBeNull()
    expect(sanitizeTapeAction({ type: 'seek', to: NaN })).toBeNull()
  })
  it('drops a skip, speed or volume with no number, and anything the engine alone may send', () => {
    expect(sanitizeTapeAction({ type: 'skip' })).toBeNull()
    expect(sanitizeTapeAction({ type: 'speed', value: undefined })).toBeNull()
    expect(sanitizeTapeAction({ type: 'volume', value: Infinity })).toBeNull()
    expect(sanitizeTapeAction({ type: 'report', position: 1, playing: true })).toBeNull()
    expect(sanitizeTapeAction({ type: 'device-lost' })).toBeNull()
    expect(sanitizeTapeAction(null)).toBeNull()
    expect(sanitizeTapeAction('seek')).toBeNull()
  })
})
