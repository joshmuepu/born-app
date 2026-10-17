/**
 * tapePhone.ts — what the phone remote and the automation API may do to the tape, and what they are told about it (docs/design/sermon-audio/02 §6, §7.3).
 *
 * The rules are the video rules, kept in one place so they can be tested as a table:
 *  - Play is refused until the operator has started that tape once on the computer (a phone is never the first thing that makes sound);
 *  - there is NO seek-to-a-time and no dragging: only ±10 s, previous / next paragraph, and "jump to paragraph N" with an explicit confirm;
 *  - a jump tells the computer (with an Undo) where the tape was;
 *  - the phone's volume moves within ±20 % of the level the operator set;
 *  - the phone never edits the sync map.
 */
import type { SyncMark, SyncRegion } from '../shared/tape'
import { paragraphAt, startOf } from '../shared/tapeSync'
import { tapeStatusNote } from '../shared/tapePlayback'
import type { TapeHub } from './tapeHub'

export type PhoneTapeAction = 'tape-play' | 'tape-pause' | 'tape-back' | 'tape-fwd' | 'tape-next' | 'tape-prev' | 'tape-jump' | 'tape-vol-up' | 'tape-vol-down'
export const PHONE_TAPE_ACTIONS: PhoneTapeAction[] = ['tape-play', 'tape-pause', 'tape-back', 'tape-fwd', 'tape-next', 'tape-prev', 'tape-jump', 'tape-vol-up', 'tape-vol-down']
export const isPhoneTapeAction = (a: unknown): a is PhoneTapeAction => typeof a === 'string' && (PHONE_TAPE_ACTIONS as string[]).includes(a)

export type PhoneTapeRefusal = 'nothing-loaded' | 'not-started' | 'no-timing' | 'confirm-needed' | 'no-such-paragraph' | 'bad-command'
export type PhoneTapeResult = { ok: true } | { ok: false; reason: PhoneTapeRefusal; message: string }

export const REFUSAL_TEXT: Record<PhoneTapeRefusal, string> = {
  'nothing-loaded': 'No tape is loaded on the main computer.',
  'not-started': 'Start the tape on the main computer first. From here you can pause and resume it.',
  'no-timing': 'This tape has no timing yet, so paragraphs cannot be skipped from here.',
  'confirm-needed': 'Jumping to a paragraph needs to be confirmed.',
  'no-such-paragraph': 'That paragraph has no time on this tape.',
  'bad-command': 'That is not something the phone can do to the tape.'
}
const refuse = (reason: PhoneTapeRefusal): PhoneTapeResult => ({ ok: false, reason, message: REFUSAL_TEXT[reason] })

export interface PhoneTapeDeps {
  hub: TapeHub
  /** the timing of the loaded recording (null = none) */
  map: (recordingId: string) => { marks: SyncMark[]; regions: SyncRegion[]; updatedAt: string } | null
  /** the computer is told when the phone moved the tape, with where it was (the operator can Undo) */
  onJump: (info: { fromSec: number; fromParagraph: number | null; toParagraph: number }) => void
}

