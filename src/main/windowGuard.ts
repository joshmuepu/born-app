/**
 * windowGuard.ts — what any page in the app may open, where it may go, and which browser permissions it gets.
 *
 *  - No page opens a new window by itself (window.open, a link with a target): refused and logged.
 *  - A page of the app (the operator window, the congregation screen, the stage monitor) never navigates away from the app's own pages: a file
 *    dropped on a windowed output or a script setting location is refused, so an output can never be replaced by something else that keeps the
 *    app's bridge.
 *  - Of the browser permissions, only the ones the app uses are given (writing to the clipboard, full screen).
 * The Hymnary reader window loads outside pages on purpose; it is not one of the app's pages and keeps its own rules (hymnary.ts).
 */
import { pathToFileURL } from 'url'
import { join } from 'path'

export interface GuardTarget {
  getURL(): string
  setWindowOpenHandler(fn: (d: { url: string }) => { action: 'deny' }): void
  on(event: 'will-navigate' | 'will-redirect', fn: (e: { preventDefault(): void }, url: string) => void): unknown
}

/** The app's own pages: the built renderer's .html files, or the development server. */
export function appPageTest(rendererDir: string, devUrl?: string): (url: string) => boolean {
  const base = pathToFileURL(join(rendererDir, '/')).href
  const dev = devUrl ? (() => { try { return new URL(devUrl).origin } catch { return null } })() : null
  return (url: string): boolean => {
    if (!url) return false
    try {
      const u = new URL(url)
      if (dev && u.origin === dev) return true
      return u.protocol === 'file:' && u.href.startsWith(base) && /\.html$/.test(u.pathname)
    } catch {
      return false
    }
  }
}

export function guardWebContents(wc: GuardTarget, isAppPage: (url: string) => boolean, warn: (m: string) => void = () => {}): void {
  wc.setWindowOpenHandler(({ url }) => {
    warn(`a page asked to open a new window; refused: ${String(url).slice(0, 160)}`)
    return { action: 'deny' }
  })
  const stay = (e: { preventDefault(): void }, url: string): void => {
    if (!isAppPage(wc.getURL()) || isAppPage(url)) return
    e.preventDefault()
    warn(`a page of the app tried to go to another address; refused: ${String(url).slice(0, 160)}`)
  }
  wc.on('will-navigate', stay)
  wc.on('will-redirect', stay)
}

/** The browser permissions the app uses. Everything else (location, notifications, camera, microphone, MIDI, USB …) is refused. */
export const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'clipboard-read', 'fullscreen'])

/** Only web and mail links are handed to the operating system (a link in the manual could otherwise open a file: or smb: address, or any
 *  program registered for a custom scheme). */
export function isSafeExternalUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:'
  } catch {
    return false
  }
}
