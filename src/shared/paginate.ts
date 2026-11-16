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

// Chinese and Japanese end a sentence or clause with their own full-width marks and no space after them
const SENTENCE_ENDS = ['. ', '? ', '! ', '." ', '?" ', '!" ', '.” ', '?” ', '!” ', '." ', '?" ', '。', '！', '？', '｡', '。」', '！」', '？」', '。”', '！”', '？”']
const CLAUSE_BREAKS = ['; ', ': ', ', ', '— ', '– ', ' — ', '，', '、', '；', '：']

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

/** The largest cut at or before `max` that does not fall inside a character (a surrogate pair) or put a combining mark first on the next page.
 *  Plain string checks, so it does not depend on what the runtime's Intl supports. */
function characterCut(rest: string, max: number): number {
  let at = max
  while (at > 1 && /[\uDC00-\uDFFF\u0300-\u036f\u200d\ufe0f]/.test(rest[at] ?? '')) at--
  return at
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
      characterCut(rest, maxChars) // only if a single "word" is longer than a whole page
    pages.push(rest.slice(0, at).trim())
    rest = rest.slice(at).trim()
  }
  if (rest) pages.push(rest)
  return balanceLast(pages, maxChars)
}

/** A last page this short reads as an orphan on the wall ("Thank you." alone); 12,244 real paragraphs ended like that. */
const ORPHAN_CHARS = 60
const ORPHAN_WORDS = 3

/** Where to cut `text` in two so both halves fit: the break nearest the middle, preferring a sentence end, then a clause break, then a space. */
function cutNearMiddle(text: string, maxChars: number): number | null {
  const mid = text.length / 2
  for (const needles of [SENTENCE_ENDS, CLAUSE_BREAKS, [' ']]) {
    let best: number | null = null
    for (const n of needles) {
      for (let i = text.indexOf(n); i >= 0; i = text.indexOf(n, i + 1)) {
        const at = i + n.length
        if (at > maxChars || text.length - at > maxChars) continue
        if (best === null || Math.abs(at - mid) < Math.abs(best - mid)) best = at
      }
    }
    // a sentence or clause break counts only if it leaves the last page a fair share; otherwise try the next kind
    if (best !== null && Math.min(best, text.length - best) >= ORPHAN_CHARS) return best
  }
  return null
}

/** If the last page is an orphan, share the last two pages' text between them instead (each still fits; nothing is lost or reordered). */
function balanceLast(pages: string[], maxChars: number): string[] {
  if (pages.length < 2) return pages
  const last = pages[pages.length - 1]
  if (last.length >= ORPHAN_CHARS && last.split(' ').length > ORPHAN_WORDS) return pages
  const prev = pages[pages.length - 2]
  // Chinese and Japanese pages were cut without a space; joining them with one would add a space that was never there
  const spaceless = /[\u3000-\u9fff\uff00-\uffef]$/.test(prev) && /^[\u3000-\u9fff\uff00-\uffef]/.test(last)
  const both = spaceless ? `${prev}${last}` : `${prev} ${last}`
  const at = cutNearMiddle(both, maxChars)
  if (at === null) return pages
  return [...pages.slice(0, -2), both.slice(0, at).trim(), both.slice(at).trim()]
}
