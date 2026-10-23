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
import { once } from 'events'
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
  /** Size the RELEASE itself reports for that installer. The download is checked
   *  against this, not only against the content-length the connection claims, so a
   *  proxy or a reset that truncates the file can't pass itself off as the whole thing. */
  assetSize?: number
  /** The URL the release gives for that installer (instead of one built from the
   *  version and a naming convention, which would 404 silently if either changed). */
  assetUrl?: string
  /** The check itself failed (offline, GitHub unreachable, etc.) — distinct
   *  from a successful check that just found no update, so the UI can say
   *  "couldn't check" instead of falsely claiming the app is up to date. */
  checkFailed?: boolean
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

/** A release from a different major version is a different product line
 *  (v1 "released" vs. v2 "unreleased, rebranding in 2027"), not an update —
 *  GitHub's /releases/latest returns whichever release is newest *by publish
 *  date*, not by semver, so this stays correct even if a v2 preview build
 *  ever gets manually published to this same repo ahead of a v1 release, or
 *  vice versa. Without this, cmpVersion() alone would happily call a
 *  different major version "newer" and offer it as an upgrade. */
export function sameMajor(a: string, b: string): boolean {
  const majorOf = (v: string): number => parseInt(v.replace(/^v/, '').split('.')[0], 10) || 0
  return majorOf(a) === majorOf(b)
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
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `BORN/${current}` },
      // A dead connection fails fast on its own (a real error, caught
      // below) — this guards the other case, a connection that's merely
      // slow or stalled (a flaky church WiFi, a captive portal that never
      // completes the response), which would otherwise leave the operator
      // looking at "Checking…" with no way to know it's stuck versus still
      // genuinely working.
      signal: AbortSignal.timeout(15000)
    })
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    const json = (await res.json()) as {
      tag_name?: string
      html_url?: string
      body?: string
      assets?: Array<{ name?: string; size?: number; browser_download_url?: string }>
    }
    const tag = (json.tag_name ?? '').trim()
    if (tag) {
      info.latest = tag.replace(/^v/, '')
      info.hasUpdate = sameMajor(info.latest, current) && cmpVersion(info.latest, current) > 0
      if (json.html_url) info.url = json.html_url
      if (json.body) info.notes = json.body
      if (info.hasUpdate) {
        info.asset = assetName(info.latest)
        const match = (json.assets ?? []).find((a) => a.name === info.asset)
        if (match?.size) info.assetSize = match.size
        if (match?.browser_download_url) info.assetUrl = match.browser_download_url
      }
    }
    log.info(`update check: current=${current} latest=${info.latest} hasUpdate=${info.hasUpdate}`)
  } catch (e) {
    log.warn('update check failed', e)
    info.checkFailed = true
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

/** How long the connection may send nothing at all before we treat it as dead.
 *  Not a limit on the whole download: a 175 MB installer on a slow church line
 *  legitimately takes many minutes, so only *silence* counts against it. */
const STALL_MS = 60_000
/** A reset connection is usually a one-off (TLS-inspecting antivirus, a proxy,
 *  tired WiFi), so one failure is not the answer — but neither is trying forever. */
const RETRIES = 3
const BACKOFF_MS = 2000

/** Test seam only: the production callers pass nothing. */
export interface DownloadOptions {
  stallMs?: number
  retries?: number
  backoffMs?: number
}

/** One attempt. Throws on anything that means "do not run this file". */
async function fetchInstaller(
  url: string,
  dest: string,
  expected: number | undefined,
  win: BrowserWindow | null,
  stallMs: number
): Promise<number> {
  const controller = new AbortController()
  const res = await net.fetch(url, {
    // The check already names itself this way. The download said nothing at all,
    // so the two halves of one update looked like two different programs to
    // anything inspecting the traffic; now they match and can be allow-listed together.
    headers: { Accept: 'application/octet-stream', 'User-Agent': `BORN/${app.getVersion()}` },
    signal: controller.signal
  })
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`)
  const claimed = Number(res.headers.get('content-length')) || 0
  const total = expected || claimed
  let received = 0
  const file = createWriteStream(dest)
  const reader = res.body.getReader()
  try {
    for (;;) {
      // A connection that is merely slow keeps arriving; one that has died mid-file
      // just goes quiet, and without this the app waited on it for ever — the
      // operator watching "Downloading… 37%" had no way to tell the two apart.
      let timer: NodeJS.Timeout | undefined
      const wentQuiet = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error('the connection stopped sending data'))
        }, stallMs)
      })
      let chunk: { done: boolean; value?: Uint8Array }
      try {
        chunk = await Promise.race([reader.read(), wentQuiet])
      } finally {
        clearTimeout(timer)
      }
      if (chunk.done || !chunk.value) break
      received += chunk.value.length
      // Wait for the disk when it falls behind, instead of holding the whole
      // installer in memory on the way past.
      if (!file.write(Buffer.from(chunk.value))) await once(file, 'drain')
      if (win && !win.isDestroyed()) win.webContents.send('app:download-progress', { received, total })
    }
    await new Promise<void>((ok, bad) => file.end((err?: Error | null) => (err ? bad(err) : ok())))
  } catch (e) {
    file.destroy()
    throw e
  }
  // The one check that matters: an installer that arrived only in part must never
  // reach applyUpdate(), which on Windows runs it silently with /S.
  if (total && received !== total) {
    throw new Error(`the download stopped early (${received} of ${total} bytes)`)
  }
  if (!received) throw new Error('the download was empty')
  return received
}

/**
 * Download the installer for the latest release into the temp folder, streaming
 * progress to the window. Resolves with the file path.
 *
 * Only a whole, verified file is ever returned. When the network will not give us
 * one — the church connection this was reported on resets the transfer partway —
 * the release page is opened in the operator's own browser, which does manage it.
 */
export async function downloadUpdate(
  win: BrowserWindow | null,
  opts: DownloadOptions = {}
): Promise<DownloadResult> {
  if (downloading) return { ok: false, error: 'A download is already in progress.' }
  const info = cached
  const asset = info?.asset
  if (!info?.latest || !asset) return { ok: false, error: 'No update available for this platform.' }

  const url = info.assetUrl ?? `https://github.com/${REPO}/releases/download/v${info.latest}/${asset}`
  const dest = join(app.getPath('temp'), asset)
  const stallMs = opts.stallMs ?? STALL_MS
  const retries = opts.retries ?? RETRIES
  const backoffMs = opts.backoffMs ?? BACKOFF_MS
  downloading = true
  log.info(`downloading update: ${url}`)
  try {
    let last: unknown
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const received = await fetchInstaller(url, dest, info.assetSize, win, stallMs)
        log.info(`update downloaded: ${dest} (${received} bytes, attempt ${attempt})`)
        return { ok: true, path: dest }
      } catch (e) {
        last = e
        log.warn(`update download attempt ${attempt} of ${retries} failed`, e)
        await unlink(dest).catch(() => {})
        if (attempt < retries && backoffMs) await new Promise((r) => setTimeout(r, backoffMs * attempt))
      }
    }
    log.error('downloadUpdate failed', last)
    const why = last instanceof Error ? last.message : 'the connection failed'
    try {
      await shell.openExternal(info.url)
    } catch (e) {
      log.error('openExternal after a failed download failed', e)
      return { ok: false, error: `${why}. Get it from the download page instead.` }
    }
    return { ok: false, error: `${why}. The download page is open in your browser — get it from there.` }
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
 * Batch helper (Windows): run the silent installer, then explicitly relaunch
 * BORN — the silent installer's own "run after finish" only fires from its
 * finish-page UI, which /S skips entirely, so without this the app installs
 * correctly but never comes back up on its own.
 */
export function windowsUpdateScriptFor(installerPath: string, exePath: string, swaplog = 'born-update.log'): string {
  return (
    `@echo off\r\n` +
    `echo --- born update %date% %time% --- >> "${swaplog}"\r\n` +
    `"${installerPath}" /S >> "${swaplog}" 2>&1\r\n` +
    `start "" "${exePath}"\r\n` +
    `del "${installerPath}" >nul 2>&1\r\n` +
    `del "%~f0"\r\n`
  )
}

function writeWindowsUpdateScript(installerPath: string, exePath: string): string {
  const script = join(app.getPath('temp'), `born-update-${Date.now()}.bat`)
  writeFileSync(script, windowsUpdateScriptFor(installerPath, exePath, join(app.getPath('temp'), 'born-update.log')))
  return script
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
      // NSIS silent install closes BORN and replaces it, but /S skips the
      // finish page entirely — the "run after finish" checkbox that would
      // normally relaunch the app never fires, so this script does it
      // explicitly once the installer itself has finished.
      const exePath = app.getPath('exe')
      const script = writeWindowsUpdateScript(installerPath, exePath)
      spawnDetached('cmd.exe', ['/c', script])
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
