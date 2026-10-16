/**
 * youtubeProbe.ts — "is this YouTube video going to work?" (main process, Electron-free so it is tested with fakes).
 *
 * A check opens a hidden window on the player page in `probe` mode. The page cues the video (it never plays it) and says what
 * YouTube's own player said: cued, or an error code. This file only waits for the first answer and turns it into a YtProbe.
 * Nothing here reads a YouTube page, downloads anything or keeps anything.
 */
import { judgeYouTubePreflight, type YtPreflightVerdict, type YtProbe } from '../shared/youtube'
import type { HostMessage, HostMode } from './youtubeHost'

export interface ProbeHost {
  start(): Promise<number>
  newSession(): string
  listen(sid: string, cb: (m: HostMessage) => void): () => void
  urlFor(videoId: string, o: { sid: string; mode: HostMode; start?: number }): string
}

export interface ProbeDeps {
  host: ProbeHost
  /** Open a window on the page that nobody sees. */
  openHidden(url: string): { close(): void }
  /** Open a visible 480×270+ window for Test play. */
  openVisible(url: string): { close(): void }
  /** Can this computer reach YouTube's player script at all? */
  checkInternet(): Promise<boolean>
  /** How long to wait for a first answer (ms). */
  timeoutMs?: number
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Cue one video in a hidden player and report what YouTube's player said. */
export async function probeVideo(deps: ProbeDeps, videoId: string): Promise<YtProbe> {
  await deps.host.start()
  const sid = deps.host.newSession()
  return new Promise<YtProbe>((resolve) => {
    let done = false
    let win: { close(): void } | null = null
    let off: (() => void) | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const finish = (p: YtProbe): void => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      off?.()
      try { win?.close() } catch { /* already gone */ }
      resolve(p)
    }
    off = deps.host.listen(sid, (m) => {
      if (m.t === 'error') {
        // -1 = the page could not even load YouTube's player script
        finish(m.code === -1 || typeof m.code !== 'number' ? { kind: 'timeout' } : { kind: 'error', code: m.code })
      } else if (m.t === 'state' && m.state === 5) {
        finish({ kind: 'ready', duration: m.duration && m.duration > 0 ? m.duration : null, live: !m.duration })
      } else if (m.t === 'settled') {
        finish({ kind: 'ready', duration: m.duration && m.duration > 0 ? m.duration : null, live: !m.duration })
      }
    })
    timer = setTimeout(() => finish({ kind: 'timeout' }), deps.timeoutMs ?? 12000)
    win = deps.openHidden(deps.host.urlFor(videoId, { sid, mode: 'probe' }))
  })
}

export interface PreflightRequest {
  videoId: string
  hasFallback: boolean
}
export interface PreflightResult extends YtPreflightVerdict {
  videoId: string
  duration: number | null
}

/** Check every YouTube item, one after another (so a church's slow connection is not asked for six players at once). */
export async function preflightYouTube(deps: ProbeDeps, items: PreflightRequest[]): Promise<PreflightResult[]> {
  if (items.length === 0) return []
  const internet = await deps.checkInternet()
  const out: PreflightResult[] = []
  const seen = new Map<string, YtProbe>()
  for (const it of items) {
    let probe: YtProbe | null = null
    if (internet) {
      probe = seen.get(it.videoId) ?? (await probeVideo(deps, it.videoId))
      seen.set(it.videoId, probe)
    }
    out.push({ videoId: it.videoId, duration: probe && probe.kind === 'ready' ? probe.duration : null, ...judgeYouTubePreflight({ internet, probe, hasFallback: it.hasFallback }) })
  }
  return out
}

export interface TestPlayResult {
  ok: boolean
  /** The player's last state (YT.PlayerState), or null if it never answered. */
  state: number | null
  code: number | null
  seconds: number
}

/** Test play: a visible, MUTED player for a few seconds; says whether it really reached "playing". */
export async function testPlay(deps: ProbeDeps, videoId: string, ms = 6000): Promise<TestPlayResult> {
  await deps.host.start()
  const sid = deps.host.newSession()
  return new Promise<TestPlayResult>((resolve) => {
    let state: number | null = null
    let code: number | null = null
    let time = 0
    let reachedPlaying = false
    let win: { close(): void } | null = null
    const off = deps.host.listen(sid, (m) => {
      if (m.t === 'error') code = typeof m.code === 'number' ? m.code : -1
      if (typeof m.state === 'number') state = m.state
      if (typeof m.time === 'number') time = Math.max(time, m.time)
      if (m.state === 1) reachedPlaying = true
    })
    win = deps.openVisible(deps.host.urlFor(videoId, { sid, mode: 'test' }))
    void wait(ms).then(() => {
      off()
      try { win?.close() } catch { /* already gone */ }
      resolve({ ok: reachedPlaying && code === null, state, code, seconds: Math.round(time * 10) / 10 })
    })
  })
}
