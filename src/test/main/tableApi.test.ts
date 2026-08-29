import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchSermonList,
  fetchSermonContent,
  serverSearch,
  fetchAutocompleteSuggestions,
  fetchHitsCountPreview,
  fetchAllSeries,
  fetchAllStates,
  fetchAllCities,
  fetchAllDateGroups,
  fetchAllDurationGroups,
  fetchSubtitles,
  clearBrowseCache
} from '../../main/tableApi'

// Helper: build a minimal Response-like object
function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body)
  }
}

const globalFetch = global.fetch

beforeEach(() => {
  global.fetch = vi.fn()
  clearBrowseCache()
})

afterEach(() => {
  global.fetch = globalFetch
  vi.restoreAllMocks()
})

// ── fetchSermonList ────────────────────────────────────────────────────────────

describe('fetchSermonList', () => {
  it('returns sermons from Successful response', async () => {
    const sermons = [
      { i: 1, p: '63-0901M', t: 'Come Follow Me', c: 120, m: 90, cab: false, ct: 'S' }
    ]
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Successful', Result: { Sermons: sermons } }) as unknown as Response
    )
    const result = await fetchSermonList()
    expect(result).toEqual(sermons)
  })

  it('returns [] when Status is not Successful', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Error', Result: null }) as unknown as Response
    )
    const result = await fetchSermonList()
    expect(result).toEqual([])
  })

  it('returns [] on network error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))
    const result = await fetchSermonList()
    expect(result).toEqual([])
  })

  it('returns [] on HTTP error status', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({}, false, 500) as unknown as Response
    )
    const result = await fetchSermonList()
    expect(result).toEqual([])
  })
})

// ── fetchSermonContent ─────────────────────────────────────────────────────────

describe('fetchSermonContent', () => {
  it('maps API response to SermonContent shape', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          DateCode: '63-0901M',
          Title: 'Come Follow Me',
          TotalSections: 2,
          Sections: [
            { Paragraph: 'p1', Content: '<p>First <b>paragraph</b></p>' },
            { Paragraph: 'p2', Content: '<p>Second &amp; third</p>' }
          ]
        }
      }) as unknown as Response
    )
    const result = await fetchSermonContent(42)
    expect(result).not.toBeNull()
    expect(result!.dateCode).toBe('63-0901M')
    expect(result!.title).toBe('Come Follow Me')
    expect(result!.sections).toHaveLength(2)
    expect(result!.sections[0].text).toBe('First paragraph')
    expect(result!.sections[1].text).toBe('Second & third')
  })

  it('filters out sections with empty text after stripHtml', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          DateCode: '63-0901M',
          Title: 'Test',
          TotalSections: 2,
          Sections: [
            { Paragraph: 'p1', Content: '   ' },
            { Paragraph: 'p2', Content: '<p>Real text</p>' }
          ]
        }
      }) as unknown as Response
    )
    const result = await fetchSermonContent(1)
    expect(result!.sections).toHaveLength(1)
    expect(result!.sections[0].ref).toBe('p2')
  })

  it('returns null on non-Successful status', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Error', Result: null }) as unknown as Response
    )
    const result = await fetchSermonContent(1)
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('fail'))
    const result = await fetchSermonContent(1)
    expect(result).toBeNull()
  })
})

// ── serverSearch ──────────────────────────────────────────────────────────────

