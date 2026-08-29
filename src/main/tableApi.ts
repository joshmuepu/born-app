/**
 * tableApi.ts — All HTTP calls to table.branham.org
 * Called from the main process only (Node.js fetch available in Electron 21+).
 */

import { stripHtml, parseParagraphIndex } from './utils'

const BASE = 'https://table.branham.org/rest'

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${path}`)
  return res.json() as Promise<T>
}

// ── Sermon Index (allSermons) ─────────────────────────────────────────────────

export interface SermonIndexEntry {
  i: number     // SermonProductIdentityId
  p: string     // date code (e.g. "63-0901M")
  t: string     // title
  c: number     // paragraph count
  m: number     // duration in minutes
  cab: boolean  // church age book chapter
  ct: string    // "S" = sermon, "B" = book chapter
}

export async function fetchSermonList(): Promise<SermonIndexEntry[]> {
  try {
    const data = await post<{ Status: string; Result: { Sermons: SermonIndexEntry[] } }>(
      '/index/allSermons',
      { Language: 'en' }
    )
    return data.Status === 'Successful' ? (data.Result?.Sermons ?? []) : []
  } catch {
    return []
  }
}

// ── Sermon Content ────────────────────────────────────────────────────────────

export interface SermonContent {
  dateCode: string
  title: string
  totalSections: number
  sections: { ref: string; index: number; text: string }[]
}


export async function fetchSermonContent(
  id: number,
  language = 'en'
): Promise<SermonContent | null> {
  try {
    const data = await post<{
      Status: string
      Result: {
        DateCode: string
        Title: string
        TotalSections: number
        Sections: Array<{ Paragraph: string; Content: string }>
      }
    }>('/sermons/sermonRequest', {
      Language: language,
      SermonProductIdentityId: id,
      GetAllContent: true,
      HighlightQuery: null
    })
    if (data.Status !== 'Successful' || !data.Result) return null
    const { DateCode, Title, TotalSections, Sections } = data.Result
    const sections = Sections.map((s) => ({
      ref: s.Paragraph,
      index: parseParagraphIndex(s.Paragraph),
      text: stripHtml(s.Content)
    })).filter((s) => s.text.length > 0)
    return { dateCode: DateCode, title: Title, totalSections: TotalSections, sections }
  } catch {
    return null
  }
}

// ── Server-Side Search (fallback when local index < 100 sermons) ──────────────

export interface ServerSearchResult {
  sermonId: number
  dateCode: string
  sermonTitle: string
  paragraphRef: string
  text: string
}

interface UserQueryHit {
  Properties?: {
    DateCode?: string
    Title?: string
    Paragraph?: string
    ParagraphRef?: string
    Fragment?: string
    Content?: string
  }
  // Legacy flat shapes, kept as fallbacks.
  SermonProductIdentityId?: number
  DateCode?: string
  Title?: string
  ParagraphRef?: string
  Content?: string
}

export async function serverSearch(
  text: string,
  searchType: 'AllWords' | 'ExactPhrase',
  pageSize = 25
): Promise<ServerSearchResult[]> {
  try {
    const data = await post<{
      Status: string
      Result: { Results?: UserQueryHit[]; Items?: UserQueryHit[]; Quotes?: UserQueryHit[] }
    }>('/userQuery', {
      Language: 'en',
      SearchType: searchType,
      Text: text,
      PageSize: pageSize
    })
    if (data.Status !== 'Successful' || !data.Result) return []
    const hits = data.Result.Results ?? data.Result.Items ?? data.Result.Quotes ?? []
    return hits
      .map((hit) => {
        const p = hit.Properties ?? {}
        return {
          sermonId: hit.SermonProductIdentityId ?? 0,
          dateCode: p.DateCode ?? hit.DateCode ?? '',
          sermonTitle: p.Title ?? hit.Title ?? '',
          paragraphRef: p.Paragraph ?? p.ParagraphRef ?? hit.ParagraphRef ?? '',
          text: stripHtml(p.Fragment ?? p.Content ?? hit.Content ?? '')
        }
      })
      .filter((r) => r.text.length > 0)
  } catch {
    return []
  }
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

export async function fetchAutocompleteSuggestions(
  wordPart: string,
  pageSize = 8
): Promise<string[]> {
  // The upstream endpoint 500s on very short fragments — never send them.
  const w = (wordPart ?? '').trim()
  if (w.length < 2) return []
  try {
    const data = await post<{
      Status: string
      // The API returns objects: { w: "faith", h: 13154 } (word + hit count).
      Result: { Suggestions?: Array<{ w?: string } | string>; Words?: string[] }
    }>('/autoComplete/suggestionsForWordPart', {
      Language: 'en',
      WordPart: w,
      PageSize: pageSize
    })
    if (data.Status !== 'Successful' || !data.Result) return []
    const raw = data.Result.Suggestions ?? data.Result.Words ?? []
    return raw
      .map((s) => (typeof s === 'string' ? s : (s?.w ?? '')))
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
  } catch {
    return []
  }
}

export async function fetchHitsCountPreview(
  text: string,
  searchType: 'AllWords' | 'ExactPhrase'
): Promise<number> {
  try {
    const data = await post<{
      Status: string
      // Current API shape: { t, st, h }. Older keys kept as fallbacks.
      Result: { h?: number; Count?: number; TotalCount?: number; HitCount?: number }
    }>('/autoComplete/hitsCountPreview', {
      Language: 'en',
      Text: text,
      SearchType: searchType
    })
    if (data.Status !== 'Successful' || !data.Result) return 0
    return (
      data.Result.h ??
      data.Result.Count ??
      data.Result.TotalCount ??
      data.Result.HitCount ??
      0
    )
  } catch {
    return 0
  }
}

// ── Browse list caching ───────────────────────────────────────────────────────
// The allSeries / allStates / allCities / allDateGroups / allDurationGroups
// endpoints return data that is static for a session. Cache the first successful
// (non-empty) response so repeated Browse-tab visits never re-hit the network.

const browseCache = new Map<string, unknown>()

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (browseCache.has(key)) return browseCache.get(key) as T
  const value = await fn()
  if (!Array.isArray(value) || value.length > 0) browseCache.set(key, value)
  return value
}

/** Drop cached browse lists (used by tests and a future manual refresh). */
export function clearBrowseCache(): void {
  browseCache.clear()
}

// ── Browse: Series ────────────────────────────────────────────────────────────

export interface SeriesEntry {
  i: number    // series id
  n: string    // series name
  s: number[]  // sermon IDs (SermonProductIdentityId)
}

export function fetchAllSeries(): Promise<SeriesEntry[]> {
  return cached('series', async () => {
    try {
      const data = await post<{ Status: string; Result: { Series: SeriesEntry[] } }>(
        '/index/allSeries',
        { Language: 'en' }
      )
      return data.Status === 'Successful' ? (data.Result?.Series ?? []) : []
    } catch {
      return []
    }
  })
}

// ── Browse: Location ──────────────────────────────────────────────────────────

export interface StateEntry {
  i: number    // state id
  n: string    // state name
  c: number[]  // city IDs
}

export interface CityEntry {
  i: number    // city id
  n: string    // city name
}

export function fetchAllStates(): Promise<StateEntry[]> {
  return cached('states', async () => {
    try {
      const data = await post<{ Status: string; Result: { States: StateEntry[] } }>(
        '/index/allStates',
        { Language: 'en' }
      )
      return data.Status === 'Successful' ? (data.Result?.States ?? []) : []
    } catch {
      return []
    }
  })
}

export function fetchAllCities(): Promise<CityEntry[]> {
  return cached('cities', async () => {
    try {
      const data = await post<{ Status: string; Result: { Cities: CityEntry[] } }>(
        '/index/allCities',
        { Language: 'en' }
      )
      return data.Status === 'Successful' ? (data.Result?.Cities ?? []) : []
    } catch {
      return []
    }
  })
}

// ── Browse: Date & Duration Groups ───────────────────────────────────────────

export interface DateGroup {
  label: string
  sermonIds: number[]
}

export function fetchAllDateGroups(): Promise<DateGroup[]> {
  return cached('dateGroups', async () => {
    try {
      const data = await post<{ Status: string; Result: unknown }>('/index/allDateGroups', {
        Language: 'en'
      })
      if (data.Status !== 'Successful' || !data.Result) return []
      const result = data.Result as Record<string, unknown>
      // Probe shape — common patterns: Groups, DateGroups, Years, Decades
      const raw =
        (result.Groups as unknown[]) ??
        (result.DateGroups as unknown[]) ??
        (result.Years as unknown[]) ??
        (result.Decades as unknown[]) ??
        []
      return (raw as Array<Record<string, unknown>>).map((g) => ({
        label: String(g.n ?? g.Name ?? g.Label ?? g.Year ?? ''),
        sermonIds: (g.s ?? g.Sermons ?? g.SermonIds ?? []) as number[]
      }))
    } catch {
      return []
    }
  })
}

export interface DurationGroup {
  label: string
  sermonIds: number[]
}

export function fetchAllDurationGroups(): Promise<DurationGroup[]> {
  return cached('durationGroups', async () => {
    try {
      const data = await post<{ Status: string; Result: unknown }>('/index/allDurationGroups', {
        Language: 'en'
      })
      if (data.Status !== 'Successful' || !data.Result) return []
      const result = data.Result as Record<string, unknown>
      const raw = (result.Groups as unknown[]) ?? (result.DurationGroups as unknown[]) ?? []
      return (raw as Array<Record<string, unknown>>).map((g) => ({
        label: String(g.n ?? g.Name ?? g.Label ?? ''),
        sermonIds: (g.s ?? g.Sermons ?? g.SermonIds ?? []) as number[]
      }))
    } catch {
      return []
    }
  })
}

// ── Subtitles ─────────────────────────────────────────────────────────────────

export interface SubtitleEntry {
  paragraphRef: string
  subtitle: string
}

export async function fetchSubtitles(
  id: number,
  language = 'en'
): Promise<SubtitleEntry[]> {
  try {
    const data = await post<{ Status: string; Result: unknown }>(
      '/sermons/sermonSubtitlesRequest',
      { Language: language, SermonProductIdentityId: id }
    )
    if (data.Status !== 'Successful' || !data.Result) return []
    const result = data.Result as Record<string, unknown>
    // Probe multiple possible shapes
    const raw =
      (result.Subtitles as unknown[]) ??
      (result.Items as unknown[]) ??
      (result.Sections as unknown[]) ??
      []
    return (raw as Array<Record<string, unknown>>).map((s) => ({
      paragraphRef: String(s.Paragraph ?? s.ParagraphRef ?? s.Ref ?? ''),
      subtitle: String(s.Subtitle ?? s.Text ?? s.Content ?? '')
    })).filter((s) => s.paragraphRef && s.subtitle)
  } catch {
    return []
  }
}

// ── Languages ─────────────────────────────────────────────────────────────────

export async function fetchLanguages(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${BASE}/resources/localization/en`)
    if (!res.ok) return {}
    const json = await res.json() as {
      Status: string
      Result: { Resources: { Languages: { Names: Record<string, string> } } }
    }
    if (json.Status !== 'Successful') return {}
    return json.Result?.Resources?.Languages?.Names ?? {}
  } catch {
    return {}
  }
}
