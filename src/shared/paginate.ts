/**
 * paginate.ts — split a long block of text into projector-sized pages.
 *
 * A slide only reads well from the back of a room if it holds a limited amount
 * of text; past that the auto-fit shrinks it to an unreadable size. Bible verses
 * and sermon paragraphs both run through this so every page shows at a large
 * font. Splits are made at sentence ends first, then clause breaks, then spaces.
 */

/** Roughly the most text that reads comfortably on a projector at a sane size. */
export const MAX_SLIDE_CHARS = 240

function lastIndexOfAny(s: string, needles: string[]): number | null {
  let best = -1
  for (const n of needles) {
    const i = s.lastIndexOf(n)
    if (i > best) best = i + n.length - 1
  }
  return best >= 0 ? best : null
}

export function paginateText(text: string, maxChars: number = MAX_SLIDE_CHARS): string[] {
  const trimmed = (text ?? '').trim()
  if (trimmed.length <= maxChars) return trimmed ? [trimmed] : []

  const pages: string[] = []
  let rest = trimmed
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars)
    const cut =
      lastIndexOfAny(window, ['. ', '? ', '! ', '." ', '?" ', '!" ']) ??
      lastIndexOfAny(window, ['; ', ', ', ': ', '— ', ' — ']) ??
      window.lastIndexOf(' ')
    // Don't accept a break so early it leaves a tiny page.
    const at = cut && cut > maxChars * 0.45 ? cut : maxChars
    pages.push(rest.slice(0, at + 1).trim())
    rest = rest.slice(at + 1).trim()
  }
  if (rest) pages.push(rest)
  return pages
}
