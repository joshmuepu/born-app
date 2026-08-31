/**
 * paragraphRef.ts — Branham paragraph references like "26", "41-47", "2-4".
 *
 * When a quote is paged, the slide on screen cites the *page's* paragraph
 * ("43" or "43-45") while the source list still keys the whole entry by its
 * range ("41-47"). `refsOverlap` matches the two so the source row can be
 * highlighted while you page through it.
 */

/** [lo, hi] for a numeric ref, or null for a non-numeric one ("header"). */
export function parseParagraphRef(ref: string): [number, number] | null {
  const m = /^\s*(\d+)\s*(?:[-–—]\s*(\d+))?/.exec(ref ?? '')
  if (!m) return null
  const lo = parseInt(m[1], 10)
  const hi = m[2] ? parseInt(m[2], 10) : lo
  return [Math.min(lo, hi), Math.max(lo, hi)]
}

/** True when the two references cover any of the same paragraph numbers. */
export function refsOverlap(a: string, b: string): boolean {
  if (a === b) return true
  const ra = parseParagraphRef(a)
  const rb = parseParagraphRef(b)
  if (!ra || !rb) return false
  return ra[0] <= rb[1] && ra[1] >= rb[0]
}
