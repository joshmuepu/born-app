/**
 * tapeSync.ts — the sync map as plain functions (no Electron, no DOM): which numbered paragraph is being spoken at a given time, how the
 * editor places and nudges marks (with undo), what is wrong with a map, and the small times-only file a church can share.
 *
 * A map is keyed by the NUMBERED PARAGRAPH (see tapeParagraphs.ts), never by a database row, so "41-47" (seven paragraphs in one row)
 * works. A mark is { n, t }: paragraph n starts t seconds into the tape. A paragraph can be marked "skip" (not on this tape). A region is a
 * stretch of the tape with no text ("gap": an intro, a song, a prayer) or where the tape and the text disagree ("differs").
 */
import type { SyncMap, SyncMark, SyncRegion, SyncSource } from './tape'

export const MAX_GAP_WARN_SEC = 6 * 60

const startsOnly = (marks: SyncMark[]): Array<SyncMark & { t: number }> =>
  marks.filter((m): m is SyncMark & { t: number } => m.kind === 'start' && typeof m.t === 'number' && Number.isFinite(m.t)).sort((a, b) => a.t - b.t || a.n - b.n)

export interface ParagraphPosition {
  /** the paragraph being spoken, or null before the first timed paragraph */
  n: number | null
  /** when it started */
  start: number | null
  /** the next timed paragraph and when */
  next: { n: number; t: number } | null
  /** 0–1: how far through this paragraph the tape is (null when unknown: the last paragraph has no end) */
  progress: number | null
  /** the tape is inside a "no text here" region (an intro, a song, a prayer): the screen should keep what it has */
  inGap: boolean
  /** the tape is inside a "tape differs" region */
  inDiffers: boolean
}

/** Which paragraph is being spoken at tape time `t`. Pure; O(log n). */
export function paragraphAt(marks: SyncMark[], regions: SyncRegion[], t: number): ParagraphPosition {
  const s = startsOnly(marks)
  const inGap = regions.some((r) => r.kind === 'gap' && t >= r.start && t < r.end)
  const inDiffers = regions.some((r) => r.kind === 'differs' && t >= r.start && t < r.end)
  if (s.length === 0 || t < s[0].t) return { n: null, start: null, next: s[0] ? { n: s[0].n, t: s[0].t } : null, progress: null, inGap, inDiffers }
  let lo = 0, hi = s.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (s[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  const cur = s[lo]
  const nxt = s[lo + 1]
  const progress = nxt && nxt.t > cur.t ? Math.min(1, Math.max(0, (t - cur.t) / (nxt.t - cur.t))) : null
  return { n: cur.n, start: cur.t, next: nxt ? { n: nxt.n, t: nxt.t } : null, progress, inGap, inDiffers }
}

/** The tape time at which each timed paragraph starts, in time order (for the seek bar's ticks). */
export function tickTimes(marks: SyncMark[]): number[] {
  return startsOnly(marks).map((m) => m.t)
}
export function startOf(marks: SyncMark[], n: number): number | null {
  const m = marks.find((x) => x.n === n && x.kind === 'start' && x.t !== null)
  return m ? (m.t as number) : null
}
export function timedCount(marks: SyncMark[]): number {
  return marks.filter((m) => m.kind === 'start' && m.t !== null).length
}

export interface MapIssue {
  level: 'error' | 'warn'
  code: 'order' | 'range' | 'gap' | 'duplicate' | 'overlap'
  message: string
  n?: number
}

/** What is wrong with a map. Errors stop a save; warnings are shown. `numbers` = the paragraph numbers of the text, `duration` = the tape's length. */
export function validateMap(marks: SyncMark[], regions: SyncRegion[], duration: number | null, numbers?: number[]): MapIssue[] {
  const out: MapIssue[] = []
  const seen = new Set<number>()
  for (const m of marks) {
    if (seen.has(m.n)) out.push({ level: 'error', code: 'duplicate', message: `Paragraph ${m.n} has two times.`, n: m.n })
    seen.add(m.n)
    if (m.kind === 'start' && (m.t === null || !Number.isFinite(m.t) || m.t < 0 || (duration !== null && m.t > duration))) {
      out.push({ level: 'error', code: 'range', message: `Paragraph ${m.n} is outside the tape (${m.t === null ? 'no time' : m.t.toFixed(1) + ' s'}).`, n: m.n })
    }
  }
  // times must not go backwards as the paragraph numbers go up
  const byN = marks.filter((m) => m.kind === 'start' && m.t !== null).sort((a, b) => a.n - b.n)
  for (let i = 1; i < byN.length; i++) {
    if ((byN[i].t as number) < (byN[i - 1].t as number)) {
      out.push({ level: 'error', code: 'order', message: `Paragraph ${byN[i].n} starts before paragraph ${byN[i - 1].n}. Times must go forward.`, n: byN[i].n })
    }
  }
  const sorted = startsOnly(marks)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].t - sorted[i - 1].t > MAX_GAP_WARN_SEC) out.push({ level: 'warn', code: 'gap', message: `${Math.round((sorted[i].t - sorted[i - 1].t) / 60)} minutes pass between paragraphs ${sorted[i - 1].n} and ${sorted[i].n}. Is a paragraph missing?`, n: sorted[i - 1].n })
  }
  for (const r of regions) if (!(r.end > r.start) || r.start < 0 || (duration !== null && r.start > duration)) out.push({ level: 'error', code: 'range', message: 'A marked region is empty or outside the tape.' })
  if (numbers) {
    const have = new Set(marks.map((m) => m.n))
    const missing = numbers.filter((n) => !have.has(n)).length
    if (missing > 0) out.push({ level: 'warn', code: 'gap', message: `${missing} paragraph${missing === 1 ? ' has' : 's have'} no time yet.` })
  }
  return out
}

