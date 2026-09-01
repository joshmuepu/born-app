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

// ── Date tree (year → month → day) ────────────────────────────────────────────

export interface DateTreeDay {
  day: number
  ids: number[]
}
export interface DateTreeMonth {
  month: number // 1–12
  count: number
  days: DateTreeDay[] // only days that have sermons, ascending
  unknownDayIds: number[] // date code was "YY-MM00" — month known, day not
}
export interface DateTreeYear {
  year: number
  count: number
  months: DateTreeMonth[] // only months that have sermons, ascending
  unknownMonthIds: number[] // date code was "YY-0000"
}
export interface DateTree {
  years: DateTreeYear[]
  undatedIds: number[] // Church Age Book chapters and anything without a date
}

const DATE_RE = /^(\d{2})-(\d{2})(\d{2})?/

/**
 * The whole sermon corpus bucketed by calendar date, built from
 * `sermon_index.date_code`. ~1,200 rows → a ~40 KB tree, so the renderer does
 * one IPC call and every drill-down (decade / year / month / day) is local.
 */
export function getLocalDateTree(db: Database): DateTree {
  const rows = db
    .prepare<[], { id: number; date_code: string }>(
      'SELECT id, date_code FROM sermon_index ORDER BY date_code, id'
    )
    .all()

  const years = new Map<
    number,
    {
      count: number
      unknownMonth: number[]
      months: Map<number, { days: Map<number, number[]>; unknownDay: number[] }>
    }
  >()
  const undatedIds: number[] = []

  for (const r of rows) {
    const m = DATE_RE.exec(r.date_code ?? '')
    if (!m) {
      undatedIds.push(r.id)
      continue
    }
    const yy = parseInt(m[1], 10)
    const year = yy >= 30 ? 1900 + yy : 2000 + yy
    const month = parseInt(m[2], 10) // 0 when unknown
    const day = m[3] ? parseInt(m[3], 10) : 0 // 0 / absent when unknown

    let y = years.get(year)
    if (!y) {
      y = { count: 0, unknownMonth: [], months: new Map() }
      years.set(year, y)
    }
    y.count++

    if (month < 1 || month > 12) {
      y.unknownMonth.push(r.id)
      continue
    }
    let mo = y.months.get(month)
    if (!mo) {
      mo = { days: new Map(), unknownDay: [] }
      y.months.set(month, mo)
    }
    if (day < 1 || day > 31) {
      mo.unknownDay.push(r.id)
      continue
    }
    const d = mo.days.get(day) ?? []
    d.push(r.id)
    mo.days.set(day, d)
  }

  return {
    undatedIds,
    years: [...years.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, y]) => ({
        year,
        count: y.count,
        unknownMonthIds: y.unknownMonth,
        months: [...y.months.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([month, mo]) => {
            const days = [...mo.days.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([day, ids]) => ({ day, ids }))
            const count =
              days.reduce((n, d) => n + d.ids.length, 0) + mo.unknownDay.length
            return { month, count, days, unknownDayIds: mo.unknownDay }
          })
      }))
  }
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