describe('serverSearch', () => {
  it('maps Items array from response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          Items: [
            {
              SermonProductIdentityId: 5,
              DateCode: '65-1125',
              Title: 'The Invisible Union',
              ParagraphRef: 'p3',
              Content: '<p>Holy text</p>'
            }
          ]
        }
      }) as unknown as Response
    )
    const result = await serverSearch('holy', 'AllWords')
    expect(result).toHaveLength(1)
    expect(result[0].sermonId).toBe(5)
    expect(result[0].text).toBe('Holy text')
    expect(result[0].paragraphRef).toBe('p3')
  })

  it('falls back to Quotes array when Items absent', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          Quotes: [
            {
              SermonProductIdentityId: 10,
              DateCode: '60-0101',
              Title: 'A Sermon',
              ParagraphRef: 'p1',
              Content: 'Plain text'
            }
          ]
        }
      }) as unknown as Response
    )
    const result = await serverSearch('faith', 'ExactPhrase')
    expect(result[0].sermonId).toBe(10)
  })

  it('returns [] on error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('timeout'))
    const result = await serverSearch('test', 'AllWords')
    expect(result).toEqual([])
  })

  it('maps the current Results[].Properties shape and strips highlight markup', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          Results: [
            {
              Properties: {
                DateCode: '47-0412',
                Title: 'Faith Is The Substance',
                Paragraph: '23-27',
                Fragment:
                  'may the <span class="hit-snippet-highlight">Holy</span> <span class="hit-snippet-highlight">Spirit</span> tip His wings'
              },
              RecordId: '47010109'
            }
          ]
        }
      }) as unknown as Response
    )
    const result = await serverSearch('holy spirit', 'ExactPhrase')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      dateCode: '47-0412',
      sermonTitle: 'Faith Is The Substance',
      paragraphRef: '23-27'
    })
    expect(result[0].text).toBe('may the Holy Spirit tip His wings')
  })
})

// ── fetchAutocompleteSuggestions ──────────────────────────────────────────────

describe('fetchAutocompleteSuggestions', () => {
  it('returns Suggestions array', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: { Suggestions: ['faith', 'faithful', 'faithfully'] }
      }) as unknown as Response
    )
    const result = await fetchAutocompleteSuggestions('fait')
    expect(result).toEqual(['faith', 'faithful', 'faithfully'])
  })

  it('falls back to Words array', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: { Words: ['grace', 'graceful'] }
      }) as unknown as Response
    )
    const result = await fetchAutocompleteSuggestions('gra')
    expect(result).toEqual(['grace', 'graceful'])
  })

  it('maps the current { w, h } object shape to plain words', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          Suggestions: [
            { w: 'faith', h: 13154 },
            { w: 'faithful', h: 484 }
          ]
        }
      }) as unknown as Response
    )
    expect(await fetchAutocompleteSuggestions('fait')).toEqual(['faith', 'faithful'])
  })

  it('does not call the API for fragments shorter than 2 characters', async () => {
    expect(await fetchAutocompleteSuggestions('x')).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns [] on non-Successful status', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Error', Result: null }) as unknown as Response
    )
    expect(await fetchAutocompleteSuggestions('xx')).toEqual([])
  })

  it('returns [] on network failure', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('fail'))
    expect(await fetchAutocompleteSuggestions('xx')).toEqual([])
  })
})

// ── fetchHitsCountPreview ──────────────────────────────────────────────────────

describe('fetchHitsCountPreview', () => {
  it('returns Count field', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Successful', Result: { Count: 342 } }) as unknown as Response
    )
    expect(await fetchHitsCountPreview('faith', 'AllWords')).toBe(342)
  })

  it('falls back to TotalCount', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Successful', Result: { TotalCount: 100 } }) as unknown as Response
    )
    expect(await fetchHitsCountPreview('grace', 'AllWords')).toBe(100)
  })

  it('falls back to HitCount', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Successful', Result: { HitCount: 55 } }) as unknown as Response
    )
    expect(await fetchHitsCountPreview('love', 'ExactPhrase')).toBe(55)
  })

  it('reads the current { t, st, h } shape', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: { t: 'holy spirit', st: 'ExactPhrase', h: 11764 }
      }) as unknown as Response
    )
    expect(await fetchHitsCountPreview('holy spirit', 'ExactPhrase')).toBe(11764)
  })

  it('returns 0 on failure', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('err'))
    expect(await fetchHitsCountPreview('x', 'AllWords')).toBe(0)
  })
})

// ── fetchAllSeries ─────────────────────────────────────────────────────────────

describe('fetchAllSeries', () => {
  it('returns series list', async () => {
    const series = [{ i: 1, n: 'Church Age Book', s: [10, 11, 12] }]
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Successful', Result: { Series: series } }) as unknown as Response
    )
    const result = await fetchAllSeries()
    expect(result).toEqual(series)
  })

  it('returns [] on error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('fail'))
    expect(await fetchAllSeries()).toEqual([])
  })

  it('caches a successful result — second call does not hit the network', async () => {
    const series = [{ i: 1, n: 'Church Age Book', s: [10] }]
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Successful', Result: { Series: series } }) as unknown as Response
    )
    await fetchAllSeries()
    await fetchAllSeries()
    await fetchAllSeries()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not cache an empty/failed result', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('fail'))
    await fetchAllSeries()
    const series = [{ i: 2, n: 'Later', s: [1] }]
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Successful', Result: { Series: series } }) as unknown as Response
    )
    expect(await fetchAllSeries()).toEqual(series)
  })
})

