/**
 * manual.ts — reads the in-repo user manual (docs/manual/<version>/) so the
 * renderer's Help viewer can render it fully offline, the same way db.ts and
 * browseLocal.ts read their own bundled files: a list of candidate base
 * directories tried in order, covering both a packaged build (shipped via
 * electron-builder's `extraResources`) and every way `npm run dev` can be
 * launched.
 */
import { app } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join, normalize } from 'path'

export interface ManualPage {
  id: string
  title: string
  file: string
}

export interface ManualSection {
  id: string
  title: string
  pages: ManualPage[]
}

export interface ManualManifest {
  version: string
  sections: ManualSection[]
}

const MANUAL_VERSION = 'v2'

let baseDirCache: string | null | undefined

/** The directory containing manifest.json and this version's .md/images —
 *  e.g. .../manual/v2 in a packaged build, .../docs/manual/v2 in dev. */
function manualBaseDir(): string | null {
  if (baseDirCache !== undefined) return baseDirCache
  const candidates = [
    join(process.resourcesPath ?? '', 'manual', MANUAL_VERSION),
    join(app.getAppPath(), 'docs', 'manual', MANUAL_VERSION),
    join(app.getAppPath(), '..', 'docs', 'manual', MANUAL_VERSION),
    // Unpackaged dev, same reasoning as browseLocal.ts's locations.json
    // candidates: app.getAppPath() can resolve two levels below the project
    // root depending on how `npm run dev` was launched.
    join(app.getAppPath(), '..', '..', 'docs', 'manual', MANUAL_VERSION)
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'manifest.json'))) {
      baseDirCache = dir
      return dir
    }
  }
  baseDirCache = null
  return null
}

/** Resolves a relative path against the manual's base dir and refuses
 *  anything that would escape it (defence against a malformed/crafted
 *  relative path reaching outside the manual folder). */
function resolveInsideManual(relPath: string): string | null {
  const base = manualBaseDir()
  if (!base) return null
  const resolved = normalize(join(base, relPath))
  if (!resolved.startsWith(normalize(base))) return null
  return resolved
}

export function getManualManifest(): ManualManifest | null {
  const base = manualBaseDir()
  if (!base) return null
  try {
    return JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8')) as ManualManifest
  } catch {
    return null
  }
}

export function readManualPage(relPath: string): string | null {
  const resolved = resolveInsideManual(relPath)
  if (!resolved) return null
  try {
    return readFileSync(resolved, 'utf8')
  } catch {
    return null
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

/** Returns a data: URL so the renderer never needs direct filesystem or
 *  file:// access — same arm's-length IPC shape as every other main↔renderer
 *  data path in this app. */
export function readManualImage(relPath: string): string | null {
  const resolved = resolveInsideManual(relPath)
  if (!resolved) return null
  const ext = resolved.slice(resolved.lastIndexOf('.')).toLowerCase()
  const mime = MIME_BY_EXT[ext]
  if (!mime) return null
  try {
    const data = readFileSync(resolved)
    return `data:${mime};base64,${data.toString('base64')}`
  } catch {
    return null
  }
}
