/**
 * videoPlayback.ts — the rules for playing a video on several screens, as plain functions (no Electron, no DOM).
 *
 * The MAIN output window owns the clock. The main process keeps one record per channel (`PlaybackState`); the main
 * output reports its real position about once a second; every other screen (a Graphics page, the operator's bar, the
 * stage monitor) receives the record and follows it. Spike 3 (docs/design/media/spikes/3-multi-screen-sync.md) measured
 * the correction used here: nudge the playback rate ±5% when 40–500 ms out, hard-seek beyond 500 ms, never faster; that held
 * p95 46 ms, max 82 ms, 0 jumps over 15 minutes. Beyond ~500 ms a follower that cannot catch up shows the still frame
 * and the time remaining instead of a picture that is visibly out of step.
 */
import { VIDEO_LIMITS } from './media'

export type PlaybackStatus = 'loading' | 'paused' | 'playing' | 'ended' | 'error'

export interface PlaybackState {
  mediaId: string
  status: PlaybackStatus
  /** Position in seconds at time `at`. */
  position: number
  /** Main-process clock (ms since epoch) when `position` was true. */
  at: number
  /** Length in seconds, once known. */
  duration: number | null
  /** 0–1. */
  volume: number
  muted: boolean
  loop: boolean
  /** The operator has pressed Play for this video at least once (the phone may only resume after that). */
  hasPlayedOnce: boolean
  /** The output reported that frames stopped advancing while it should be playing. */
  stalled: boolean
  error: string | null
}

export type PlaybackAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'seek'; to: number }
  | { type: 'volume'; value: number }
  | { type: 'muted'; value: boolean }
  | { type: 'loop'; value: boolean }
  | { type: 'duration'; value: number }
  /** What the leader window actually reports. */
  | { type: 'report'; position: number; playing: boolean; duration?: number | null; ended?: boolean; stalled?: boolean; error?: string | null }

export function initialPlayback(mediaId: string, opts: { duration?: number | null; loop?: boolean; volume?: number; muted?: boolean } = {}, now = Date.now()): PlaybackState {
  return {
    mediaId,
    status: 'paused',
    position: 0,
    at: now,
    duration: opts.duration ?? null,
    volume: clamp01(opts.volume ?? 1),
    muted: opts.muted ?? false,
    loop: opts.loop ?? false,
    hasPlayedOnce: false,
    stalled: false,
    error: null
  }
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1)

/** Where the video is right now (seconds), from the last known position and how long it has been playing. */
export function positionNow(s: PlaybackState, now: number): number {
  if (s.status !== 'playing') return s.position
  let p = s.position + Math.max(0, now - s.at) / 1000
  if (s.duration !== null && s.duration > 0) {
    if (s.loop) p = p % s.duration
    else p = Math.min(p, s.duration)
  }
  return p
}

export function timeRemaining(s: PlaybackState, now: number): number | null {
  if (s.duration === null) return null
  return Math.max(0, s.duration - positionNow(s, now))
}

export function playbackReduce(s: PlaybackState, a: PlaybackAction, now = Date.now()): PlaybackState {
  const here = positionNow(s, now)
  switch (a.type) {
    case 'play': {
      if (s.status === 'error') return s
      const restart = s.status === 'ended' || (s.duration !== null && here >= s.duration - 0.05 && !s.loop)
      return { ...s, status: 'playing', position: restart ? 0 : here, at: now, hasPlayedOnce: true, stalled: false }
    }
    case 'pause':
      return s.status === 'playing' ? { ...s, status: 'paused', position: here, at: now, stalled: false } : s
    case 'toggle':
      return playbackReduce(s, { type: s.status === 'playing' ? 'pause' : 'play' }, now)
    case 'seek': {
      const max = s.duration !== null ? s.duration : Infinity
      const to = Math.max(0, Math.min(Number.isFinite(a.to) ? a.to : 0, max))
      return { ...s, position: to, at: now, status: s.status === 'ended' ? 'paused' : s.status }
    }
    case 'volume':
      return { ...s, volume: clamp01(a.value) }
    case 'muted':
      return { ...s, muted: a.value }
    case 'loop':
      return { ...s, loop: a.value }
    case 'duration':
      return a.value > 0 ? { ...s, duration: a.value } : s
    case 'report': {
      const duration = a.duration && a.duration > 0 ? a.duration : s.duration
      if (a.error) return { ...s, status: 'error', error: a.error, position: a.position, at: now, duration }
      if (a.ended && !s.loop) return { ...s, status: 'ended', position: duration ?? a.position, at: now, duration, stalled: false }
      // the leader says where it really is; keep the commanded play/pause unless it disagrees for a reason we know
      const status: PlaybackStatus = s.status === 'ended' && a.playing ? 'playing' : s.status
      return { ...s, position: a.position, at: now, duration, status, stalled: !!a.stalled && status === 'playing' }
    }
  }
}

/** Panic / blank / logo: silence and stillness at once, wherever it is. Never resumes by itself. */
export function playbackBlank(s: PlaybackState, now = Date.now()): PlaybackState {
  return playbackReduce(s, { type: 'pause' }, now)
}

// ── following the main clock ─────────────────────────────────────────────────

export const SYNC = {
  /** Within this (ms) nothing is done. */
  ignoreMs: 40,
  /** Beyond this (ms) a hard seek is used. */
  seekMs: 500,
  /** Playback-rate nudge, ±5%. */
  rateDelta: 0.05,
  /** After a hard seek, wait this long (ms) before judging again. */
  settleMs: 2500,
  /** Still out by more than seekMs this many checks after a seek → show the still frame and time remaining. */
  stillAfterChecks: 3
} as const

