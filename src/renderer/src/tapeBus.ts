/**
 * tapeBus.ts — a tiny in-window event bus so the places that show the tape (the bottom bar, the Tape place, the reader) refresh when something
 * they all depend on changes, without each of them polling. (The sound clock itself comes from the main process via useTape.)
 */
export type TapeBusEvent = 'map-changed' | 'recordings-changed'
const NAME = 'born:tape'
export function emitTape(e: TapeBusEvent): void {
  try { window.dispatchEvent(new CustomEvent(NAME, { detail: e })) } catch { /* no window in some tests */ }
}
export function onTape(cb: (e: TapeBusEvent) => void): () => void {
  const h = (ev: Event): void => cb((ev as CustomEvent<TapeBusEvent>).detail)
  window.addEventListener(NAME, h)
  return () => window.removeEventListener(NAME, h)
}

/** The background timing (tapeAuto in the main process), shared by every place that shows a recording. One subscription for the whole window. */
import { useEffect, useState } from 'react'
export interface TimingState { active: { id: string; phase: 'prepare' | 'listen' | 'match'; pct: number } | null; queued: string[]; available: boolean }
export interface TimingDone { recordingId: string; ok: boolean; located: number; paragraphs: number; message: string }
const NONE: TimingState = { active: null, queued: [], available: false }
export const timingPct = (a: NonNullable<TimingState['active']>): number => (a.phase === 'prepare' ? Math.round(a.pct * 0.15) : a.phase === 'listen' ? 15 + Math.round(a.pct * 0.83) : 99)
/** how far one recording is: { pct } while it is being timed, 'queued' while it waits, null otherwise */
export function timingOf(s: TimingState, id: string | null | undefined): { pct: number } | 'queued' | null {
  if (!id) return null
  if (s.active?.id === id) return { pct: timingPct(s.active) }
  return s.queued.includes(id) ? 'queued' : null
}
export function useTimingState(): TimingState {
  const [s, setS] = useState<TimingState>(NONE)
  useEffect(() => {
    let alive = true
    const api = window.electronAPI
    void Promise.resolve(api?.tapeTimingState?.()).then((x) => { if (alive && x) setS(x as TimingState) }).catch(() => {})
    const off = api?.onTapeTiming?.((x) => { if (alive) setS(x as TimingState) })
    const offDone = api?.onTapeTimingDone?.(() => { emitTape('map-changed'); emitTape('recordings-changed') })
    return () => { alive = false; off?.(); offDone?.() }
  }, [])
  return s
}
