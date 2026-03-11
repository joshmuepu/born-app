/**
 * search.ts — SQL building for FTS5 queries.
 * No Electron deps — fully testable in Node.js.
 */

export const SEARCH_BASE = `
  SELECT p.sermon_id       AS sermonId,
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

export interface SearchFilters {
  yearFrom?: string
  yearTo?: string
  titleFilter?: string
  forceTokens?: boolean
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

  sql += ` ORDER BY rank LIMIT 50`
  return { sql, extraParams }
}

export interface QuoteRow {
  sermonId: number
  paragraphRef: string
  paragraphIndex: number
  text: string
  dateCode: string
  sermonTitle: string
}

export function rowToQuote(r: QuoteRow) {
  return {
    text: r.text,
    sermonTitle: r.sermonTitle,
    dateCode: r.dateCode,
    sermonId: r.sermonId,
    paragraphIndex: r.paragraphIndex,
    paragraphRef: r.paragraphRef
  }
}
