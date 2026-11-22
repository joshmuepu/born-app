/** The operator window's View menu zoom (Zoom In, Zoom Out, Actual Size; Ctrl/Cmd + = - 0) is kept from breaking the layout. The layout is made for
 *  a window of at least 1040x640 at 100%; zoomed in on a small window, the header's buttons ran off the right edge from about 158%. The zoom the
 *  operator chose is remembered, and the window shows the largest zoom up to it that still gives the layout 1040x640, never less than 100%. When
 *  that is less than the chosen zoom, the window says so; a larger window shows the chosen zoom again. Zooming out below 100% is left as it is. */
import { BrowserWindow, Menu, MenuItem, ipcMain, screen, WebContents } from 'electron'

/** Chromium's zoom: factor = 1.2 ^ level, from 25% to 500% */
const STEP = 1.2
const MIN_LEVEL = Math.log(0.25) / Math.log(STEP)
const MAX_LEVEL = Math.log(5) / Math.log(STEP)
export const LAYOUT_MIN = { width: 1040, height: 640 }
const EPS = 1e-3

export const levelToFactor = (level: number): number => STEP ** level
export const factorToLevel = (factor: number): number => Math.log(factor) / Math.log(STEP)

/** The largest zoom factor at which a window of this content size (in screen points) still gives the layout its 1040x640; never under 1. */
export function largestFittingFactor(content: { width: number; height: number }): number {
  return Math.max(1, Math.min(content.width / LAYOUT_MIN.width, content.height / LAYOUT_MIN.height))
}

/** The zoom level to show for the chosen one, and whether it had to be reduced to fit. */
export function fitZoom(chosenLevel: number, content: { width: number; height: number }): { level: number; reduced: boolean } {
  if (chosenLevel <= EPS) return { level: chosenLevel, reduced: false }
  const limit = largestFittingFactor(content)
  const chosen = levelToFactor(chosenLevel)
  if (chosen <= limit + EPS) return { level: chosenLevel, reduced: false }
  return { level: factorToLevel(limit), reduced: true }
}

/** The chosen level after the window's zoom was found at `current` while `applied` was the last level set: a menu step adds its change to the chosen
 *  level; Actual Size (level 0) resets it. */
export function nextChosenLevel(chosen: number, applied: number, current: number): number {
  if (Math.abs(current - applied) <= EPS) return chosen
  if (Math.abs(current) <= EPS) return 0
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, chosen + (current - applied)))
}

/** Keeps the window's zoom fitted while it is resized, moved between displays or zoomed; `notify` hears when the "reduced to fit" state changes. */
export function keepOperatorZoomFitted(win: BrowserWindow, notify: (reduced: boolean) => void): { reduced: () => boolean } {
  const wc = win.webContents
  let chosen = wc.getZoomLevel()
  let applied = chosen
  let reduced = false
  const refit = (): void => {
    if (win.isDestroyed()) return
    const current = wc.getZoomLevel()
    chosen = nextChosenLevel(chosen, applied, current)
    const [width, height] = win.getContentSize()
    const fit = fitZoom(chosen, { width, height })
    if (Math.abs(fit.level - current) > EPS) wc.setZoomLevel(fit.level)
    applied = fit.level
    if (fit.reduced !== reduced) {
      reduced = fit.reduced
      notify(reduced)
    }
  }
  win.on('resize', refit)
  win.on('moved', refit)
  const onDisplay = (): void => refit()
  screen.on('display-metrics-changed', onDisplay)
  // a zoom step changes the page's size, which the operator window reports
  const onViewport = (e: Electron.IpcMainEvent): void => {
    if (!win.isDestroyed() && e.sender === wc) refit()
  }
  ipcMain.on('operator:viewport-changed', onViewport)
  win.on('closed', () => {
    screen.removeListener('display-metrics-changed', onDisplay)
    ipcMain.removeListener('operator:viewport-changed', onViewport)
  })
  wc.on('did-finish-load', refit)
  // Actual Size while the zoom is already reduced to 100% changes nothing on the page, so it is heard from the menu item itself
  onZoomMenuItem((role, target) => {
    if (win.isDestroyed() || target !== wc) return
    if (role === 'resetzoom') chosen = 0
    refit()
  })
  return { reduced: () => reduced }
}

type ZoomRole = 'zoomin' | 'zoomout' | 'resetzoom'
const zoomListeners: ((role: ZoomRole, target: WebContents | undefined) => void)[] = []
let menuWrapped = false
/** Hears the View menu's zoom items (and their shortcuts) after they have done their usual work. */
function onZoomMenuItem(listener: (role: ZoomRole, target: WebContents | undefined) => void): void {
  zoomListeners.push(listener)
  if (menuWrapped) return
  const menu = Menu.getApplicationMenu()
  if (!menu) return
  menuWrapped = true
  const walk = (items: MenuItem[]): void => {
    for (const item of items) {
      const role = (item.role || '').toLowerCase()
      if (role === 'zoomin' || role === 'zoomout' || role === 'resetzoom') {
        const click = item.click as (...args: unknown[]) => void
        item.click = (...args: unknown[]): void => {
          click.apply(item, args)
          const target = (args[2] as WebContents | undefined) ?? (args[1] as BrowserWindow | undefined)?.webContents
          for (const l of zoomListeners) l(role, target)
        }
      }
      if (item.submenu) walk(item.submenu.items)
    }
  }
  walk(menu.items)
}
