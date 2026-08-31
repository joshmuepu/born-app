/**
 * browseLocal.ts — Browse groupings built from the bundled sermon database.
 *
 * The online /index/allDateGroups and /allDurationGroups endpoints return the
 * group labels but not the sermon lists, so every group showed "0 sermons".
 * `sermon_index` has date_code + duration_min for all ~1,217 sermons, so we
 * build these locally instead — correct counts, and works with no internet.
 */
import type { Database } from 'better-sqlite3'

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
