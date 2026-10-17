import type { LiveChannel, SlidePayload } from './types'

/** What the Now dock says about the screens, in words: the item on air, or why nothing is. */
export type LiveSummary =
  | { state: 'live'; title: string }
  | { state: 'hidden'; title: string }
  | { state: 'empty' }
  | { state: 'off' }

export function slideTitle(s: SlidePayload | null): string {
  if (!s) return ''
  return [s.label, s.reference].filter(Boolean).join(' · ')
}

/** `projectionOpen`: the congregation window is open. A hidden screen keeps its item (your place is kept), so the dock still says what will come back. */
export function liveSummary(main: LiveChannel | undefined, projectionOpen: boolean, blanked: boolean): LiveSummary {
  if (!projectionOpen) return { state: 'off' }
  const title = main?.current ? slideTitle(main.current) || 'On screen' : ''
  if (blanked) return { state: 'hidden', title }
  return main?.current ? { state: 'live', title } : { state: 'empty' }
}

/** "0:42", "12:05", "1:02:03" */
export function formatSince(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`
}