// ── fetchAllStates ─────────────────────────────────────────────────────────────

describe('fetchAllStates', () => {
  it('returns states list', async () => {
    const states = [{ i: 1, n: 'Indiana', c: [5, 6] }]
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Successful', Result: { States: states } }) as unknown as Response
    )
    const result = await fetchAllStates()
    expect(result).toEqual(states)
  })

  it('returns [] on failure', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('fail'))
    expect(await fetchAllStates()).toEqual([])
  })
})

// ── fetchAllCities ─────────────────────────────────────────────────────────────

describe('fetchAllCities', () => {
  it('returns cities list', async () => {
    const cities = [{ i: 5, n: 'Jeffersonville' }]
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({ Status: 'Successful', Result: { Cities: cities } }) as unknown as Response
    )
    const result = await fetchAllCities()
    expect(result).toEqual(cities)
  })

  it('returns [] on failure', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('fail'))
    expect(await fetchAllCities()).toEqual([])
  })
})

// ── fetchAllDateGroups ─────────────────────────────────────────────────────────

describe('fetchAllDateGroups', () => {
  it('parses Groups array with n/s fields', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          Groups: [
            { n: '1960s', s: [1, 2, 3] },
            { n: '1970s', s: [4, 5] }
          ]
        }
      }) as unknown as Response
    )
    const result = await fetchAllDateGroups()
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('1960s')
    expect(result[0].sermonIds).toEqual([1, 2, 3])
  })

  it('falls back to DateGroups array', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          DateGroups: [{ Name: '1960', Sermons: [10] }]
        }
      }) as unknown as Response
    )
    const result = await fetchAllDateGroups()
    expect(result[0].label).toBe('1960')
    expect(result[0].sermonIds).toEqual([10])
  })

  it('returns [] on error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('fail'))
    expect(await fetchAllDateGroups()).toEqual([])
  })
})

// ── fetchAllDurationGroups ────────────────────────────────────────────────────

describe('fetchAllDurationGroups', () => {
  it('parses Groups array', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          Groups: [{ n: '< 1 hour', s: [1, 2] }]
        }
      }) as unknown as Response
    )
    const result = await fetchAllDurationGroups()
    expect(result[0].label).toBe('< 1 hour')
    expect(result[0].sermonIds).toEqual([1, 2])
  })

  it('returns [] on error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('fail'))
    expect(await fetchAllDurationGroups()).toEqual([])
  })
})

// ── fetchSubtitles ─────────────────────────────────────────────────────────────

describe('fetchSubtitles', () => {
  it('parses Subtitles array', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          Subtitles: [
            { Paragraph: 'p5', Subtitle: 'Divine Healing' },
            { Paragraph: 'p10', Subtitle: 'The Second Coming' }
          ]
        }
      }) as unknown as Response
    )
    const result = await fetchSubtitles(42)
    expect(result).toHaveLength(2)
    expect(result[0].paragraphRef).toBe('p5')
    expect(result[0].subtitle).toBe('Divine Healing')
  })

  it('falls back to Items array', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          Items: [{ ParagraphRef: 'p1', Text: 'Introduction' }]
        }
      }) as unknown as Response
    )
    const result = await fetchSubtitles(1)
    expect(result[0].paragraphRef).toBe('p1')
    expect(result[0].subtitle).toBe('Introduction')
  })

  it('filters entries missing ref or subtitle', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockResponse({
        Status: 'Successful',
        Result: {
          Subtitles: [
            { Paragraph: '', Subtitle: 'Empty ref — should be excluded' },
            { Paragraph: 'p3', Subtitle: 'Valid' }
          ]
        }
      }) as unknown as Response
    )
    const result = await fetchSubtitles(1)
    expect(result).toHaveLength(1)
    expect(result[0].paragraphRef).toBe('p3')
  })

  it('returns [] on error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('fail'))
    expect(await fetchSubtitles(1)).toEqual([])
  })
})