// ── the editor: state, actions, undo ─────────────────────────────────────────────

export interface EditorState {
  marks: SyncMark[]
  regions: SyncRegion[]
  /** earlier states, newest last (Undo pops) */
  past: Array<{ marks: SyncMark[]; regions: SyncRegion[] }>
  dirty: boolean
}
export const emptyEditor = (marks: SyncMark[] = [], regions: SyncRegion[] = []): EditorState => ({ marks, regions, past: [], dirty: false })

export type EditorAction =
  | { type: 'tap'; n: number; t: number }
  | { type: 'set'; n: number; t: number }
  | { type: 'nudge'; n: number; by: number }
  | { type: 'clear'; n: number }
  | { type: 'skip'; n: number }
  | { type: 'region-add'; region: SyncRegion }
  | { type: 'region-remove'; index: number }
  | { type: 'replace'; marks: SyncMark[]; regions: SyncRegion[] }
  | { type: 'undo' }
  | { type: 'saved' }

const round = (t: number): number => Math.round(t * 100) / 100
const MAX_HISTORY = 200

function commit(s: EditorState, marks: SyncMark[], regions: SyncRegion[] = s.regions): EditorState {
  return { marks: [...marks].sort((a, b) => a.n - b.n), regions, past: [...s.past, { marks: s.marks, regions: s.regions }].slice(-MAX_HISTORY), dirty: true }
}
const without = (marks: SyncMark[], n: number): SyncMark[] => marks.filter((m) => m.n !== n)

export function editorReduce(s: EditorState, a: EditorAction): EditorState {
  switch (a.type) {
    case 'tap':
    case 'set':
      return commit(s, [...without(s.marks, a.n), { n: a.n, t: round(Math.max(0, a.t)), kind: 'start', confidence: null }])
    case 'nudge': {
      const m = s.marks.find((x) => x.n === a.n && x.kind === 'start' && x.t !== null)
      if (!m) return s
      // a hand-corrected time is no longer a guess: its confidence is cleared
      return commit(s, [...without(s.marks, a.n), { ...m, t: round(Math.max(0, (m.t as number) + a.by)), confidence: null }])
    }
    case 'clear':
      return s.marks.some((m) => m.n === a.n) ? commit(s, without(s.marks, a.n)) : s
    case 'skip':
      return commit(s, [...without(s.marks, a.n), { n: a.n, t: null, kind: 'skip', confidence: null }])
    case 'region-add':
      return commit(s, s.marks, [...s.regions, { ...a.region, start: round(a.region.start), end: round(a.region.end) }].sort((x, y) => x.start - y.start))
    case 'region-remove':
      return a.index >= 0 && a.index < s.regions.length ? commit(s, s.marks, s.regions.filter((_, i) => i !== a.index)) : s
    case 'replace':
      return commit(s, a.marks, a.regions)
    case 'undo': {
      const prev = s.past[s.past.length - 1]
      return prev ? { marks: prev.marks, regions: prev.regions, past: s.past.slice(0, -1), dirty: s.past.length > 1 } : s
    }
    case 'saved':
      return { ...s, past: [], dirty: false }
  }
}

/** The paragraph the next tap should time: the first number (in order) after the latest timed one that has no mark yet, else the first without a mark. */
export function nextTarget(marks: SyncMark[], numbers: number[]): number | null {
  if (numbers.length === 0) return null
  const have = new Set(marks.map((m) => m.n))
  const latest = marks.filter((m) => m.kind === 'start' && m.t !== null).sort((a, b) => (b.t as number) - (a.t as number))[0]
  const after = latest ? numbers.filter((n) => n > latest.n) : numbers
  return after.find((n) => !have.has(n)) ?? numbers.find((n) => !have.has(n)) ?? null
}

