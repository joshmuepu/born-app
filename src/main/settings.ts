/**
 * settings.ts — tiny JSON settings store in <userData>/settings.json.
 * Used for operator preferences that must survive a restart (projection
 * display override, font size).
 */
import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { log } from './logger'
import type { NamedDisplay } from './displays'

export interface AppSettings {
  /** Operator-given names for physical displays ("Sanctuary Projector"),
   *  matched back by model/resolution/internal-flag rather than Electron's
   *  raw id — see displays.ts for why the id alone isn't durable enough. */
  namedDisplays: NamedDisplay[]
  /** Name of the operator-named display forced onto the congregation screen,
   *  if any — null means automatic. */
  projectionDisplayName: string | null
  /** Same, for the stage monitor. */
  stageDisplayName: string | null
  /** Projection text size in rem. */
  fontSize: number
  /** Absolute paths of recently saved / opened service files, newest first. */
  recentServices: string[]
  /** Control-window appearance. Projection + stage are always dark. */
  theme: 'dark' | 'light'
  /** Song ids queued or projected recently, newest first — surfaces a "Recent"
   *  shortlist on the web remote's Songs tab (from any device, any session). */
  recentSongIds: number[]
  /** Sermon quotes queued or projected recently, newest first — the full
   *  paragraph (not just the sermon id) so "Recently Played" can show and
   *  re-project it instantly, on the desktop's Browse hub and the remote. */
  recentQuotes: Array<{
    sermonId: number
    sermonTitle: string
    dateCode: string
    paragraphIndex: number
    paragraphRef: string
    text: string
  }>
  /** Bible references looked up or projected recently, newest first — closes
   *  the one gap Sermon/Songs already covered: no memory of what you last
   *  opened. Surfaces on the desktop's Search empty state. */
  recentBibleRefs: Array<{ reference: string; translation: string }>
  /** Keys most recently assigned to a song, newest first — a worship team
   *  plays in a small rotating set of keys, so surfacing these at the top of
   *  the key picker turns the common case into one tap instead of a search
   *  through all 24. */
  recentKeys: string[]
}

const DEFAULTS: AppSettings = {
  namedDisplays: [],
  projectionDisplayName: null,
  stageDisplayName: null,
  // Matches "100%" in the operator's Text control; the projection window scales
  // this by screen size (see ProjectionApp `baseRem`).
  fontSize: 4.5,
  recentServices: [],
  theme: 'dark',
  recentSongIds: [],
  recentQuotes: [],
  recentBibleRefs: [],
  recentKeys: []
}

let cache: AppSettings | null = null

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  if (cache) return cache
  try {
    const raw = JSON.parse(readFileSync(settingsPath(), 'utf-8')) as Partial<AppSettings>
    // The legacy default was 3.0 but the Text control still read "100%" — realign
    // an untouched value to the new, honest 100% (4.5).
    if (raw.fontSize === 3) raw.fontSize = 4.5
    cache = { ...DEFAULTS, ...raw }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch }
  cache = next
  try {
    writeFileSync(settingsPath(), JSON.stringify(next, null, 2))
  } catch (e) {
    log.error('settings write failed', e)
  }
  return next
}
