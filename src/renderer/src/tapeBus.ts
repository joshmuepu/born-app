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
