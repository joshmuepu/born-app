/**
 * youtube.ts — everything about a YouTube queue item that needs no Electron and no DOM: reading a pasted link, the plain-language
 * meaning of the player's error codes, the online preflight verdict, how the player's raw numbers become a playback report, and
 * the alert policy.
 *
 * The rules this follows (docs/design/media/06-youtube.md, docs/notes/youtube-needs-counsel.md): the video plays ONLY in YouTube's
 * own embedded player, controlled ONLY with the documented IFrame Player API. BORN never downloads, saves, converts, restyles,
 * covers, skips or blocks anything, and never reads YouTube pages. Only the video id and a few settings are ever stored.
 */

/** A YouTube video id: exactly 11 characters of A–Z a–z 0–9 _ - . */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
export const isVideoId = (s: unknown): s is string => typeof s === 'string' && VIDEO_ID.test(s)

/** The id the playback record uses for a YouTube video (the record is keyed by a string; library ids are `m_<hex>`). */
export const ytMediaId = (videoId: string): string => `yt-${videoId}`
export const isYouTubeMediaId = (s: unknown): s is string => typeof s === 'string' && /^yt-[A-Za-z0-9_-]{11}$/.test(s)
export const videoIdOfMediaId = (s: string): string => s.slice(3)

export type YtParseResult = { ok: true; videoId: string } | { ok: false; reason: 'empty' | 'not-youtube' | 'no-video' | 'playlist-only' | 'bad-id'; message: string }

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])
const PATH_FORMS = new Set(['embed', 'shorts', 'live', 'v'])

const fail = (reason: Extract<YtParseResult, { ok: false }>['reason']): YtParseResult => ({
  ok: false,
  reason,
  message:
    reason === 'empty' ? 'Paste a YouTube link.'
    : reason === 'not-youtube' ? "That isn't a YouTube link."
    : reason === 'playlist-only' ? 'That link is a playlist. Open one video in it and paste that video’s link.'
    : reason === 'bad-id' ? "That doesn't look like a complete YouTube link — the video code is wrong."
    : "That YouTube link doesn't point at one video."
})

/**
 * Read a pasted link or a bare video id. Accepts watch, youtu.be, shorts, embed, live and /v/ forms (with or without `https://`,
 * `www.`, `m.`). A start time (`t=`, `start=`) and playlist parameters (`list=`, `index=`) are ignored on purpose: only the video is kept.
 * Never throws.
 */
export function parseYouTubeInput(input: unknown): YtParseResult {
  if (typeof input !== 'string') return fail('empty')
  const raw = input.trim()
  if (!raw) return fail('empty')
  if (isVideoId(raw)) return { ok: true, videoId: raw }
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return fail('not-youtube')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fail('not-youtube')
  const host = url.hostname.toLowerCase()
  let candidate: string | null = null
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? null
  } else if (HOSTS.has(host)) {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] === 'watch') candidate = url.searchParams.get('v')
    else if (parts[0] && PATH_FORMS.has(parts[0])) candidate = parts[1] ?? null
    else if (parts[0] === 'playlist' && url.searchParams.get('list')) return fail('playlist-only')
  } else {
    return fail('not-youtube')
  }
  if (!candidate) return fail('no-video')
  return isVideoId(candidate) ? { ok: true, videoId: candidate } : fail('bad-id')
}

/** The ordinary watch address (shown to the operator, and what "Open on YouTube" would use). Never fetched by BORN. */
export const youtubeWatchUrl = (videoId: string): string => `https://www.youtube.com/watch?v=${videoId}`

// ── what the player's error codes mean ──────────────────────────────────────

export type YtProblem = 'invalid' | 'not-found' | 'not-embeddable' | 'blocked' | 'identity' | 'player'

export interface YtErrorInfo {
  problem: YtProblem
  /** One short plain sentence for the operator bar and the preflight row. */
  short: string
  /** What to do about it, in plain words. */
  fix: string
}

