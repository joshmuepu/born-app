/**
 * tapeScreen.ts — what a screen shows while a tape runs (docs/design/sermon-audio/02 §1.5, §3.2). Pure; no DOM, no Electron.
 *
 * A "tape screen" travels as an optional `tape` field on the ordinary slide payload, so Take / Preview / Live / blank / clear / Esc all behave exactly as
 * for any slide. The screen then works out WHICH page to show from the tape's own position (it receives the same state the operator's player gets).
 */
import type { SyncMark, SyncRegion } from './tape'
import { paragraphAt } from './tapeSync'
import { paginateText } from './paginate'

export type TapeScreenMode = 'highlight' | 'one' | 'lower-third'

/** One page of one numbered paragraph (a long paragraph is several pages, from the same split the reader and projector already use). */
export interface TapeScreenItem {
  n: number
  /** the reader's marker for the page: "14", "14a" */
  marker: string
  text: string
}
export type TapePalette = 'dark' | 'light' | 'contrast'

export interface TapeScreenSpec {
  v: 1
  palette?: TapePalette
  recordingId: string
  sermonId: number
  title: string
  mode: TapeScreenMode
  /** "show next paragraph early" (one-at-a-time), seconds 0–10 */
  leadSec: number
  /** when set the screen does NOT follow the tape: it holds this paragraph number (the "projector follows" switch is off) */
  pinned: number | null
  items: TapeScreenItem[]
  marks: Array<Pick<SyncMark, 'n' | 't' | 'kind'>>
  regions: SyncRegion[]
}

/** The shortest time a page of a long paragraph stays up, however fast the speaker is. */
export const MIN_PAGE_SECONDS = 4
/** For the last paragraph (no end time) a page is assumed to last this long. */
export const LAST_PAGE_SECONDS = 9

export const clampLead = (n: number): number => (Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : 4)

/** Which page of a paragraph of `pageCount` pages is being spoken `elapsed` seconds in, when the paragraph lasts `duration` (null = unknown). */
export function pageAt(pageCount: number, elapsed: number, duration: number | null): number {
  if (pageCount <= 1) return 0
  const natural = duration !== null && duration > 0 ? duration / pageCount : LAST_PAGE_SECONDS
  return Math.min(pageCount - 1, Math.max(0, Math.floor(Math.max(0, elapsed) / Math.max(MIN_PAGE_SECONDS, natural))))
}

export interface TapeScreenView {
  /** the paragraph the speaker is in (null before the first timed one) */
  speaking: number | null
  /** index in `spec.items` of the page to show (null = nothing to show yet) */
  index: number | null
  /** the paragraph shown there */
  shown: number | null
  page: number
  pages: number
  /** the next paragraph and the seconds until the speaker starts it */
  next: { n: number; inSec: number; index: number | null } | null
  /** 0–1 through the paragraph being spoken (null when unknown) */
  progress: number | null
  /** the tape is in a "no text here" stretch: keep what is on screen */
  hold: boolean
  inDiffers: boolean
}

const firstIndexOf = (items: TapeScreenItem[], n: number): number => items.findIndex((i) => i.n === n)

/** The view for tape time `pos`. `pos` is the speaker's position; the one-at-a-time lead looks ahead of it. */
export function tapeScreenView(spec: TapeScreenSpec, pos: number): TapeScreenView {
  const lead = spec.mode === 'one' ? clampLead(spec.leadSec) : 0
  const here = paragraphAt(spec.marks as SyncMark[], spec.regions, pos)
  const ahead = lead > 0 ? paragraphAt(spec.marks as SyncMark[], spec.regions, pos + lead) : here

  // the "projector follows" switch is off: hold one paragraph
  const target = spec.pinned !== null ? { n: spec.pinned, start: null as number | null, next: null as { n: number; t: number } | null, progress: null as number | null } : { n: ahead.n, start: ahead.start, next: ahead.next, progress: ahead.progress }
  const base = { speaking: here.n, hold: spec.pinned === null && here.inGap, inDiffers: here.inDiffers, progress: here.progress }
  if (target.n === null) return { ...base, index: null, shown: null, page: 0, pages: 0, next: here.next ? { n: here.next.n, inSec: Math.max(0, here.next.t - pos), index: firstIndexOf(spec.items, here.next.n) } : null }
  const first = firstIndexOf(spec.items, target.n)
  if (first < 0) return { ...base, index: null, shown: target.n, page: 0, pages: 0, next: null }
  let pages = 1
  while (first + pages < spec.items.length && spec.items[first + pages].n === target.n) pages++
  // time into the shown paragraph is measured on the shown paragraph's own clock (the lead shifts both ends)
  const elapsed = target.start === null ? 0 : pos + lead - target.start
  const duration = target.start !== null && target.next ? target.next.t - target.start : null
  const page = spec.pinned !== null ? 0 : pageAt(pages, elapsed, duration)
  const nx = here.next
  return {
    ...base,
    index: first + page,
    shown: target.n,
    page,
    pages,
    next: nx ? { n: nx.n, inSec: Math.max(0, nx.t - pos), index: firstIndexOf(spec.items, nx.n) } : null
  }
}