export type FollowerAction =
  | { kind: 'none' }
  | { kind: 'rate'; rate: number }
  | { kind: 'seek'; to: number }
  | { kind: 'still' }

/**
 * Decides what a follower should do. Call about once a second with the leader's position (already advanced to
 * "now") and the follower's own. Keeps the little memory it needs (when it last seeked, how many checks since were still
 * far out) so one bad second cannot flip the screen to a still, and a screen in "still" comes back when it is close again.
 */
export class FollowerController {
  private lastSeekAt = -Infinity
  private farChecksSinceSeek = 0
  private still = false

  tick(leaderPos: number, myPos: number, nowMs: number, opts: { loop?: boolean; duration?: number | null } = {}): FollowerAction {
    let err = myPos - leaderPos // positive: I am ahead
    // across the loop point the shorter way round is the real error
    if (opts.loop && opts.duration && opts.duration > 0) {
      const d = opts.duration
      if (err > d / 2) err -= d
      else if (err < -d / 2) err += d
    }
    const ms = Math.abs(err) * 1000
    if (ms <= SYNC.seekMs && this.still && ms <= SYNC.ignoreMs * 2) {
      this.still = false
      this.farChecksSinceSeek = 0
    }
    if (this.still) {
      // keep trying to recover: a fresh seek, rate-limited
      if (nowMs - this.lastSeekAt >= SYNC.settleMs) {
        this.lastSeekAt = nowMs
        return { kind: 'seek', to: leaderPos }
      }
      return { kind: 'still' }
    }
    if (ms <= SYNC.ignoreMs) {
      this.farChecksSinceSeek = 0
      return { kind: 'rate', rate: 1 }
    }
    if (ms <= SYNC.seekMs) {
      this.farChecksSinceSeek = 0
      return { kind: 'rate', rate: err > 0 ? 1 - SYNC.rateDelta : 1 + SYNC.rateDelta }
    }
    // far out
    if (nowMs - this.lastSeekAt < SYNC.settleMs) return { kind: 'rate', rate: 1 }
    if (this.lastSeekAt > -Infinity) this.farChecksSinceSeek++
    if (this.farChecksSinceSeek >= SYNC.stillAfterChecks) {
      this.still = true
      return { kind: 'still' }
    }
    this.lastSeekAt = nowMs
    return { kind: 'seek', to: leaderPos }
  }

  get showingStill(): boolean {
    return this.still
  }
  reset(): void {
    this.lastSeekAt = -Infinity
    this.farChecksSinceSeek = 0
    this.still = false
  }
}

// ── display helpers ─────────────────────────────────────────────────────────

/** `m:ss`, or `h:mm:ss` from an hour up. */
export function formatClock(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '–:––'
  const t = Math.max(0, Math.floor(sec))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

// ── what a file is allowed to be ─────────────────────────────────────────────

export interface VideoFacts {
  brand: string
  videoCodec: string | null
  audioCodec: string | null
  width: number
  height: number
  fps: number | null
  bitrate: number | null
}

export type VideoVerdict =
  | { ok: false; code: 'video-codec' | 'video-container' | 'video-too-large'; detail: string }
  | { ok: true; warnings: string[] }

const CODEC_NAME: Record<string, string> = { hvc1: 'HEVC (H.265)', hev1: 'HEVC (H.265)', av01: 'AV1', vp09: 'VP9', apch: 'ProRes', apcn: 'ProRes', apco: 'ProRes', apcs: 'ProRes', ap4h: 'ProRes', mp4v: 'MPEG-4 Part 2', avc1: 'H.264', avc3: 'H.264' }
const AUDIO_NAME: Record<string, string> = { mp4a: 'AAC', 'ac-3': 'Dolby Digital (AC-3)', 'ec-3': 'Dolby Digital Plus', Opus: 'Opus', alac: 'Apple Lossless', '.mp3': 'MP3' }

/** The rules every video must meet (the roadmap's resolved limits). Warnings never refuse anything. */
export function judgeVideo(f: VideoFacts): VideoVerdict {
  if (!VIDEO_LIMITS.mp4Brands.includes(f.brand)) return { ok: false, code: 'video-container', detail: f.brand.trim() === 'qt' ? 'QuickTime (.mov)' : `container “${f.brand.trim()}”` }
  const v = f.videoCodec ?? ''
  if (v !== 'avc1' && v !== 'avc3') return { ok: false, code: 'video-codec', detail: CODEC_NAME[v] ?? (v || 'unknown video format') }
  if (f.audioCodec && f.audioCodec !== 'mp4a') return { ok: false, code: 'video-codec', detail: `${AUDIO_NAME[f.audioCodec] ?? f.audioCodec} audio` }
  if (f.width > VIDEO_LIMITS.maxWidth || f.height > VIDEO_LIMITS.maxHeight) return { ok: false, code: 'video-too-large', detail: `${f.width}×${f.height}` }
  const warnings: string[] = []
  const fourK = f.width * f.height > VIDEO_LIMITS.fourKPixels
  if (fourK) warnings.push('4K video: it was only tested for 20 minutes and may play poorly on a slower computer. Play it once in Preview on this computer before the service.')
  if (f.fps !== null && f.fps > VIDEO_LIMITS.verifiedFps + 0.5) warnings.push(`${Math.round(f.fps)} frames per second: Born Again was verified at up to 30. It may stutter on a slower computer — try it first.`)
  const limit = fourK ? VIDEO_LIMITS.warnBitrate4k : VIDEO_LIMITS.warnBitrate1080
  if (f.bitrate !== null && f.bitrate > limit) warnings.push(`Very high bit rate (${(f.bitrate / 1e6).toFixed(0)} Mbit/s). It may play poorly on a slower computer — a smaller export (under ${limit / 1e6} Mbit/s) is safer.`)
  return { ok: true, warnings }
}
