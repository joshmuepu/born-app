import type { ReactNode } from 'react'
import { extractSearchTerms, type HighlightMode } from '../../shared/searchHighlight'

/**
 * Wrap occurrences of the search terms in `<mark>` so a volunteer can confirm a
 * result contains what they searched for without opening it. `mode` should be
 * the result's own `matchType` when there is one (a sermon quote) — 'phrase'
 * highlights only the exact contiguous phrase; 'all'/'any' highlights each
 * significant word on its own, since no contiguous phrase is guaranteed.
 */
export function highlight(text: string, query: string | undefined, mode: HighlightMode = 'all'): ReactNode {
  const terms = extractSearchTerms(query, mode)
  if (terms.length === 0) return text

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(?<![\\p{L}])(${escaped.join('|')})(?![\\p{L}])`, 'giu')
  const termSet = new Set(terms.map((t) => t.toLowerCase()))

  return text.split(re).map((part, i) =>
    termSet.has(part.toLowerCase())
      ? <mark key={i} className="hl">{part}</mark>
      : part
  )
}

/**
 * A results-list snippet centered on the first match instead of the start of
 * the paragraph — so scanning a result shows why it matched immediately,
 * instead of however many lines of setup came before the match. `moreCount`
 * is how many further matches exist past what's shown, for a "+N more
 * matches" hint.
 */
export function smartSnippet(
  text: string,
  query: string | undefined,
  mode: HighlightMode = 'all',
  maxChars = 240
): { snippet: string; moreCount: number } {
  const terms = extractSearchTerms(query, mode)
  if (terms.length === 0) return { snippet: text, moreCount: 0 }

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(?<![\\p{L}])(${escaped.join('|')})(?![\\p{L}])`, 'giu')
  const matches = [...text.matchAll(re)]
  if (matches.length === 0 || matches[0].index === undefined) {
    return { snippet: text.slice(0, maxChars) + (text.length > maxChars ? '…' : ''), moreCount: 0 }
  }

  const firstIndex = matches[0].index
  let start = Math.max(0, firstIndex - Math.floor(maxChars / 3))
  let end = Math.min(text.length, start + maxChars)
  if (end - start < maxChars) start = Math.max(0, end - maxChars)

  // Trim to whole words so the snippet doesn't open/close mid-word.
  if (start > 0) {
    const nextSpace = text.indexOf(' ', start)
    if (nextSpace !== -1 && nextSpace < end) start = nextSpace + 1
  }
  if (end < text.length) {
    const lastSpace = text.lastIndexOf(' ', end)
    if (lastSpace > start) end = lastSpace
  }

  const moreCount = matches.filter((m) => (m.index ?? 0) >= end).length
  let snippet = text.slice(start, end)
  if (start > 0) snippet = '…' + snippet
  if (end < text.length) snippet = snippet + '…'
  return { snippet, moreCount }
}

/**
 * Which of these slide texts (in order) actually contains the search term —
 * so projecting a search result can open on the page the operator searched
 * for instead of always page 1. Falls back to 0 (the start) if nothing in
 * `texts` matches, which only happens for a stemmed/fuzzy match the plain
 * substring check can't see.
 */
export function findMatchingSlideIndex(texts: string[], query: string | undefined): number {
  const terms = extractSearchTerms(query)
  if (terms.length === 0) return 0

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(?<![\\p{L}])(${escaped.join('|')})(?![\\p{L}])`, 'iu')
  const index = texts.findIndex((t) => re.test(t))
  return index >= 0 ? index : 0
}

/** "63-0825E" → "1963". Branham date codes are all 1930s–1960s. */
export function yearFromDateCode(code: string): string {
  const m = /^(\d{2})/.exec(code ?? '')
  if (!m) return code ?? ''
  const yy = parseInt(m[1], 10)
  return yy >= 30 ? `19${m[1]}` : code
}
