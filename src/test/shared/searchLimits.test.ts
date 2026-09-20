import { describe, it, expect } from 'vitest'
import { MAX_SEARCH_RESULTS, MAX_REMOTE_RESULTS, resultCountLabel } from '../../shared/searchLimits'

describe('resultCountLabel', () => {
  it('shows an exact count under the cap', () => {
    expect(resultCountLabel(0)).toBe('0 results')
    expect(resultCountLabel(1)).toBe('1 result')
    expect(resultCountLabel(13225)).toBe('13,225 results')
  })

  it('shows "N+" instead of a false exact count once the cap is hit', () => {
    // Regression test: a QA pass found common-word searches ("the", "and")
    // silently truncate at MAX_SEARCH_RESULTS. The label must never claim an
    // exact number at or above the cap — only "N+".
    expect(resultCountLabel(MAX_SEARCH_RESULTS)).toBe(`${MAX_SEARCH_RESULTS.toLocaleString()}+ results`)
    expect(resultCountLabel(MAX_SEARCH_RESULTS + 1)).toContain('+')
  })

  it('never returns an exact count that could actually be truncated', () => {
    for (const n of [MAX_SEARCH_RESULTS - 1, MAX_SEARCH_RESULTS, MAX_SEARCH_RESULTS + 500]) {
      const label = resultCountLabel(n)
      if (n >= MAX_SEARCH_RESULTS) expect(label).toContain('+')
      else expect(label).not.toContain('+')
    }
  })
})

describe('search limit constants', () => {
  it('MAX_SEARCH_RESULTS is small enough to render safely, not just "big"', () => {
    // A QA pass found that raising this cap to "big enough no real search
    // hits it" (200000) crashed the renderer outright on a common-word
    // sermon search (~100k rows). It must stay well under the empirically
    // confirmed safe-render ceiling (69122 rendered fine, 100719 crashed).
    expect(MAX_SEARCH_RESULTS).toBeLessThan(70000)
    // ...but comfortably above already-shipped, real result counts (e.g.
    // "faith" across all sermons = 13225) so it never re-truncates those.
    expect(MAX_SEARCH_RESULTS).toBeGreaterThan(13225)
  })

  it('MAX_REMOTE_RESULTS is far stricter than the desktop cap', () => {
    // The remote renders in a real mobile browser tab with far less memory
    // headroom than desktop Electron — a QA pass found MAX_SEARCH_RESULTS
    // sent to a phone built a ~75MB DOM.
    expect(MAX_REMOTE_RESULTS).toBeLessThan(MAX_SEARCH_RESULTS)
    expect(MAX_REMOTE_RESULTS).toBeLessThanOrEqual(500)
  })
})
