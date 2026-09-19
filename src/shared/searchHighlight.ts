/**
 * searchHighlight.ts — term-matching shared by the desktop app's own result
 * highlighting (highlight.tsx builds React nodes from it) and the web
 * remote's server-side HTML highlighting (main/index.ts calls
 * highlightToHtml directly). One extraction function, so what counts as "the
 * searched term" never drifts between the two.
 */

/** Words too common to be worth highlighting on their own. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'that', 'this',
  'for', 'on', 'as', 'at', 'be', 'by', 'was', 'are', 'with', 'his', 'he', 'i',
  'you', 'not', 'but', 'they', 'them', 'their', 'there', 'from', 'have', 'has'
])

/** The significant search terms in a query — the whole phrase (if multi-word)
 *  plus each word worth matching on its own, longest first. */
export function extractSearchTerms(query: string | undefined): string[] {
  const q = (query ?? '').trim()
  if (!q) return []

  const phrase = q.replace(/["*()[\]^:]/g, '').replace(/\s+/g, ' ').trim()
  const words = phrase
    .split(' ')
    .map((t) => t.replace(/["*()[\]^:]/g, '').trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t.toLowerCase()))

  // Phrase first (longest match wins), then the significant single words.
  return Array.from(new Set([phrase.includes(' ') ? phrase : '', ...words].filter(Boolean)))
    .sort((a, b) => b.length - a.length)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Plain text -> HTML-safe string with the search terms wrapped in <mark>,
 * for a plain (non-React) HTML consumer — the web remote's server-rendered
 * search results. Escapes everything else, so the result is always safe to
 * insert as innerHTML.
 */
export function highlightToHtml(text: string, query: string | undefined): string {
  const terms = extractSearchTerms(query)
  if (terms.length === 0) return escapeHtml(text)

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(?<![\\p{L}])(${escaped.join('|')})(?![\\p{L}])`, 'giu')
  const termSet = new Set(terms.map((t) => t.toLowerCase()))

  return text
    .split(re)
    .map((part) => (termSet.has(part.toLowerCase()) ? `<mark class="hl">${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join('')
}
