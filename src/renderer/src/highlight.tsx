import type { ReactNode } from 'react'
import { extractSearchTerms } from '../../shared/searchHighlight'

/**
 * Wrap occurrences of the search terms in `<mark>` so a volunteer can confirm a
 * result contains what they searched for without opening it. Highlights the
 * whole phrase and each significant whole word, case-insensitively.
 */
export function highlight(text: string, query: string | undefined): ReactNode {
  const terms = extractSearchTerms(query)
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
