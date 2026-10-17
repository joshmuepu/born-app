import { useCallback, useEffect, useState } from 'react'

/**
 * How a verse, a song slide or a sermon paragraph reacts (P-08):
 *   click        — SELECTS the row (nothing on the screens changes)
 *   Enter/Space  — shows it  (a keyboard user is always deliberate)
 *   double-click — shows it
 * Some people prefer how earlier versions worked, where a single click showed it: Appearance → "A single click shows". Off by default.
 * A row's own Show button always shows, whatever this is set to.
 */
const KEY = 'born.clickShows'
const EVT = 'born:click-shows'

export function readClickShows(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function setClickShows(on: boolean): void {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* a convenience: the choice just lasts until the window closes */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: on }))
}

export function useClickShows(): boolean {
  const [on, setOn] = useState(readClickShows)
  useEffect(() => {
    const h = (): void => setOn(readClickShows())
    window.addEventListener(EVT, h)
    window.addEventListener('storage', h)
    return () => { window.removeEventListener(EVT, h); window.removeEventListener('storage', h) }
  }, [])
  return on
}

/** The three handlers for a row. `show` puts it on the screens; `select` only marks it. */
export function rowGesture(o: { clickShows: boolean; show: () => void; select: () => void }): {
  onClick: (e: React.MouseEvent<HTMLElement>) => void
  onDoubleClick: (e: React.MouseEvent<HTMLElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void
} {
  return {
    onClick: (e) => {
      if (o.clickShows) { o.show(); e.currentTarget.blur() } else o.select()
    },
    onDoubleClick: (e) => {
      if (o.clickShows) return // the single click already did it
      o.show(); e.currentTarget.blur()
    },
    onKeyDown: (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); o.show(); e.currentTarget.blur() }
    }
  }
}

/** Which row of a list is selected (by key), with a way to clear it. */
export function useRowSelection<K extends string | number>(): [K | null, (k: K | null) => void] {
  const [sel, setSel] = useState<K | null>(null)
  const set = useCallback((k: K | null) => setSel(k), [])
  return [sel, set]
}
