/**
 * paginate.ts — split a long block of text into projector-sized pages.
 *
 * A slide only reads well from the back of a room if it holds a limited amount
 * of text; past that the auto-fit shrinks it to an unreadable size. Bible verses
 * and sermon paragraphs both run through this so every page shows at a large
 * font. A page breaks at a sentence end if there's a good one, else a clause
 * break, else a word boundary — never in the middle of a word.
 */

/** Roughly the most text that reads comfortably on a projector at a sane size. */
export const MAX_SLIDE_CHARS = 240

const SENTENCE_ENDS = ['. ', '? ', '! ', '." ', '?" ', '!" ', '.” ', '?” ', '!” ', '." ', '?" ']
const CLAUSE_BREAKS = ['; ', ': ', ', ', '— ', '– ', ' — ']

/** Position where the next page should start: just after the last of `needles`
 *  that ends at or beyond `min`. Null if there isn't one. */
function cutAfter(win: string, needles: string[], min: number): number | null {
  let best = -1
  for (const n of needles) {
    const i = win.lastIndexOf(n)
    if (i >= 0 && i + n.length >= min) best = Math.max(best, i + n.length)
  }
  return best >= 0 ? best : null
}

/** Position just after the last space at or beyond `min`. Null if there isn't one. */
function cutAtSpace(win: string, min: number): number | null {
  const i = win.lastIndexOf(' ')
  return i >= min ? i + 1 : null
}

export function paginateText(text: string, maxChars: number = MAX_SLIDE_CHARS): string[] {
  const trimmed = (text ?? '').replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxChars) return trimmed ? [trimmed] : []

  const pages: string[] = []
  let rest = trimmed
  while (rest.length > maxChars) {
    const win = rest.slice(0, maxChars + 1)
    const min = Math.floor(maxChars * 0.5) // don't leave a tiny page behind
    const at =
      cutAfter(win, SENTENCE_ENDS, min) ??
      cutAfter(win, CLAUSE_BREAKS, min) ??
      cutAtSpace(win, min) ??
      cutAtSpace(win, 1) ?? // any space beats splitting a word
      maxChars // only if a single "word" is longer than a whole page
    pages.push(rest.slice(0, at).trim())
    rest = rest.slice(at).trim()
  }
  if (rest) pages.push(rest)
  return pages
}
