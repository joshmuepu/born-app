import { useEffect, useRef } from 'react'

/** Esc closes whatever is open on top (the manual, the Remote or Screens popover, a dialog, a menu) — it must not ALSO blank the congregation screens.
 *  Shift+Esc stays the panic key and always blanks.
 *
 *  The popovers close themselves from their own key listeners, and React has already removed them from the page by the time the app-wide Esc
 *  handler runs (listener order is not fixed either). So whether something was open is recorded in the capture phase, before any of them run. */
const OVERLAY = '[role="dialog"], [role="menu"], .screens-popover, .remote-popover, .song-key-popover, .filter-popover, .bible-scope-popover, .status-popover, .modal'
export function overlayIsOpen(root: ParentNode = document): boolean {
  return !!root.querySelector(OVERLAY)
}

let openAtKeydown = false
/** Start recording (call once; returns the stop function). */
export function trackEscOverlay(target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window, root: ParentNode = document): () => void {
  const h = (e: Event): void => { if ((e as KeyboardEvent).key === 'Escape') openAtKeydown = overlayIsOpen(root) }
  target.addEventListener('keydown', h, true)
  return () => target.removeEventListener('keydown', h, true)
}
/** Should this Esc blank the screens? `open` defaults to what was recorded when the key went down. */
export function escBlanksScreens(e: { key: string; shiftKey: boolean }, open: boolean = openAtKeydown): boolean {
  if (e.key !== 'Escape') return false
  return e.shiftKey || !open
}

/** The last element that had the keyboard outside any dialog or popover (a dialog that focuses its own field at once must not be taken for it). */
let lastOutside: HTMLElement | null = null
let tracking = false
function trackFocus(): void {
  if (tracking || typeof document === 'undefined') return
  tracking = true
  document.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement | null
    if (t && t !== document.body && typeof t.closest === 'function' && !t.closest(OVERLAY)) lastOutside = t
  }, true)
}
trackFocus()

/** While `open`, remember what had the keyboard before it opened, and give it back when it closes (if it is still on the page): a dialog that closed left
 *  the focus on the page itself, so the next key went to the live slide instead of where the operator was. */
export function useReturnFocus(open: boolean): void {
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    const a = document.activeElement as HTMLElement | null
    opener.current = a && a !== document.body && !(typeof a.closest === 'function' && a.closest(OVERLAY)) ? a : lastOutside
    return () => {
      const el = opener.current
      opener.current = null
      if (el && el !== document.body && document.contains(el)) setTimeout(() => { try { el.focus() } catch { /* gone */ } }, 0)
    }
  }, [open])
}
