/**
 * settings.ts — tiny JSON settings store in <userData>/settings.json.
 * Used for operator preferences that must survive a restart (projection
 * display override, font size).
 */
import { app } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'
import { log } from './logger'
import { quarantineCorruptFile, writeFileAtomic } from './corruptFile'
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
  /** The adapter + address a phone last reached the remote through — the
   *  Remote panel shows this network first next time. Null until a phone
   *  has connected. */
  remoteLastPhoneNetwork: { name: string; address: string } | null
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
  recentKeys: [],
  remoteLastPhoneNetwork: null
}

let cache: AppSettings | null = null

/** Keeps each saved value only when it is the right kind; anything else gets its default. A settings.json that reads but holds the
 *  wrong kind of value (edited by hand, or written by something else) otherwise stopped the window from appearing at all. */
function wellFormed(raw: Record<string, unknown>): Partial<AppSettings> {
  const out: Record<string, unknown> = {}
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  const list = <T>(v: unknown, ok: (x: unknown) => boolean): T[] | undefined => (Array.isArray(v) ? (v.filter(ok) as T[]) : undefined)
  const str = (v: unknown): boolean => typeof v === 'string'
  const nameOrNull = (v: unknown): string | null | undefined => (v === null || typeof v === 'string' ? v : undefined)
  const put = (k: keyof AppSettings, v: unknown): void => { if (v !== undefined) out[k] = v }
  put('namedDisplays', list(raw.namedDisplays, (x) => isObj(x) && typeof x.name === 'string'))
  put('projectionDisplayName', nameOrNull(raw.projectionDisplayName))
  put('stageDisplayName', nameOrNull(raw.stageDisplayName))
  put('fontSize', typeof raw.fontSize === 'number' && raw.fontSize >= 1.5 && raw.fontSize <= 8 ? raw.fontSize : undefined)
  put('recentServices', list(raw.recentServices, str))
  put('theme', raw.theme === 'dark' || raw.theme === 'light' ? raw.theme : undefined)
  put('recentSongIds', list(raw.recentSongIds, (x) => typeof x === 'number'))
  put('recentQuotes', list(raw.recentQuotes, (x) => isObj(x) && typeof x.sermonId === 'number' && typeof x.text === 'string'))
  put('recentBibleRefs', list(raw.recentBibleRefs, (x) => isObj(x) && typeof x.reference === 'string'))
  put('recentKeys', list(raw.recentKeys, str))
  const net = raw.remoteLastPhoneNetwork
  put('remoteLastPhoneNetwork', net === null || (isObj(net) && typeof net.name === 'string' && typeof net.address === 'string') ? net : undefined)
  return out as Partial<AppSettings>
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  if (cache) return cache
  try {
    const parsed: unknown = JSON.parse(readFileSync(settingsPath(), 'utf-8'))
    const raw = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
    // The legacy default was 3.0 but the Text control still read "100%" — realign
    // an untouched value to the new, honest 100% (4.5).
    const needsFontSizeRealign = raw.fontSize === 3
    if (needsFontSizeRealign) raw.fontSize = 4.5
    // keys this version does not know (a later version's) are kept as they are, so they survive the next save
    const unknown = Object.fromEntries(Object.entries(raw).filter(([k]) => !(k in DEFAULTS)))
    cache = { ...DEFAULTS, ...unknown, ...wellFormed(raw) }
    // Without this, the correction above only ever lived in memory — every
    // future launch kept re-deriving it from an unchanged 3.0 on disk, and
    // anything that reads settings.json directly (support, a future
    // migration) would see the stale, pre-fix value even though the app
    // itself has shown the correct 100% the whole time.
    if (needsFontSizeRealign) {
      try {
        writeFileAtomic(settingsPath(), JSON.stringify(cache, null, 2))
      } catch (e) {
        log.error('settings write failed (fontSize realign)', e)
      }
    }
  } catch {
    // Missing file = first launch (nothing to keep). A file that exists but won't parse is moved aside before the
    // next save writes a fresh one over it.
    quarantineCorruptFile(settingsPath())
    cache = { ...DEFAULTS }
  }
  return cache
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch }
  cache = next
  try {
    writeFileAtomic(settingsPath(), JSON.stringify(next, null, 2))
  } catch (e) {
    log.error('settings write failed', e)
  }
  return next
}
