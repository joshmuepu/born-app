/**
 * tapePlayback.ts — the rules for the tape that is playing, as plain functions (no Electron, no DOM).
 *
 * ONE tape plays at a time. The hidden audio window is the clock: it really plays the file and reports where it is about 4 times a second;
 * the main process keeps one TapeRecord and every screen (the operator's bar, the projector, the stage monitor, Graphics, the phone) follows
 * that record — none of them is a leader. This mirrors shared/videoPlayback.ts, with the extra things a tape needs: a speed, an output device,
 * and a reason a pause happened (so the bar can say "Paused for the video" or "Sound device lost" instead of just "Paused").
 */

export type TapeStatus = 'loading' | 'paused' | 'playing' | 'ended' | 'error'
export type PausedBy = 'operator' | 'video' | 'device' | 'sleep' | 'panic' | 'phone' | null
export type TapeErrorKind = 'file' | 'decode' | 'device' | null

export interface TapeRecord {
  recordingId: string
  fileId: string
  sermonId: number
  status: TapeStatus
  /** seconds at main-process time `at` */
  position: number
  at: number
  duration: number | null
  speed: number
  /** 0–1 */
  volume: number
  muted: boolean
  /** the operator (or the preflight "play a little") has started this tape at least once — the phone may only resume after that */
  hasPlayedOnce: boolean
  /** frames/sound stopped advancing while it should be playing */
  stalled: boolean
  error: string | null
  errorKind: TapeErrorKind
  pausedBy: PausedBy
  deviceId: string
  deviceLabel: string
  /** bumped whenever the position jumps because of a COMMAND (load, seek, start over) — the engine seeks only when this changes */
  epoch: number
}

export const TAPE_SPEEDS: Record<'wide' | 'narrow' | 'off', number[]> = {
  wide: [0.8, 0.9, 1, 1.1, 1.25],
  narrow: [0.9, 1, 1.1],
  off: [1]
}
export const clampSpeed = (n: number): number => (Number.isFinite(n) ? Math.min(2, Math.max(0.5, n)) : 1)
const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1)

export function initialTape(o: { recordingId: string; fileId: string; sermonId: number; position?: number; duration?: number | null; speed?: number; volume?: number; muted?: boolean; deviceId?: string; deviceLabel?: string }, now = Date.now()): TapeRecord {
  return {
    recordingId: o.recordingId, fileId: o.fileId, sermonId: o.sermonId, status: 'loading', position: Math.max(0, o.position ?? 0), at: now, duration: o.duration ?? null,
    speed: clampSpeed(o.speed ?? 1), volume: clamp01(o.volume ?? 1), muted: o.muted ?? false, hasPlayedOnce: false, stalled: false, error: null, errorKind: null,
    pausedBy: null, deviceId: o.deviceId ?? '', deviceLabel: o.deviceLabel ?? '', epoch: 1
  }
}

/** Where the tape is right now (seconds), from its last known position and how long it has been playing. */
export function tapePositionNow(s: TapeRecord, now: number): number {
  if (s.status !== 'playing') return s.position
  const p = s.position + (Math.max(0, now - s.at) / 1000) * s.speed
  return s.duration !== null && s.duration > 0 ? Math.min(p, s.duration) : p
}
export const tapeTimeLeft = (s: TapeRecord, now: number): number | null => (s.duration === null ? null : Math.max(0, s.duration - tapePositionNow(s, now)))

export type TapeAction =
  | { type: 'play' }
  | { type: 'pause'; by?: PausedBy }
  | { type: 'toggle' }
  | { type: 'seek'; to: number }
  | { type: 'skip'; by: number }
  | { type: 'speed'; value: number }
  | { type: 'volume'; value: number }
  | { type: 'muted'; value: boolean }
  | { type: 'device'; id: string; label: string }
  | { type: 'device-lost' }
  /** what the engine window actually reports */
  | { type: 'report'; position: number; playing: boolean; duration?: number | null; ended?: boolean; stalled?: boolean; error?: string | null; errorKind?: TapeErrorKind; ready?: boolean }

/** The commands a window may send. Only plain, finite values pass; a malformed one (e.g. a seek without a time) is dropped instead of being read as 0. `report` and `device-lost` belong to the engine. */
export function sanitizeTapeAction(a: unknown): TapeAction | null {
  if (!a || typeof a !== 'object') return null
  const x = a as { type?: unknown; to?: unknown; by?: unknown; value?: unknown }
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  switch (x.type) {
    case 'play': case 'pause': case 'toggle': return { type: x.type }
    case 'seek': return num(x.to) ? { type: 'seek', to: x.to } : null
    case 'skip': return num(x.by) ? { type: 'skip', by: x.by } : null
    case 'speed': return num(x.value) ? { type: 'speed', value: x.value } : null
    case 'volume': return num(x.value) ? { type: 'volume', value: x.value } : null
    case 'muted': return { type: 'muted', value: !!x.value }
    default: return null
  }
}

