import { useSyncExternalStore } from 'react'

/**
 * The tape's actions, registered by the bottom bar while a tape is loaded, so the keyboard and the command palette can do exactly what the bar's buttons
 * do without knowing anything about the player. `null` = no tape is loaded.
 */
export interface TapeActions {
  toggle: () => void
  back: () => void
  forward: () => void
  prevParagraph: () => void
  nextParagraph: () => void
  /** put the tape's text on the screens, or take it off (whichever applies) */
  screens: () => void
  /** "Text on the screens" right now? */
  onScreens: () => boolean
}
let current: TapeActions | null = null
const subs = new Set<() => void>()
export function setTapeActions(a: TapeActions | null): void {
  if ((a === null) === (current === null)) { current = a; return } // same loaded-ness: replace quietly, nobody needs to re-render
  current = a
  subs.forEach((f) => f())
}
export const getTapeActions = (): TapeActions | null => current
/** True while a tape is loaded (re-renders the caller only when that changes). */
export function useTapeLoaded(): boolean {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => current !== null)
}

export type TapeShortcut = 'toggle' | 'back' | 'forward' | 'prev' | 'next'
/**
 * ⌘/Ctrl+Shift+P play/pause · ⌘/Ctrl+Shift+←/→ back / forward 10 s · ⌘/Ctrl+Shift+[ / ] previous / next paragraph. Plain Space, the arrows and the
 * brackets are NOT used: Space and the arrows already mean "next slide" in the operator console, and must never move the tape by accident.
 */
export function matchTapeShortcut(e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): TapeShortcut | null {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return null
  switch (e.code) {
    case 'KeyP': return 'toggle'
    case 'ArrowLeft': return 'back'
    case 'ArrowRight': return 'forward'
    case 'BracketLeft': return 'prev'
    case 'BracketRight': return 'next'
    default: return null
  }
}
/** The tape keys never fire while the operator is typing, or inside the sync editor (which has its own keys: Space taps there). */
export function tapeKeysIgnored(target: EventTarget | null): boolean {
  const n = target as HTMLElement | null
  if (!n || !n.closest) return false
  return !!n.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], .tse')
}
