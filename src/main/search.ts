/**
 * search.ts — SQL building for FTS5 queries.
 * No Electron deps — fully testable in Node.js.
 */
import { MAX_SEARCH_RESULTS } from '../shared/searchLimits'

export const SEARCH_BASE = `
  SELECT p.sermon_id       AS sermonId,
         p.id              AS paragraphId,
         p.paragraph_ref   AS paragraphRef,
         p.paragraph_index AS paragraphIndex,
         p.text,
         s.date_code       AS dateCode,
         s.title           AS sermonTitle
  FROM paragraphs_fts
  JOIN paragraphs p ON paragraphs_fts.rowid = p.id
  JOIN sermons s    ON s.id = p.sermon_id
  WHERE paragraphs_fts MATCH ?
`

/** See src/shared/searchLimits.ts for why this is 25000 and not "big enough
 *  that no real search can ever hit it" — that approach was tried and it
 *  crashed the renderer on a large-enough common-word search. Any caller
 *  showing this count to a user MUST treat a result set of exactly this
 *  length as "at least this many" (see MAX_SEARCH_RESULTS's doc comment),
 *  never as an exact total. */
export const NO_PRACTICAL_LIMIT = MAX_SEARCH_RESULTS

export type MatchMode = 'phrase' | 'all' | 'any'

export interface SearchFilters {
  yearFrom?: string
  yearTo?: string
  titleFilter?: string
  /** 'phrase' (default) tries the exact phrase, falling back to 'all' when
   *  it has no hits; 'all' requires every significant word; 'any' matches
   *  if any one of them appears. */
  matchMode?: MatchMode
  /** A date-code prefix — "61-0317" for one service, "63-08" for all of
   *  August 1963. Matched as a LIKE prefix so a partial code still narrows. */
  dateCode?: string
}

export function buildSearchSQL(filters: SearchFilters): { sql: string; extraParams: unknown[] } {
  let sql = SEARCH_BASE
  const extraParams: unknown[] = []

  if (filters.yearFrom) {
    const yf = filters.yearFrom.length === 4 ? filters.yearFrom.slice(2) : filters.yearFrom
    sql += ` AND SUBSTR(s.date_code, 1, 2) >= ?`
    extraParams.push(yf)
  }
  if (filters.yearTo) {
    const yt = filters.yearTo.length === 4 ? filters.yearTo.slice(2) : filters.yearTo
    sql += ` AND SUBSTR(s.date_code, 1, 2) <= ?`
    extraParams.push(yt)
  }
  if (filters.titleFilter?.trim()) {
    sql += ` AND LOWER(s.title) LIKE ?`
    extraParams.push(`%${filters.titleFilter.trim().toLowerCase()}%`)
  }
  if (filters.dateCode?.trim()) {
    sql += ` AND s.date_code LIKE ?`
    extraParams.push(`${filters.dateCode.trim().toUpperCase()}%`)
  }

  sql += ` ORDER BY rank LIMIT ?`
  return { sql, extraParams }
}

/** FTS5 phrase query: the whole input as one quoted phrase (internal quotes doubled). */
export function buildPhraseQuery(query: string): string {
  return '"' + query.trim().replace(/"/g, '""') + '"'
}

/**
 * FTS5 token query: each word AND-ed together (a bare space between FTS5
 * tokens is an implicit AND), with FTS operator characters stripped so user
 * punctuation can't blow up the MATCH expression. Returns '' when nothing
 * usable remains.
 */
export function buildTokenQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/["*()[\]^:]/g, ''))
    .filter(Boolean)
    .join(' ')
}

/** FTS5 "any of these words" query: each word OR-ed together. */
export function buildAnyWordQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/["*()[\]^:]/g, ''))
    .filter(Boolean)
    .join(' OR ')
}

export interface QuoteRow {
  sermonId: number
  paragraphId: number
  paragraphRef: string
  paragraphIndex: number
  text: string
  dateCode: string
  sermonTitle: string
}

/** Books have blank paragraph refs — fall back to a stable per-row token so the
 *  reference is always unique (needed for Next/Prev and row highlighting). */
export function stableParagraphRef(ref: string | null | undefined, rowId: number): string {
  const r = (ref ?? '').trim()
  return r || `§${rowId}`
}

export function rowToQuote(r: QuoteRow, matchType: MatchMode) {
  return {
    text: r.text,
    sermonTitle: r.sermonTitle,
    dateCode: r.dateCode,
    sermonId: r.sermonId,
    paragraphIndex: r.paragraphIndex,
    paragraphRef: stableParagraphRef(r.paragraphRef, r.paragraphId),
    matchType
  }
}