/** A tap lands at the moment the key was pressed MINUS the operator's reaction time (people press a little after the word). */
export function tapTime(positionSec: number, reactionSec: number): number {
  return round(Math.max(0, positionSec - Math.max(0, Math.min(2, reactionSec))))
}

// ── the times-only file ──────────────────────────────────────────────────────────

export const TIMING_FORMAT = 'born-sync'
export const TIMING_VERSION = 1

export interface TimingFile {
  format: typeof TIMING_FORMAT
  v: number
  /** what recording it was made for (by its content hash), so the right one is found again */
  recording: { hash: string; durationSec: number; language: string }
  sermon: { id: number; dateCode: string }
  textLanguage: string | null
  source: SyncSource
  /** [n, seconds, confidence?, 'k' for skip] */
  marks: Array<[number, number | null, number | null, 'start' | 'skip']>
  regions: SyncRegion[]
}

/** The small file a church can share: TIMES ONLY — no sermon text, no audio. */
export function toTimingFile(map: Pick<SyncMap, 'marks' | 'regions' | 'source' | 'textLanguage'>, rec: { hash: string; durationSec: number; language: string }, sermon: { id: number; dateCode: string }): TimingFile {
  return {
    format: TIMING_FORMAT,
    v: TIMING_VERSION,
    recording: rec,
    sermon,
    textLanguage: map.textLanguage,
    source: map.source,
    marks: map.marks.map((m) => [m.n, m.t === null ? null : round(m.t), m.confidence ?? null, m.kind]),
    regions: map.regions.map((r) => ({ kind: r.kind, start: round(r.start), end: round(r.end), ...(r.note ? { note: r.note.slice(0, 200) } : {}) }))
  }
}

export type TimingParse = { ok: true; file: TimingFile; marks: SyncMark[]; regions: SyncRegion[] } | { ok: false; message: string }

/** Read a timing file from text. Never throws; refuses anything that is not exactly what BORN writes. */
export function parseTimingFile(text: string): TimingParse {
  let j: unknown
  try {
    j = JSON.parse(text)
  } catch {
    return { ok: false, message: 'This is not a BORN timing file (it could not be read).' }
  }
  if (!j || typeof j !== 'object') return { ok: false, message: 'This is not a BORN timing file.' }
  const o = j as Record<string, unknown>
  if (o.format !== TIMING_FORMAT) return { ok: false, message: 'This is not a BORN timing file.' }
  if (typeof o.v !== 'number' || o.v > TIMING_VERSION) return { ok: false, message: 'This timing file was made by a newer BORN. Update BORN to use it.' }
  const rec = o.recording as Record<string, unknown> | undefined
  const sermon = o.sermon as Record<string, unknown> | undefined
  if (!rec || typeof rec.hash !== 'string' || typeof rec.durationSec !== 'number' || !sermon || typeof sermon.id !== 'number') return { ok: false, message: 'This timing file is damaged.' }
  if (!Array.isArray(o.marks) || o.marks.length > 5000) return { ok: false, message: 'This timing file is damaged.' }
  const marks: SyncMark[] = []
  for (const x of o.marks) {
    if (!Array.isArray(x) || typeof x[0] !== 'number' || !Number.isInteger(x[0]) || x[0] < 1) return { ok: false, message: 'This timing file has a damaged paragraph entry.' }
    const kind = x[3] === 'skip' ? 'skip' : 'start'
    if (kind === 'start' && (typeof x[1] !== 'number' || !Number.isFinite(x[1]) || x[1] < 0)) return { ok: false, message: `Paragraph ${x[0]} has no usable time in this file.` }
    marks.push({ n: x[0], t: kind === 'skip' ? null : (x[1] as number), confidence: typeof x[2] === 'number' ? x[2] : null, kind })
  }
  const regions: SyncRegion[] = []
  for (const r of Array.isArray(o.regions) ? o.regions : []) {
    const x = r as Record<string, unknown>
    if ((x.kind !== 'gap' && x.kind !== 'differs') || typeof x.start !== 'number' || typeof x.end !== 'number' || !(x.end > x.start)) continue
    regions.push({ kind: x.kind, start: x.start, end: x.end, note: typeof x.note === 'string' ? x.note.slice(0, 200) : undefined })
  }
  const file: TimingFile = {
    format: TIMING_FORMAT, v: o.v, recording: { hash: rec.hash, durationSec: rec.durationSec, language: typeof rec.language === 'string' ? rec.language : 'en' },
    sermon: { id: sermon.id, dateCode: typeof sermon.dateCode === 'string' ? sermon.dateCode : '' }, textLanguage: typeof o.textLanguage === 'string' ? o.textLanguage : null,
    source: o.source === 'auto' || o.source === 'imported' ? o.source : 'tap', marks: marks.map((m) => [m.n, m.t, m.confidence ?? null, m.kind]), regions
  }
  return { ok: true, file, marks, regions }
}