/** The documented IFrame Player API `onError` codes (https://developers.google.com/youtube/iframe_api_reference#Events). */
export function youtubeErrorInfo(code: number): YtErrorInfo {
  switch (code) {
    case 2:
      return { problem: 'invalid', short: "That isn't a valid YouTube video.", fix: 'Check the link and add the video again.' }
    case 5:
      return { problem: 'player', short: "YouTube's player had a problem (code 5).", fix: 'Press Clear and take it again. If it keeps happening, use a file from your Media library instead.' }
    case 100:
      return { problem: 'not-found', short: 'This video was removed or is private.', fix: 'Open the link in a browser to check. Choose another video, or replace this item with a file from your Media library.' }
    case 101:
    case 150:
      return { problem: 'not-embeddable', short: 'The owner of this video does not allow it to be shown in other programs.', fix: 'Choose another video, or replace this item with a file from your Media library. Nothing in BORN can change this.' }
    case 153:
      return { problem: 'identity', short: "YouTube could not identify BORN (error 153).", fix: 'This is a BORN problem, not yours. Use a file from your Media library for tonight and tell the person who looks after BORN.' }
    default:
      return { problem: 'player', short: `YouTube's player stopped (code ${Number.isFinite(code) ? code : '?'}).`, fix: 'Press Clear and take it again. If it keeps happening, use a file from your Media library instead.' }
  }
}

// ── online preflight ───────────────────────────────────────────────────────

export type YtPreflightStatus = 'ready' | 'unreachable' | 'blocked' | 'not-embeddable' | 'unknown'

/** What the hidden cue-only probe player said. */
export type YtProbe =
  | { kind: 'ready'; duration: number | null; live?: boolean }
  | { kind: 'error'; code: number }
  /** No answer in time. */
  | { kind: 'timeout' }

export interface YtPreflightInput {
  /** Could BORN reach the internet at all (a plain request to YouTube's player script)? */
  internet: boolean
  /** The probe, or null when it could not be run (no internet). */
  probe: YtProbe | null
  hasFallback: boolean
}

export interface YtPreflightVerdict {
  status: YtPreflightStatus
  level: 'pass' | 'warn' | 'fail'
  title: string
  detail: string
  /** The plain ways out, in order. */
  fixes: Array<'replace-local' | 'remove' | 'recheck'>
}

/** The same words are used on the Check screen and in the operator bar, so a church sees one story. */
export function judgeYouTubePreflight(i: YtPreflightInput): YtPreflightVerdict {
  const noFallback = i.hasFallback ? '' : ' It has no backup: add a file from your Media library as one, or be ready to press Clear.'
  if (!i.internet) {
    return {
      status: 'unreachable',
      level: 'warn',
      title: "Can't check — this computer is offline",
      detail: `YouTube items need the internet when they play.${noFallback} The item stays in the queue.`,
      fixes: ['recheck', 'replace-local']
    }
  }
  const p = i.probe
  if (!p || p.kind === 'timeout') {
    return {
      status: 'unreachable',
      level: 'fail',
      title: "YouTube didn't answer",
      detail: `The internet works, but YouTube's player did not respond in time. It may be slow or blocked on this network.${noFallback}`,
      fixes: ['recheck', 'replace-local']
    }
  }
  if (p.kind === 'error') {
    const info = youtubeErrorInfo(p.code)
    const status: YtPreflightStatus = info.problem === 'not-embeddable' ? 'not-embeddable' : info.problem === 'not-found' || info.problem === 'invalid' ? 'blocked' : info.problem === 'identity' ? 'blocked' : 'unreachable'
    return { status, level: 'fail', title: info.short, detail: info.fix, fixes: ['replace-local', 'remove'] }
  }
  if (p.live) {
    return { status: 'unknown', level: 'warn', title: 'Live or upcoming video — can’t be tested ahead of time', detail: 'It will be treated as a manual stop: there is no end time to count down to.', fixes: ['recheck'] }
  }
  return {
    status: 'ready',
    level: i.hasFallback ? 'pass' : 'warn',
    title: i.hasFallback ? 'Ready — YouTube accepted it' : 'Ready — but it has no backup',
    detail: `Ads may appear before or during the video, and BORN cannot remove them. Use “Test play” to see what the congregation would see.${i.hasFallback ? '' : ' Add a backup from your Media library in case the internet drops.'}`,
    fixes: i.hasFallback ? [] : ['replace-local']
  }
}