export function tapeReduce(s: TapeRecord, a: TapeAction, now = Date.now()): TapeRecord {
  const here = tapePositionNow(s, now)
  switch (a.type) {
    case 'play': {
      if (s.status === 'error' && s.errorKind !== 'device') return s
      const restart = s.status === 'ended' || (s.duration !== null && here >= s.duration - 0.2)
      return { ...s, status: 'playing', position: restart ? 0 : here, at: now, hasPlayedOnce: true, stalled: false, pausedBy: null, error: null, errorKind: null, epoch: restart ? s.epoch + 1 : s.epoch }
    }
    case 'pause':
      return s.status === 'playing' ? { ...s, status: 'paused', position: here, at: now, stalled: false, pausedBy: a.by ?? 'operator' } : s
    case 'toggle':
      return tapeReduce(s, s.status === 'playing' ? { type: 'pause' } : { type: 'play' }, now)
    case 'seek': {
      const max = s.duration !== null ? s.duration : Infinity
      const to = Math.max(0, Math.min(Number.isFinite(a.to) ? a.to : 0, max))
      return { ...s, position: to, at: now, status: s.status === 'ended' ? 'paused' : s.status, epoch: s.epoch + 1 }
    }
    case 'skip':
      return tapeReduce(s, { type: 'seek', to: here + a.by }, now)
    case 'speed': {
      const speed = clampSpeed(a.value)
      // keep the clock continuous: fold what has played at the old speed into the position first
      return { ...s, position: here, at: now, speed }
    }
    case 'volume':
      return { ...s, volume: clamp01(a.value) }
    case 'muted':
      return { ...s, muted: a.value }
    case 'device':
      return { ...s, deviceId: a.id, deviceLabel: a.label, error: s.errorKind === 'device' ? null : s.error, errorKind: s.errorKind === 'device' ? null : s.errorKind, status: s.status === 'error' && s.errorKind === 'device' ? 'paused' : s.status }
    case 'device-lost':
      // never silently move the sound to another room: stop and say so
      return { ...s, status: 'paused', position: here, at: now, stalled: false, pausedBy: 'device', error: 'The sound output was disconnected. The tape is paused.', errorKind: 'device' }
    case 'report': {
      const duration = a.duration && a.duration > 0 ? a.duration : s.duration
      if (a.error) return { ...s, status: 'error', error: a.error, errorKind: a.errorKind ?? 'decode', position: a.position, at: now, duration, stalled: false }
      if (a.ended) return { ...s, status: 'ended', position: duration ?? a.position, at: now, duration, stalled: false }
      // the engine says where it really is; keep the commanded play/pause. `loading` ends when the file is ready.
      const status: TapeStatus = s.status === 'loading' ? (a.ready ? 'paused' : 'loading') : s.status
      return { ...s, status, position: a.position, at: now, duration, stalled: !!a.stalled && status === 'playing' }
    }
  }
}

/** The record as it travels to the windows (positions already brought up to date, so a window needs no clock offset). */
export interface TapeWire extends TapeRecord {
  /** main-process time of this message, for the receiver's interpolation */
  sentAt: number
}
export const toTapeWire = (s: TapeRecord, now: number): TapeWire => ({ ...s, position: tapePositionNow(s, now), at: now, sentAt: now })

/** The position a window shows right now, given the last message and how long ago it arrived (ms, from the window's own clock). */
export function tapeWirePosition(w: TapeWire, sinceMs: number): number {
  if (w.status !== 'playing') return w.position
  const p = w.position + (Math.max(0, sinceMs) / 1000) * w.speed
  return w.duration !== null && w.duration > 0 ? Math.min(p, w.duration) : p
}

/** Plain words for what the tape is doing, for the bar and the phone. */
export function tapeStatusNote(s: Pick<TapeRecord, 'status' | 'pausedBy' | 'stalled' | 'error' | 'errorKind' | 'hasPlayedOnce'>): string | null {
  if (s.status === 'error') return s.error ?? 'The tape stopped.'
  if (s.errorKind === 'device' && s.error) return s.error
  if (s.stalled) return 'The sound has stopped moving. If it does not recover, press Pause, then Play.'
  if (s.status === 'ended') return 'The tape has finished.'
  if (s.status === 'paused') {
    if (s.pausedBy === 'video') return 'Paused because a video or YouTube item went on the screen. Press Play to continue the tape.'
    if (s.pausedBy === 'device') return 'Paused: the sound output was disconnected. Choose where to play it, then press Play.'
    if (s.pausedBy === 'sleep') return 'Paused while the computer slept. Press Play to continue.'
    if (s.pausedBy === 'panic') return 'Paused with the screens blanked (Shift+Esc). Press Play to continue.'
    if (!s.hasPlayedOnce) return 'Ready. Nothing plays until you press Play.'
  }
  return null
}

/**
 * Does an Esc press pause the tape? Shift+Esc always blanks AND pauses (the panic key). Plain Esc blanks and leaves the tape playing unless the operator
 * chose "Also pauses" — and then only when it is BLANKING (un-blanking never pauses). One rule for every window that listens for Esc.
 */
export function escPausesTape(rule: 'keep' | 'pause', shift: boolean, blankingNow: boolean): boolean {
  if (shift) return true
  return blankingNow && rule === 'pause'
}
