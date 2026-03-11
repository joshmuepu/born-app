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

export async function serverSearch(
  text: string,
  searchType: 'AllWords' | 'ExactPhrase',
  pageSize = 25
): Promise<ServerSearchResult[]> {
  try {
    const data = await post<{
      Status: string
      Result: {
        // API may use "Items" or "Quotes" — handle both
        Items?: Array<{
          SermonProductIdentityId: number
          DateCode: string
          Title: string
          ParagraphRef: string
          Content: string
        }>
        Quotes?: Array<{
          SermonProductIdentityId: number
          DateCode: string
          Title: string
          ParagraphRef: string
          Content: string
        }>
      }
    }>('/userQuery', {
      Language: 'en',
      SearchType: searchType,
      Text: text,
      PageSize: pageSize
    })
    if (data.Status !== 'Successful' || !data.Result) return []
    const items = data.Result.Items ?? data.Result.Quotes ?? []
    return items.map((item) => ({
      sermonId: item.SermonProductIdentityId,
      dateCode: item.DateCode,
      sermonTitle: item.Title,
      paragraphRef: item.ParagraphRef,
      text: stripHtml(item.Content)
    }))
  } catch {
    return []
  }
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

export async function fetchAutocompleteSuggestions(
  wordPart: string,
  pageSize = 8
): Promise<string[]> {
  try {
    const data = await post<{
      Status: string
      Result: { Suggestions?: string[]; Words?: string[] }
    }>('/autoComplete/suggestionsForWordPart', {
      Language: 'en',
      WordPart: wordPart,
      PageSize: pageSize
    })
    if (data.Status !== 'Successful' || !data.Result) return []
    return data.Result.Suggestions ?? data.Result.Words ?? []
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
      Result: { Count?: number; TotalCount?: number; HitCount?: number }
    }>('/autoComplete/hitsCountPreview', {
      Language: 'en',
      Text: text,
      SearchType: searchType
    })
    if (data.Status !== 'Successful' || !data.Result) return 0
    return data.Result.Count ?? data.Result.TotalCount ?? data.Result.HitCount ?? 0
  } catch {
    return 0
  }
}

// ── Browse: Series ────────────────────────────────────────────────────────────

export interface SeriesEntry {
  i: number    // series id
  n: string    // series name
  s: number[]  // sermon IDs (SermonProductIdentityId)
}

export async function fetchAllSeries(): Promise<SeriesEntry[]> {
  try {
    const data = await post<{ Status: string; Result: { Series: SeriesEntry[] } }>(
      '/index/allSeries',
      { Language: 'en' }
    )
    return data.Status === 'Successful' ? (data.Result?.Series ?? []) : []
  } catch {
    return []
  }
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

export async function fetchAllStates(): Promise<StateEntry[]> {
  try {
    const data = await post<{ Status: string; Result: { States: StateEntry[] } }>(
      '/index/allStates',
      { Language: 'en' }
    )
    return data.Status === 'Successful' ? (data.Result?.States ?? []) : []
  } catch {
    return []
  }
}

export async function fetchAllCities(): Promise<CityEntry[]> {
  try {
    const data = await post<{ Status: string; Result: { Cities: CityEntry[] } }>(
      '/index/allCities',
      { Language: 'en' }
    )
    return data.Status === 'Successful' ? (data.Result?.Cities ?? []) : []
  } catch {
    return []
  }
}

// ── Browse: Date & Duration Groups ───────────────────────────────────────────

export interface DateGroup {
  label: string
  sermonIds: number[]
}

export async function fetchAllDateGroups(): Promise<DateGroup[]> {
  try {
    const data = await post<{ Status: string; Result: unknown }>(
      '/index/allDateGroups',
      { Language: 'en' }
    )
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
}

export interface DurationGroup {
  label: string
  sermonIds: number[]
}

export async function fetchAllDurationGroups(): Promise<DurationGroup[]> {
  try {
    const data = await post<{ Status: string; Result: unknown }>(
      '/index/allDurationGroups',
      { Language: 'en' }
    )
    if (data.Status !== 'Successful' || !data.Result) return []
    const result = data.Result as Record<string, unknown>
    const raw =
      (result.Groups as unknown[]) ??
      (result.DurationGroups as unknown[]) ??
      []
    return (raw as Array<Record<string, unknown>>).map((g) => ({
      label: String(g.n ?? g.Name ?? g.Label ?? ''),
      sermonIds: (g.s ?? g.Sermons ?? g.SermonIds ?? []) as number[]
    }))
  } catch {
    return []
  }
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