/** The page after the one at `index` (for "next" previews inside a long paragraph, else the next paragraph); null at the end. */
export function followingIndex(spec: TapeScreenSpec, index: number | null): number | null {
  if (index === null || index + 1 >= spec.items.length) return null
  return index + 1
}

/** A short text for assistive technology and the operator's Live panel: "Paragraph 14 (page 2 of 3)". */
export function describeView(v: TapeScreenView): string {
  if (v.shown === null) return 'Waiting for the tape to begin'
  return `Paragraph ${v.shown}${v.pages > 1 ? ` (page ${v.page + 1} of ${v.pages})` : ''}`
}

/** Characters in one lower-third page (about two lines of a 16:9 lower third). */
export const LOWER_THIRD_CHARS = 170

/**
 * The same screen re-cut for the lower third / a Graphics output: each paragraph becomes short pages (sentence ends first), and the tape pages through
 * them in proportion to its progress, never faster than the floor. The page numbers come back as the paragraph's number.
 */
export function lowerThirdSpec(spec: TapeScreenSpec, maxChars = LOWER_THIRD_CHARS): TapeScreenSpec {
  const byN = new Map<number, string[]>()
  const order: number[] = []
  for (const it of spec.items) {
    if (!byN.has(it.n)) { byN.set(it.n, []); order.push(it.n) }
    byN.get(it.n)!.push(it.text)
  }
  const items: TapeScreenItem[] = []
  for (const n of order) {
    const pages = paginateText(byN.get(n)!.join(' '), maxChars)
    pages.forEach((text, i) => items.push({ n, marker: i === 0 ? String(n) : `${n}${String.fromCharCode(97 + Math.min(i, 25))}`, text }))
  }
  return { ...spec, mode: 'lower-third', items }
}

/** What a Graphics page should say right now for this tape screen (null = nothing to show yet). */
export function lowerThirdNow(spec: TapeScreenSpec, pos: number): { text: string; marker: string; index: number } | null {
  const lt = spec.mode === 'lower-third' ? spec : lowerThirdSpec(spec)
  const v = tapeScreenView(lt, pos)
  if (v.index === null) return null
  const it = lt.items[v.index]
  return { text: it.text, marker: it.marker, index: v.index }
}

/** A key that changes exactly when a Graphics output needs a NEW frame for this tape screen (a new page, a pin change, a different recording). */
export function tapeGraphicsKey(spec: TapeScreenSpec, pos: number): string {
  const now = lowerThirdNow(spec, pos)
  return `${spec.recordingId}|${spec.pinned ?? ''}|${now ? now.index : 'none'}`
}

/** A slide as outside observers (automation API, health snapshot) see it: a tape screen's paragraphs and timing are left out — only what it is. */
export function withoutTapeBody<S extends { tape?: TapeScreenSpec }>(s: S | null): S | null {
  if (!s || !s.tape) return s
  const t = s.tape
  return { ...s, tape: { v: 1, recordingId: t.recordingId, sermonId: t.sermonId, title: t.title, mode: t.mode, leadSec: t.leadSec, pinned: t.pinned, items: [], marks: [], regions: [] } }
}
