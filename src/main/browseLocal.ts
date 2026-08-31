/**
 * browseLocal.ts — Browse groupings built from the bundled sermon database.
 *
 * The online /index/allDateGroups etc. return the group labels but not the
 * sermon lists, so every group showed "0 sermons". `sermon_index` has enough
 * (date_code, duration_min, and the city id — stored in the `para_count`
 * column) to build all of Browse locally: correct counts, works with no
 * internet. State / city *names* come from a small bundled locations.json.
 */
import type { Database } from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { log } from './logger'

export interface BrowseGroup {
  label: string
  sermonIds: number[]
}

/** "63-0825E" → 1963. Branham's ministry ran 1947–1965. */
function yearOf(dateCode: string): number | null {
  const m = /^(\d{2})/.exec(dateCode ?? '')
  if (!m) return null
  const yy = parseInt(m[1], 10)
  return yy >= 30 ? 1900 + yy : 2000 + yy
}

export function getLocalDateGroups(db: Database): BrowseGroup[] {
  const rows = db
    .prepare<[], { id: number; date_code: string }>(
      'SELECT id, date_code FROM sermon_index ORDER BY date_code, id'
    )
    .all()
  const byYear = new Map<number, number[]>()
  for (const r of rows) {
    const y = yearOf(r.date_code)
    if (y === null) continue
    const list = byYear.get(y) ?? []
    list.push(r.id)
    byYear.set(y, list)
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, ids]) => ({ label: String(year), sermonIds: ids }))
}

const DURATION_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: 'Under 30 min', min: 0, max: 29 },
  { label: '30–60 min', min: 30, max: 60 },
  { label: '1–2 hours', min: 61, max: 120 },
  { label: 'Over 2 hours', min: 121, max: Infinity }
]

export function getLocalDurationGroups(db: Database): BrowseGroup[] {
  const rows = db
    .prepare<[], { id: number; duration_min: number }>(
      'SELECT id, duration_min FROM sermon_index WHERE duration_min > 0 ORDER BY duration_min, id'
    )
    .all()
  return DURATION_BUCKETS.map((b) => ({
    label: b.label,
    sermonIds: rows.filter((r) => r.duration_min >= b.min && r.duration_min <= b.max).map((r) => r.id)
  })).filter((g) => g.sermonIds.length > 0)
}

// ── Location ──────────────────────────────────────────────────────────────────

interface LocationsFile {
  states: Array<{ id: number; name: string; cities: number[] }>
  cities: Record<string, string>
}

let locationsCache: LocationsFile | null | undefined

function loadLocations(): LocationsFile | null {
  if (locationsCache !== undefined) return locationsCache
  const candidates = [
    join(process.resourcesPath ?? '', 'locations.json'),
    join(app.getAppPath(), 'resources', 'locations.json'),
    join(app.getAppPath(), '..', 'resources', 'locations.json')
  ]
  for (const p of candidates) {
    try {
      locationsCache = JSON.parse(readFileSync(p, 'utf8')) as LocationsFile
      return locationsCache
    } catch {
      /* try next */
    }
  }
  log.warn('locations.json not found — Location browse will be empty')
  locationsCache = null
  return null
}

export interface LocationState {
  id: number
  name: string
  cities: Array<{ id: number; name: string; sermonIds: number[] }>
}

/**
 * State → city → sermon tree. The sermon→city map comes from `sermon_index`
 * (the city id lives in the mislabelled `para_count` column); the names come
 * from the bundled locations file.
 */
export function getLocalLocationTree(db: Database): LocationState[] {
  const locs = loadLocations()
  if (!locs) return []

  const rows = db
    .prepare<[], { id: number; city: number }>(
      'SELECT id, para_count AS city FROM sermon_index ORDER BY date_code, id'
    )
    .all()
  const byCity = new Map<number, number[]>()
  for (const r of rows) {
    if (!r.city) continue
    const list = byCity.get(r.city) ?? []
    list.push(r.id)
    byCity.set(r.city, list)
  }

  const tree: LocationState[] = []
  for (const st of locs.states) {
    const cities = st.cities
      .filter((cid) => byCity.has(cid))
      .map((cid) => ({
        id: cid,
        name: locs.cities[String(cid)] ?? `City ${cid}`,
        sermonIds: byCity.get(cid) ?? []
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (cities.length > 0) tree.push({ id: st.id, name: st.name, cities })
  }
  return tree.sort((a, b) => a.name.localeCompare(b.name))
}
