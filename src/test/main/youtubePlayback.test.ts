import { describe, it, expect } from 'vitest'
import { PlaybackHub } from '../../main/mediaPlayback'
import type { PlaybackWire } from '../../shared/videoPlayback'
import { ytMediaId, ytToReport } from '../../shared/youtube'

/** The rules for a LIVE YouTube video — phone, panic, operator — on the same playback record local video uses. */
const ID = ytMediaId('dQw4w9WgXcQ')
function hub(): { h: PlaybackHub; sent: PlaybackWire[]; stops: string[]; now: { t: number } } {
  const sent: PlaybackWire[] = []
  const stops: string[] = []
  const now = { t: 1_000_000 }
  return { h: new PlaybackHub({ now: () => now.t, emit: (m) => sent.push(m), emitStop: (c) => stops.push(c) }), sent, stops, now }
}

describe('a taken YouTube video', () => {
  it('waits paused — nothing plays and no sound starts on Take', () => {
    const { h } = hub()
    const s = h.take('main', ID, { duration: null })
    expect(s.status).toBe('paused')
    expect(s.hasPlayedOnce).toBe(false)
  })
  it('its length is learned from the player', () => {
    const { h } = hub()
    h.take('main', ID, { duration: null })
    h.report('main', { position: 0, playing: false, duration: 212 })
    expect(h.get('main')?.duration).toBe(212)
  })
})

describe("the phone, with a YouTube video live", () => {
  it('cannot start it until the operator has started it once', () => {
    const { h } = hub()
    h.take('main', ID, { duration: 200 })
    expect(h.phone('main', 'media-play')).toEqual({ ok: false, reason: 'not-started' })
    expect(h.get('main')?.status).toBe('paused')
  })
  it('can pause at any time, and resume after the operator has played it', () => {
    const { h } = hub()
    h.take('main', ID, { duration: 200 })
    h.command('main', { type: 'play' })
    expect(h.phone('main', 'media-pause')).toEqual({ ok: true })
    expect(h.get('main')?.status).toBe('paused')
    expect(h.phone('main', 'media-play')).toEqual({ ok: true })
    expect(h.get('main')?.status).toBe('playing')
  })
  it('with nothing live, there is nothing to control', () => {
    const { h } = hub()
    expect(h.phone('main', 'media-pause')).toEqual({ ok: false, reason: 'nothing-live' })
  })
  it('has no way to seek or change volume (only play and pause exist for it)', () => {
    const { h } = hub()
    h.take('main', ID, { duration: 200 })
    h.command('main', { type: 'play' })
    // @ts-expect-error — the phone's command type has no seek
    expect(() => h.phone('main', 'media-seek')).not.toThrow()
    expect(h.get('main')?.position).toBe(0)
  })
})

describe('panic and blank with a YouTube video playing', () => {
  it('Esc / the phone Blank / the logo key pause it at once, and it never resumes by itself', () => {
    const { h, now } = hub()
    h.take('main', ID, { duration: 200 })
    h.command('main', { type: 'play' })
    now.t += 5000
    h.blank('main')
    const s = h.get('main')!
    expect(s.status).toBe('paused')
    expect(s.position).toBeGreaterThanOrEqual(4.9)
    now.t += 60_000
    expect(h.get('main')!.position).toBe(s.position)
    // unblank only re-sends where it is (paused)
    h.resend('main')
    expect(h.get('main')!.status).toBe('paused')
  })
  it('taking something else (or clearing) ends the record', () => {
    const { h, stops } = hub()
    h.take('main', ID, { duration: 200 })
    h.stop('main')
    expect(stops).toEqual(['main'])
    expect(h.get('main')).toBeNull()
  })
})

describe("the operator's controls", () => {
  it('can seek and set volume and mute', () => {
    const { h } = hub()
    h.take('main', ID, { duration: 200 })
    h.command('main', { type: 'seek', to: 90 })
    h.command('main', { type: 'volume', value: 0.4 })
    h.command('main', { type: 'muted', value: true })
    expect(h.get('main')).toMatchObject({ position: 90, volume: 0.4, muted: true })
  })
  it('a player error stops the record with the plain sentence, and Play is refused until it is taken again', () => {
    const { h } = hub()
    h.take('main', ID, { duration: null })
    const { report } = ytToReport({ state: -1, time: 0, duration: 0, error: 153 }, { time: -1, stillTicks: 0 })
    h.report('main', report)
    expect(h.get('main')?.status).toBe('error')
    expect(h.get('main')?.error).toMatch(/identify BORN/)
    h.command('main', { type: 'play' })
    expect(h.get('main')?.status).toBe('error')
    h.take('main', ID, { duration: null })
    expect(h.get('main')?.status).toBe('paused')
  })
  it('a frozen clock while "playing" is shown as stalled', () => {
    const { h } = hub()
    h.take('main', ID, { duration: 200 })
    h.command('main', { type: 'play' })
    let prev = { time: 5, stillTicks: 0 }
    for (let i = 0; i < 4; i++) {
      const r = ytToReport({ state: 1, time: 5, duration: 200 }, prev)
      prev = { time: 5, stillTicks: r.stillTicks }
      h.report('main', r.report)
    }
    expect(h.get('main')?.stalled).toBe(true)
  })
})
