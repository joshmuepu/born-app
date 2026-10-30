/**
 * sermonHit.ts — a sermon search result is ONE numbered paragraph.
 *
 * A stored row of the sermon library is often a numbered RANGE ("183-211") with the paragraph numbers written inline. Showing the whole row
 * as the result made the operator scroll through several paragraphs to reach the one with the searched words, and "+ Queue" queued the whole
 * range from its first paragraph. This cuts the row into its paragraphs (the same split the projector uses) and keeps the ones that contain
 * the search terms. The stored text and the search index are not touched.
 */
import { splitSubParagraphs, type Quote } from './queueItem'
import { parseParagraphRef } from './paragraphRef'
import { extractSearchTerms, type HighlightMode } from './searchHighlight'

const LEAD = /^\s*\d+(?:[-–]\d+)?\s+/

function partsOf<Q extends Pick<Quote, 'text' | 'paragraphRef'>>(q: Q): Array<{ num: number; text: string }> | null {
  const range = parseParagraphRef(q.paragraphRef)
  if (!range || range[1] <= range[0]) return null
  const parts = splitSubParagraphs(q.text.replace(LEAD, ''), range[0], range[1])
  return parts.length > 1 ? parts : null
}

const narrowed = <Q extends Pick<Quote, 'text' | 'paragraphRef'>>(q: Q, p: { num: number; text: string }): Q => ({ ...q, paragraphRef: String(p.num), text: `${p.num} ${p.text}` })

/** Whole-word, case-insensitive (the same rule the results list uses to mark the words). */
function matcher(terms: string[]): RegExp {
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`(?<![\\p{L}])(${escaped.join('|')})(?![\\p{L}])`, 'iu')
}

/** The paragraphs of a result row that contain the query's terms, each as its own quote; the row itself when it cannot be narrowed. */
export function hitParagraphs<Q extends Pick<Quote, 'text' | 'paragraphRef'>>(q: Q, query: string, mode: HighlightMode): Q[] {
  const parts = partsOf(q)
  if (!parts) return [q]
  const terms = extractSearchTerms(query, mode)
  if (terms.length === 0) return [q]
  const re = matcher(terms)
  const hits = parts.filter((p) => re.test(p.text))
  return hits.length > 0 ? hits.map((p) => narrowed(q, p)) : [q]
}
