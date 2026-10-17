/** Esc closes whatever is open on top (the manual, the Remote or Screens popover, a dialog) — it must not ALSO blank the congregation screens.
 *  Shift+Esc stays the panic key and always blanks.
 *
 *  The popovers close themselves from their own key listeners, and React has already removed them from the page by the time the app-wide Esc
 *  handler runs (listener order is not fixed either). So whether something was open is recorded in the capture phase, before any of them run. */
const OVERLAY = '[role="dialog"], .screens-popover, .remote-popover, .modal'
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
