/**
 * updateCheck.ts — check for a newer BORN, download it, and hand off to install.
 *
 * The app isn't code-signed, so a fully silent Squirrel-style update isn't
 * possible. Instead the app does the slow part itself — checking, and
 * downloading the right installer with a progress bar — then opens it:
 *   • macOS  — mounts the .dmg (Finder shows it: drag onto Applications)
 *   • Windows — runs the installer, which updates in place
 *   • Linux  — reveals the new AppImage
 */
import { app, net, shell, type BrowserWindow } from 'electron'
import { createWriteStream } from 'fs'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { log } from './logger'

const REPO = 'joshmuepu/born-app'
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`

export interface UpdateInfo {
  current: string
  latest: string | null
  hasUpdate: boolean
  url: string
  notes?: string
  /** Filename of the installer for this platform, when an update is available. */
  asset?: string
}

let cached: UpdateInfo | null = null

/** Compare "1.2.3" style versions. >0 when a is newer than b. */
export function cmpVersion(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  }
  return 0
}

/** The installer filename for this platform + architecture. */
function assetName(version: string): string | undefined {
  const v = version.replace(/^v/, '')
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? `BORN-${v}-macOS-arm64.dmg` : `BORN-${v}-macOS-x64.dmg`
  }
  if (process.platform === 'win32') return `BORN-${v}-Windows-Setup.exe`
  if (process.platform === 'linux') return `BORN-${v}-Linux-x86_64.AppImage`
  return undefined
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const current = app.getVersion()
  const info: UpdateInfo = { current, latest: null, hasUpdate: false, url: RELEASES_PAGE }
  try {
    const res = await net.fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `BORN/${current}` }
    })
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    const json = (await res.json()) as { tag_name?: string; html_url?: string; body?: string }
    const tag = (json.tag_name ?? '').trim()
    if (tag) {
      info.latest = tag.replace(/^v/, '')
      info.hasUpdate = cmpVersion(info.latest, current) > 0
      if (json.html_url) info.url = json.html_url
      if (json.body) info.notes = json.body
      if (info.hasUpdate) info.asset = assetName(info.latest)
    }
    log.info(`update check: current=${current} latest=${info.latest} hasUpdate=${info.hasUpdate}`)
  } catch (e) {
    log.warn('update check failed', e)
  }
  cached = info
  return info
}

export function getCachedUpdate(): UpdateInfo | null {
  return cached
}

export async function openReleasePage(): Promise<void> {
  const url = cached?.url ?? RELEASES_PAGE
  try {
    await shell.openExternal(url)
  } catch (e) {
    log.error('openExternal failed', e)
  }
}

export interface DownloadResult {
  ok: boolean
  path?: string
  error?: string
}

let downloading = false

/**
 * Download the installer for the latest release into the temp folder, streaming
 * progress to the window. Resolves with the file path.
 */
export async function downloadUpdate(win: BrowserWindow | null): Promise<DownloadResult> {
  if (downloading) return { ok: false, error: 'A download is already in progress.' }
  const info = cached
  const asset = info?.asset
  if (!info?.latest || !asset) return { ok: false, error: 'No update available for this platform.' }

  const url = `https://github.com/${REPO}/releases/download/v${info.latest}/${asset}`
  const dest = join(app.getPath('temp'), asset)
  downloading = true
  log.info(`downloading update: ${url}`)
  try {
    const res = await net.fetch(url)
    if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`)
    const total = Number(res.headers.get('content-length')) || 0
    let received = 0
    const file = createWriteStream(dest)
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      file.write(Buffer.from(value))
      received += value.length
      if (win && !win.isDestroyed()) {
        win.webContents.send('app:download-progress', { received, total })
      }
    }
    await new Promise<void>((resolve, reject) => file.end((err?: Error | null) => (err ? reject(err) : resolve())))
    log.info(`update downloaded: ${dest} (${received} bytes)`)
    return { ok: true, path: dest }
  } catch (e) {
    log.error('downloadUpdate failed', e)
    await unlink(dest).catch(() => {})
    return { ok: false, error: e instanceof Error ? e.message : 'Download failed.' }
  } finally {
    downloading = false
  }
}

/**
 * Hand the downloaded installer to the OS. The caller then quits BORN so the
 * install can complete.
 */
export async function runInstaller(path: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (process.platform === 'linux') {
      shell.showItemInFolder(path)
    } else {
      const err = await shell.openPath(path) // '' on success
      if (err) return { ok: false, error: err }
    }
    return { ok: true }
  } catch (e) {
    log.error('runInstaller failed', e)
    return { ok: false, error: e instanceof Error ? e.message : 'Could not open the installer.' }
  }
}
