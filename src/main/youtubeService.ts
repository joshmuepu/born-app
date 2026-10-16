/**
 * youtubeService.ts — the YouTube pieces that need Electron: the local player host, the hidden check windows, Test play,
 * the title lookup and the recent-links list. The rules live in shared/youtube.ts and youtubeProbe.ts (both tested without Electron).
 */
import { BrowserWindow, ipcMain, net, session } from 'electron'
import { log } from './logger'
import { getSettings, updateSettings } from './settings'
import { YouTubeHost } from './youtubeHost'
import { lookupYouTube } from './youtubeLookup'
import { preflightYouTube, testPlay, type PreflightRequest, type ProbeDeps } from './youtubeProbe'
import { isVideoId } from '../shared/youtube'

export const youtubeHost = new YouTubeHost()

/** Identifies BORN to YouTube when the player asks "who is this?" — see applyYouTubeIdentity(). */
export const YT_APP_REFERER = 'https://com.joshmuepu.born.v2dev/'

let identityApplied = false
/**
 * YouTube asks every app that embeds its player to say who it is with the HTTP Referer (error 153 otherwise). The player page is
 * served from http://127.0.0.1, whose Referer is accepted only if YouTube likes it; this fallback makes the embed request carry the
 * app's own identifier instead. It is OFF unless the check shows it is needed (settings `youtubeForceReferer`, set by the
 * BORN_YT_REFERER=1 environment variable while testing) — it changes only the Referer header of the embed request.
 */
export function applyYouTubeIdentity(force: boolean): void {
  if (identityApplied || !force) return
  identityApplied = true
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://www.youtube.com/embed/*', 'https://www.youtube-nocookie.com/embed/*'] }, (details, cb) => {
    cb({ requestHeaders: { ...details.requestHeaders, Referer: YT_APP_REFERER } })
  })
}

function openWindow(url: string, visible: boolean): { close(): void } {
  const win = new BrowserWindow({
    show: visible,
    width: visible ? 640 : 480,
    height: visible ? 400 : 270,
    title: visible ? 'Test play (muted) — BORN' : 'YouTube check',
    backgroundColor: '#000000',
    skipTaskbar: !visible,
    webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }
  })
  void win.loadURL(url).catch((e) => log.warn(`youtube window load failed: ${String(e)}`))
  return { close: () => { if (!win.isDestroyed()) win.destroy() } }
}

async function reachable(url: string, ms = 5000): Promise<boolean> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await net.fetch(url, { method: 'HEAD', signal: ctl.signal })
    return r.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

export function probeDeps(): ProbeDeps {
  return {
    host: youtubeHost,
    openHidden: (url) => openWindow(url, false),
    openVisible: (url) => openWindow(url, true),
    // the player script is what every YouTube item needs; if it cannot be reached, nothing will play
    checkInternet: () => reachable('https://www.youtube.com/iframe_api')
  }
}

export function registerYouTubeIpc(): void {
  applyYouTubeIdentity(process.env['BORN_YT_REFERER'] === '1')

  ipcMain.handle('youtube:host-url', async (_e, videoId: string, start?: number) => {
    if (!isVideoId(videoId)) return null
    await youtubeHost.start()
    return youtubeHost.urlFor(videoId, { sid: youtubeHost.newSession(), mode: 'live', start: typeof start === 'number' && start > 0 ? start : undefined })
  })

  ipcMain.handle('youtube:lookup', (_e, videoId: string) => lookupYouTube(String(videoId), (u, init) => net.fetch(u, init)))

  ipcMain.handle('youtube:preflight', (_e, items: PreflightRequest[]) => {
    const list = (Array.isArray(items) ? items : []).filter((i) => i && isVideoId(i.videoId)).map((i) => ({ videoId: i.videoId, hasFallback: !!i.hasFallback }))
    return preflightYouTube(probeDeps(), list)
  })

  ipcMain.handle('youtube:test-play', (_e, videoId: string) => (isVideoId(videoId) ? testPlay(probeDeps(), videoId) : null))

  ipcMain.handle('youtube:recents-get', () => getSettings().youtubeRecents ?? [])
  ipcMain.handle('youtube:recents-add', (_e, r: { videoId: string; title?: string; label?: string }) => {
    if (!r || !isVideoId(r.videoId)) return getSettings().youtubeRecents ?? []
    const rest = (getSettings().youtubeRecents ?? []).filter((x) => x.videoId !== r.videoId)
    const next = [{ videoId: r.videoId, title: String(r.title ?? '').slice(0, 200), ...(r.label ? { label: String(r.label).slice(0, 120) } : {}), at: Date.now() }, ...rest].slice(0, 30)
    updateSettings({ youtubeRecents: next })
    return next
  })
  ipcMain.handle('youtube:recents-remove', (_e, videoId: string) => {
    const next = (getSettings().youtubeRecents ?? []).filter((x) => x.videoId !== videoId)
    updateSettings({ youtubeRecents: next })
    return next
  })
}