export function phoneTapeCommand(d: PhoneTapeDeps, cmd: { action: string; n?: number; confirm?: boolean }): PhoneTapeResult {
  if (!isPhoneTapeAction(cmd.action)) return refuse('bad-command')
  const w = d.hub.get()
  if (!w) return refuse('nothing-loaded')
  switch (cmd.action) {
    case 'tape-play': { const r = d.hub.phone('play'); return r.ok ? r : refuse(r.reason) }
    case 'tape-pause': { const r = d.hub.phone('pause'); return r.ok ? r : refuse(r.reason) }
    case 'tape-back': { const r = d.hub.phone('back'); return r.ok ? r : refuse(r.reason) }
    case 'tape-fwd': { const r = d.hub.phone('fwd'); return r.ok ? r : refuse(r.reason) }
    case 'tape-vol-up': d.hub.phoneVolume(1); return { ok: true }
    case 'tape-vol-down': d.hub.phoneVolume(-1); return { ok: true }
  }
  const m = d.map(w.recordingId)
  if (!m || !m.marks.some((x) => x.kind === 'start' && x.t !== null)) return refuse('no-timing')
  const pos = w.position
  const here = paragraphAt(m.marks, m.regions, pos)
  if (cmd.action === 'tape-next') {
    if (!here.next) return { ok: true } // the last paragraph: nothing to do
    d.hub.command({ type: 'seek', to: here.next.t })
    return { ok: true }
  }
  if (cmd.action === 'tape-prev') {
    // more than 3 s into a paragraph: back to its start; otherwise the one before
    if (here.start !== null && pos - here.start > 3) { d.hub.command({ type: 'seek', to: here.start }); return { ok: true } }
    const before = m.marks.filter((x) => x.kind === 'start' && x.t !== null && (x.t as number) < (here.start ?? pos) - 0.01).sort((a, b) => (a.t as number) - (b.t as number))
    d.hub.command({ type: 'seek', to: before.length ? (before[before.length - 1].t as number) : 0 })
    return { ok: true }
  }
  // tape-jump
  if (!Number.isInteger(cmd.n)) return refuse('bad-command')
  if (cmd.confirm !== true) return refuse('confirm-needed')
  const t = startOf(m.marks, cmd.n as number)
  if (t === null) return refuse('no-such-paragraph')
  d.onJump({ fromSec: pos, fromParagraph: here.n, toParagraph: cmd.n as number })
  d.hub.command({ type: 'seek', to: t })
  return { ok: true }
}

/** What a phone or an automation tool is told about the tape. Deliberately small (it rides on every state poll); the paragraph list is fetched separately. */
export interface TapeSummary {
  recordingId: string
  sermonId: number
  status: string
  position: number
  duration: number | null
  speed: number
  volume: number
  /** the operator has started this tape once: the phone may Play */
  canPlay: boolean
  stalled: boolean
  error: string | null
  note: string | null
  hasTiming: boolean
  /** changes whenever the timing is saved (the phone re-fetches its paragraph list) */
  timingVersion: string | null
  paragraph: number | null
  nextParagraph: number | null
  nextInSec: number | null
  /** the plain word for the sync pill */
  sync: 'in-sync' | 'no-timing' | 'in-gap' | 'differs'
}

export function tapeSummary(d: Pick<PhoneTapeDeps, 'hub' | 'map'>): TapeSummary | null {
  const w = d.hub.get()
  if (!w) return null
  const m = d.map(w.recordingId)
  const timed = !!m && m.marks.some((x) => x.kind === 'start' && x.t !== null)
  const here = timed && m ? paragraphAt(m.marks, m.regions, w.position) : null
  return {
    recordingId: w.recordingId, sermonId: w.sermonId, status: w.status, position: Math.round(w.position * 10) / 10, duration: w.duration, speed: w.speed, volume: w.volume,
    canPlay: w.hasPlayedOnce, stalled: w.stalled, error: w.error, note: tapeStatusNote(w),
    hasTiming: timed, timingVersion: m?.updatedAt ?? null,
    paragraph: here?.n ?? null, nextParagraph: here?.next?.n ?? null, nextInSec: here?.next ? Math.max(0, Math.round((here.next.t - w.position) * 10) / 10) : null,
    sync: !timed ? 'no-timing' : here?.inDiffers ? 'differs' : here?.inGap ? 'in-gap' : 'in-sync'
  }
}

/** The paragraph list the phone follows: number, start time, and the first words (never the whole text). */
export interface PhoneParagraph { n: number; t: number; snippet: string }
export function phoneParagraphList(marks: SyncMark[], texts: Map<number, string>, snippetChars = 90): PhoneParagraph[] {
  return marks
    .filter((m): m is SyncMark & { t: number } => m.kind === 'start' && typeof m.t === 'number')
    .sort((a, b) => a.t - b.t)
    .map((m) => {
      const t = (texts.get(m.n) ?? '').replace(/\s+/g, ' ').trim()
      return { n: m.n, t: Math.round(m.t * 10) / 10, snippet: t.length > snippetChars ? t.slice(0, snippetChars).replace(/\s+\S*$/, '') + '…' : t }
    })
}
