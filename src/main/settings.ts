/**
 * settings.ts — tiny JSON settings store in <userData>/settings.json.
 * Used for operator preferences that must survive a restart (projection
 * display override, font size).
 */
import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { log } from './logger'

export interface AppSettings {
  /** Electron display id the operator forced the projection onto, if any. */
  projectionDisplayId: number | null
  /** Electron display id the operator forced the stage monitor onto, if any. */
  stageDisplayId: number | null
  /** Projection text size in rem. */
  fontSize: number
  /** Absolute paths of recently saved / opened service files, newest first. */
  recentServices: string[]
}

const DEFAULTS: AppSettings = {
  projectionDisplayId: null,
  stageDisplayId: null,
  // Matches "100%" in the operator's Text control; the projection window scales
  // this by screen size (see ProjectionApp `baseRem`).
  fontSize: 4.5,
  recentServices: []
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
