import { createContext, useContext } from 'react'
import type { QueueDragPayload } from './dragItem'

/** Things the browse panels can ask the app to do from a context menu without
 *  every panel growing another prop for each one. Defaults are no-ops so a
 *  panel rendered on its own (tests, a channel window) just does nothing. */
export interface AppActions {
  /** Insert right after the item that is live (or at the top when nothing is). */
  addNext: (payload: QueueDragPayload) => void
  openSermon: (sermonId: number, anchorRef: string) => void
  openVerse: (v: { bookNum: number; chapter: number; verse: number }) => void
  openSong: (songId: number) => void
  /** Short confirmation, e.g. "Copied John 3:16". */
  notify: (message: string) => void
}

const noop = (): void => {}
export const AppActionsContext = createContext<AppActions>({
  addNext: noop,
  openSermon: noop,
  openVerse: noop,
  openSong: noop,
  notify: noop
})

export const useAppActions = (): AppActions => useContext(AppActionsContext)

/** Copy text to the clipboard, falling back quietly when the API is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // the clipboard API refuses when the window is not focused: the old copy command still works from a hidden field
    try {
      const t = document.createElement('textarea')
      t.value = text
      t.setAttribute('readonly', '')
      t.style.cssText = 'position:fixed;top:-100px;opacity:0'
      document.body.appendChild(t)
      t.select()
      const ok = document.execCommand('copy')
      t.remove()
      return ok
    } catch {
      return false
    }
  }
}
