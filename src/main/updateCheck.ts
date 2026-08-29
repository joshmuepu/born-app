/**
 * updateCheck.ts — is a newer BORN build published?
 *
 * The app isn't code-signed, so Squirrel-style auto-update isn't an option.
 * Instead we just ask the GitHub Releases API for the latest tag and, if it's
 * newer than this build, point the operator at the download page.
 */
import { app, net, shell } from 'electron'
import { log } from './logger'

const RELEASES_API = 'https://api.github.com/repos/joshmuepu/born-app/releases/latest'
const RELEASES_PAGE = 'https://github.com/joshmuepu/born-app/releases/latest'

export interface UpdateInfo {
  current: string
  latest: string | null
  hasUpdate: boolean
  /** Release page to open for the download. */
  url: string
  notes?: string
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

export function openReleasePage(): void {
  shell.openExternal(cached?.url ?? RELEASES_PAGE)
}
