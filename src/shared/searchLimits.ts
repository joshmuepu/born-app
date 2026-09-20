/**
 * searchLimits.ts — the one number shared between a search query's row cap
 * (main process) and the results-count label's "N+" truncation check
 * (renderer), so the two can never drift out of sync.
 *
 * History: the original hard `LIMIT 50` silently truncated common-word
 * searches with no indication. It was replaced with a "no real search gets
 * near this" constant of 20000 — which itself turned out to be wrong: a
 * later QA pass found "the" alone matches 102,835 of ~104,763 sermon
 * paragraphs and 24,130 of ~31,102 Bible verses in one translation, both
 * comfortably over 20000. Raising the cap further doesn't fix this on its
 * own either — rendering that many result rows as real DOM nodes crashed
 * the renderer outright (confirmed empirically: 69,122 rendered fine,
 * 100,719 crashed it).
 *
 * So this cap is deliberately NOT "big enough that no real search can ever
 * hit it" — for a single common word across a 100k+ paragraph library, a
 * search WILL hit it, and that's fine: past this many hits the result list
 * is not useful to a human picking a specific quote/verse/song anyway. What
 * matters is that hitting it is never silent — see MAX_SEARCH_RESULTS's
 * call sites for the "N+" label shown instead of a false exact count.
 */
export const MAX_SEARCH_RESULTS = 25000

/** "1,234 results" normally; "25,000+ results" the instant a result set is
 *  long enough that it might have been cut off — never a bare, possibly-false
 *  exact count at the cap. */
export function resultCountLabel(count: number): string {
  const n = count.toLocaleString()
  if (count >= MAX_SEARCH_RESULTS) return `${n}+ results`
  return `${n} result${count === 1 ? '' : 's'}`
}

/** A much stricter cap for the web remote specifically. The remote renders
 *  in a real mobile browser tab, not desktop Electron — a QA pass found a
 *  common-word search sent at MAX_SEARCH_RESULTS built a ~75MB DOM there,
 *  which a phone's browser has nowhere near the memory budget to survive.
 *  200 matches a phone screen has to scroll through anyway. */
export const MAX_REMOTE_RESULTS = 200
