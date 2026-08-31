/**
 * updateCheck.ts — check for a newer BORN, download it, and install it.
 *
 * The app isn't code-signed, so there's no notarized Squirrel channel. Instead
 * the app downloads the right installer itself (progress bar) and applies it:
 *   • macOS  — a detached helper waits for BORN to quit, swaps the .app bundle
 *              in place, and relaunches. Falls back to mounting the .dmg if the
 *              install folder isn't writable.
 *   • Windows — runs the NSIS installer silently (/S); it closes BORN, replaces
 *               it, and relaunches.
 */
import { app, net, shell, type BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { createWriteStream, writeFileSync, accessSync, constants } from 'fs'
import { unlink } from 'fs/promises'
import { join, dirname, resolve } from 'path'
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
 * Fallback: just hand the downloaded installer to the OS (mount the dmg / run
 * the installer with its UI). The user finishes it by hand.
 */
export async function runInstaller(path: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const err = await shell.openPath(path) // '' on success
    if (err) return { ok: false, error: err }
    return { ok: true }
  } catch (e) {
    log.error('runInstaller failed', e)
    return { ok: false, error: e instanceof Error ? e.message : 'Could not open the installer.' }
  }
}

export interface ApplyResult {
  /** true = the update is armed; the caller must now quit so it can finish. */
  ok: boolean
  /** true = automatic install isn't possible here; fall back to runInstaller(). */
  needsManual?: boolean
  error?: string
}

function canWrite(dir: string): boolean {
  try {
    accessSync(dir, constants.W_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Bash helper (macOS): wait for BORN to exit, put the new build in
 * place, relaunch. `set -e` so a failure aborts before the old copy is removed.
 */
function writeSwapScript(body: string): string {
  const script = join(app.getPath('temp'), `born-update-${Date.now()}.sh`)
  const swaplog = join(app.getPath('temp'), 'born-update.log')
  writeFileSync(
    script,
    `#!/bin/bash
set -e
exec >>"${swaplog}" 2>&1
echo "--- born update $(date) ---"
BORN_PID="$1"
# Wait (up to ~5 min) for BORN to quit. If it never does, do nothing.
for _ in $(seq 1 600); do
  kill -0 "$BORN_PID" 2>/dev/null || { QUIT=1; break; }
  sleep 0.5
done
[ "$QUIT" = 1 ] || { echo "BORN never quit — aborting"; rm -f "$0"; exit 0; }
sleep 1
${body}
echo "update complete"
rm -f "$0"
`,
    { mode: 0o755 }
  )
  return script
}

function spawnDetached(cmd: string, args: string[]): void {
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
}

/**
 * Apply a downloaded installer with no further clicks. Returns { ok:true } when
 * the update is armed (caller then quits BORN), or { needsManual:true } when it
 * has to fall back to the drag / click-through flow.
 */
export async function applyUpdate(installerPath: string): Promise<ApplyResult> {
  if (!app.isPackaged) return { ok: false, needsManual: true } // never swap a dev build
  try {
    if (process.platform === 'win32') {
      // NSIS silent install: closes BORN, replaces it, relaunches.
      spawnDetached(installerPath, ['/S', '--update'])
      return { ok: true }
    }

    if (process.platform === 'darwin') {
      const bundle = resolve(app.getPath('exe'), '../../..') // …/Branham or Nothing.app
      if (!bundle.endsWith('.app') || !canWrite(dirname(bundle))) {
        return { ok: false, needsManual: true }
      }
      const script = writeSwapScript(`
DMG=${JSON.stringify(installerPath)}
BUNDLE=${JSON.stringify(bundle)}
DIR=$(dirname "$BUNDLE")
MP=$(hdiutil attach "$DMG" -nobrowse -noautoopen | tail -1 | sed 's#.*\\(/Volumes/.*\\)#\\1#')
SRC=$(ls -d "$MP"/*.app | head -1)
STAGE="$DIR/.born-update.app"
# Verify the new build before removing the old one.
[ -d "$SRC" ] && [ -x "$SRC/Contents/MacOS/"* ] || { echo "no valid app in dmg"; hdiutil detach "$MP" -quiet || true; exit 1; }
rm -rf "$STAGE"
cp -R "$SRC" "$STAGE"
xattr -dr com.apple.quarantine "$STAGE" 2>/dev/null || true
[ -x "$STAGE/Contents/MacOS/"* ] || { echo "staged copy invalid"; rm -rf "$STAGE"; hdiutil detach "$MP" -quiet || true; exit 1; }
rm -rf "$BUNDLE"
mv "$STAGE" "$BUNDLE"
hdiutil detach "$MP" -quiet || true
rm -f "$DMG"
open "$BUNDLE"
`)
      spawnDetached('/bin/bash', [script, String(process.pid)])
      return { ok: true }
    }

    return { ok: false, needsManual: true }
  } catch (e) {
    log.error('applyUpdate failed', e)
    return { ok: false, error: e instanceof Error ? e.message : 'Install failed.' }
  }
}
