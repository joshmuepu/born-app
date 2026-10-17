/**
 * tapeLibrary.ts — how the Tape place describes a recording in its list (docs/design/sermon-audio/mockups/19-rec-library.html). Pure.
 * Always words first; the tone only picks the colour.
 */
import type { TapeFileStatus } from './tape'

export interface LibraryStatus { tone: 'ok' | 'warn' | 'bad'; label: string; detail: string }

/** Where the automatic timing is for one recording: running (with how far), or waiting its turn. */
export type TimingNow = { pct: number } | 'queued' | null

export function libraryStatus(e: { status: TapeFileStatus; timed: number }, timing: TimingNow = null): LibraryStatus {
  switch (e.status) {
    case 'missing': return { tone: 'bad', label: 'File missing', detail: 'The recording file cannot be found.' }
    case 'offline': return { tone: 'bad', label: 'Drive not connected', detail: 'The recording is on a drive that is not plugged in.' }
    case 'unreadable': return { tone: 'bad', label: 'Cannot read the file', detail: 'The file is there, but BORN cannot read it.' }
    case 'changed': return { tone: 'warn', label: 'File was changed', detail: 'The file is not the one that was added (it may be damaged).' }
    default:
      if (e.timed === 0 && timing) {
        return timing === 'queued'
          ? { tone: 'warn', label: 'Timing soon', detail: 'It plays now. The text will follow it once BORN has listened to it.' }
          : { tone: 'warn', label: `Timing… ${timing.pct}%`, detail: 'It plays now. BORN is listening to it in the background; the text will follow it when this finishes.' }
      }
      return e.timed > 0
        ? { tone: 'ok', label: 'Timed', detail: e.timed === 1 ? '1 paragraph has a time.' : `${e.timed} paragraphs have a time.` }
        : { tone: 'warn', label: 'Needs timing', detail: 'It plays, but the text cannot follow it yet.' }
  }
}

/** Library order: problems first (they need the operator), then recordings that need timing, then the ready ones; newest first inside each group. */
export function sortLibrary<T extends { status: TapeFileStatus; timed: number; createdAt: string }>(list: T[]): T[] {
  const rank = (e: T): number => { const s = libraryStatus(e); return s.tone === 'bad' ? 0 : s.tone === 'warn' ? 1 : 2 }
  return [...list].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt))
}
