/**
 * mediaPlayback.ts — the playback record of the video that is live on each channel (main process). Electron-free so it is
 * tested directly. It applies operator, phone and panic commands with the pure reducers in shared/videoPlayback.ts, takes the
 * leader window's position reports as the clock, and tells everyone who needs to know through `emit`.
 */
import { initialPlayback, playbackBlank, playbackReduce, toWire, type PlaybackAction, type PlaybackState, type PlaybackWire } from '../shared/videoPlayback'

export interface PlaybackDeps {
  now: () => number
  /** To the leader window, the operator's bar, followers and the Graphics page. */
  emit: (msg: PlaybackWire) => void
  /** The video on this channel is gone (cleared or replaced by something else). */
  emitStop: (channelId: string) => void
}

/** What the operator's own window and a phone may do. The phone gets less: no seek, no volume, no first play. */
export type PhoneCommand = 'media-play' | 'media-pause'

const VALID: PlaybackAction['type'][] = ['play', 'pause', 'toggle', 'seek', 'volume', 'muted', 'loop']

export class PlaybackHub {
  private states = new Map<string, PlaybackState>()
  constructor(private deps: PlaybackDeps) {}

  private put(channelId: string, s: PlaybackState): void {
    this.states.set(channelId, s)
    this.deps.emit(toWire(channelId, s, this.deps.now()))
  }

  /** A video was taken: it waits PAUSED on its first frame. Nothing plays by itself. */
  take(channelId: string, mediaId: string, opts: { duration: number | null; loop?: boolean; volume?: number; muted?: boolean }): PlaybackState {
    const prev = this.states.get(channelId)
    const s = initialPlayback(mediaId, { duration: opts.duration, loop: opts.loop, volume: opts.volume ?? prev?.volume ?? 1, muted: opts.muted ?? prev?.muted ?? false }, this.deps.now())
    this.put(channelId, s)
    return s
  }

  /** The operator's commands (and the panic key's pause). Returns the new record, or null if nothing is live on that channel. */
  command(channelId: string, action: PlaybackAction): PlaybackState | null {
    const s = this.states.get(channelId)
    if (!s || !VALID.includes(action.type)) return null
    // the leader's reports are its own business (report()); a command may not forge one
    const next = playbackReduce(s, action, this.deps.now())
    this.put(channelId, next)
    return next
  }

  /** The phone: Play/Pause of the LIVE video only. Play is refused until the operator has started it once (so a phone can never be what first makes sound). */
  phone(channelId: string, cmd: PhoneCommand): { ok: true } | { ok: false; reason: 'nothing-live' | 'not-started' } {
    const s = this.states.get(channelId)
    if (!s) return { ok: false, reason: 'nothing-live' }
    if (cmd === 'media-play') {
      if (!s.hasPlayedOnce) return { ok: false, reason: 'not-started' }
      this.put(channelId, playbackReduce(s, { type: 'play' }, this.deps.now()))
    } else {
      this.put(channelId, playbackReduce(s, { type: 'pause' }, this.deps.now()))
    }
    return { ok: true }
  }

  /** What the leader window really says (about once a second, and on every event). Stored as the clock; broadcast only when something changed besides time. */
  report(channelId: string, r: { position: number; playing: boolean; duration?: number | null; ended?: boolean; stalled?: boolean; error?: string | null }): void {
    const s = this.states.get(channelId)
    if (!s) return
    const next = playbackReduce(s, { type: 'report', ...r }, this.deps.now())
    this.states.set(channelId, next)
    if (next.status !== s.status || next.stalled !== s.stalled || next.error !== s.error || next.duration !== s.duration) this.deps.emit(toWire(channelId, next, this.deps.now()))
  }

  /** Blank, panic and the logo key: silence and stillness at once. The picture comes back paused, never playing. */
  blank(channelId: string): void {
    const s = this.states.get(channelId)
    if (!s) return
    this.put(channelId, playbackBlank(s, this.deps.now()))
  }

  /** Send the current record again (e.g. after a Graphics page was re-created by an unblank). */
  resend(channelId: string): void {
    const s = this.states.get(channelId)
    if (s) this.deps.emit(toWire(channelId, s, this.deps.now()))
  }

  /** What was live is gone. */
  stop(channelId: string): void {
    if (this.states.delete(channelId)) this.deps.emitStop(channelId)
  }

  get(channelId: string): PlaybackWire | null {
    const s = this.states.get(channelId)
    return s ? toWire(channelId, s, this.deps.now()) : null
  }
  record(channelId: string): PlaybackState | null {
    return this.states.get(channelId) ?? null
  }

  /** Once a second: followers and the operator's bar get a fresh position. */
  tick(): void {
    const now = this.deps.now()
    for (const [id, s] of this.states) if (s.status === 'playing') this.deps.emit(toWire(id, s, now))
  }
}
