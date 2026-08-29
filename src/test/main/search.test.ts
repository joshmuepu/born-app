import { describe, it, expect } from 'vitest'
import {
  buildSearchSQL,
  buildPhraseQuery,
  buildTokenQuery,
  rowToQuote,
  SEARCH_BASE
} from '../../main/search'

describe('buildPhraseQuery', () => {
  it('wraps the whole query in quotes', () => {
    expect(buildPhraseQuery('holy spirit')).toBe('"holy spirit"')
  })
  it('doubles embedded quotes so the FTS expression stays valid', () => {
    expect(buildPhraseQuery('the "rapture"')).toBe('"the ""rapture"""')
  })
})

describe('buildTokenQuery', () => {
  it('AND-joins the words', () => {
    expect(buildTokenQuery('faith  hope   love')).toBe('faith hope love')
  })
  it('strips FTS operator characters that would break MATCH', () => {
    expect(buildTokenQuery('faith* (hope) "love" ^x col:on')).toBe('faith hope love x colon')
  })
  it('returns an empty string when nothing usable remains', () => {
    expect(buildTokenQuery('  ** () ')).toBe('')
  })
})

describe('buildSearchSQL', () => {
  it('returns base SQL with no filters', () => {
    const { sql, extraParams } = buildSearchSQL({})
    expect(sql).toContain(SEARCH_BASE.trim())
    expect(sql).toContain('ORDER BY rank LIMIT 50')
    expect(extraParams).toEqual([])
  })

  it('adds yearFrom filter with 4-digit year (slices to 2 digits)', () => {
    const { sql, extraParams } = buildSearchSQL({ yearFrom: '1962' })
    expect(sql).toContain(`SUBSTR(s.date_code, 1, 2) >= ?`)
    expect(extraParams).toEqual(['62'])
  })

  it('adds yearFrom filter with 2-digit year as-is', () => {
    const { sql, extraParams } = buildSearchSQL({ yearFrom: '62' })
    expect(extraParams).toEqual(['62'])
  })

  it('adds yearTo filter with 4-digit year', () => {
    const { sql, extraParams } = buildSearchSQL({ yearTo: '1965' })
    expect(sql).toContain(`SUBSTR(s.date_code, 1, 2) <= ?`)
    expect(extraParams).toEqual(['65'])
  })

  it('adds yearTo filter with 2-digit year', () => {
    const { sql, extraParams } = buildSearchSQL({ yearTo: '65' })
    expect(extraParams).toEqual(['65'])
  })

  it('adds titleFilter as LIKE param', () => {
    const { sql, extraParams } = buildSearchSQL({ titleFilter: 'Faith' })
    expect(sql).toContain(`LOWER(s.title) LIKE ?`)
    expect(extraParams).toEqual(['%faith%'])
  })

  it('trims titleFilter whitespace', () => {
    const { sql, extraParams } = buildSearchSQL({ titleFilter: '  love  ' })
    expect(extraParams).toEqual(['%love%'])
  })

  it('skips titleFilter when only whitespace', () => {
    const { sql, extraParams } = buildSearchSQL({ titleFilter: '   ' })
    expect(sql).not.toContain('LIKE')
    expect(extraParams).toEqual([])
  })

  it('combines yearFrom and yearTo', () => {
    const { sql, extraParams } = buildSearchSQL({ yearFrom: '1960', yearTo: '1965' })
    expect(sql).toContain('>=')
    expect(sql).toContain('<=')
    expect(extraParams).toEqual(['60', '65'])
  })

  it('combines all three filters', () => {
    const { sql, extraParams } = buildSearchSQL({
      yearFrom: '1963',
      yearTo: '1965',
      titleFilter: 'Word'
    })
    expect(extraParams).toEqual(['63', '65', '%word%'])
  })

  it('always ends with ORDER BY rank LIMIT 50', () => {
    const { sql } = buildSearchSQL({ yearFrom: '1960', titleFilter: 'Grace' })
    expect(sql.trimEnd()).toMatch(/ORDER BY rank LIMIT 50$/)
  })
})

describe('rowToQuote', () => {
  it('maps all fields correctly', () => {
    const row = {
      sermonId: 42,
      paragraphRef: 'p7',
      paragraphIndex: 7,
      text: 'And God said',
      dateCode: '63-0901M',
      sermonTitle: 'Come Follow Me'
    }
    const quote = rowToQuote(row)
    expect(quote).toEqual({
      sermonId: 42,
      paragraphRef: 'p7',
      paragraphIndex: 7,
      text: 'And God said',
      dateCode: '63-0901M',
      sermonTitle: 'Come Follow Me'
    })
  })

  it('handles zero/empty values', () => {
    const row = {
      sermonId: 0,
      paragraphRef: 'header',
      paragraphIndex: 0,
      text: '',
      dateCode: '',
      sermonTitle: ''
    }
    const quote = rowToQuote(row)
    expect(quote.paragraphIndex).toBe(0)
    expect(quote.text).toBe('')
  })
})