// ── the player's raw numbers → a playback report ─────────────────────────────

/** YT.PlayerState values (documented): -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued. */
export interface YtRaw {
  state: number
  time: number
  duration: number
  error?: number | null
}

export interface YtReport {
  position: number
  playing: boolean
  duration: number | null
  ended: boolean
  stalled: boolean
  error: string | null
}

/** After this many one-second checks of "playing" or "buffering" with the clock not moving, the bar says so (it also covers an ad, without ever claiming to detect one). */
export const YT_STALL_TICKS = 3

/**
 * Turn what the player says (once a second) into the report the playback record takes. `stillTicks` is carried between calls by the
 * caller. The report never invents anything: with no answer at all the caller sends nothing and the bar shows "No reply from player".
 */
export function ytToReport(raw: YtRaw, prev: { time: number; stillTicks: number }): { report: YtReport; stillTicks: number } {
  const time = Number.isFinite(raw.time) && raw.time >= 0 ? raw.time : 0
  const duration = Number.isFinite(raw.duration) && raw.duration > 0 ? raw.duration : null
  const wantsMoving = raw.state === 1 || raw.state === 3
  const still = wantsMoving && Math.abs(time - prev.time) < 0.01 ? prev.stillTicks + 1 : 0
  const error = raw.error != null ? youtubeErrorInfo(raw.error).short : null
  return {
    stillTicks: still,
    report: { position: time, playing: raw.state === 1, duration, ended: raw.state === 0, stalled: still >= YT_STALL_TICKS, error }
  }
}

// ── alerts ───────────────────────────────────────────────────────────────

/**
 * ALERT POLICY for a YouTube video that is live on the congregation screen.
 *
 *   'stage-only'  — YouTube's rules forbid any overlay in front of any part of the embedded player. Until counsel says whether
 *                   re-laying-out the screen to make room for an alert is acceptable (docs/notes/youtube-needs-counsel.md, §3),
 *                   an alert is NEVER drawn on the congregation screen while a YouTube video is live there. It goes to the
 *                   stage monitor only, and the operator is told so.
 *   'overlay'     — (not used) the normal behaviour for everything that is not YouTube.
 *
 * This is the one place the policy lives. Change this constant and nothing else.
 */
export const YOUTUBE_ALERT_POLICY: 'stage-only' | 'overlay' = 'stage-only'

export type AlertTarget = 'congregation' | 'stage' | 'both'

/** Where an alert may go, given where the operator asked and whether a YouTube video is live on the congregation screen. */
export function alertTargetsFor(requested: AlertTarget, youtubeLiveOnCongregation: boolean): { congregation: boolean; stage: boolean; withheld: boolean } {
  const wantCong = requested === 'congregation' || requested === 'both'
  const wantStage = requested === 'stage' || requested === 'both'
  if (youtubeLiveOnCongregation && YOUTUBE_ALERT_POLICY === 'stage-only' && wantCong) {
    // the congregation part is withheld; the message still reaches the stage monitor so it is never simply lost
    return { congregation: false, stage: true, withheld: true }
  }
  return { congregation: wantCong, stage: wantStage, withheld: false }
}

// ── the operator's label ───────────────────────────────────────────────────

/** What a row is called when YouTube's title could not be read: the operator's own label, else the id. */
export function youtubeDisplayName(i: { title?: string; label?: string; videoId: string }): string {
  const l = (i.label ?? '').trim()
  if (l) return l
  const t = (i.title ?? '').trim()
  return t || `YouTube video ${i.videoId}`
}
