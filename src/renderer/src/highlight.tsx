import type { ReactNode } from 'react'

/** Words too common to be worth highlighting on their own. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'that', 'this',
  'for', 'on', 'as', 'at', 'be', 'by', 'was', 'are', 'with', 'his', 'he', 'i',
  'you', 'not', 'but', 'they', 'them', 'their', 'there', 'from', 'have', 'has'
])

/**
 * Wrap occurrences of the search terms in `<mark>` so a volunteer can confirm a
 * result contains what they searched for without opening it. Highlights the
 * whole phrase and each significant whole word, case-insensitively.
 */
export function highlight(text: string, query: string | undefined): ReactNode {
  const q = (query ?? '').trim()
  if (!q) return text

  const phrase = q.replace(/["*()[\]^:]/g, '').replace(/\s+/g, ' ').trim()
  const words = phrase
    .split(' ')
    .map((t) => t.replace(/["*()[\]^:]/g, '').trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t.toLowerCase()))

  // Phrase first (longest match wins), then the significant single words.
  const terms = Array.from(new Set([phrase.includes(' ') ? phrase : '', ...words].filter(Boolean)))
    .sort((a, b) => b.length - a.length)
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

/** "63-0825E" → "1963". Branham date codes are all 1930s–1960s. */
export function yearFromDateCode(code: string): string {
  const m = /^(\d{2})/.exec(code ?? '')
  if (!m) return code ?? ''
  const yy = parseInt(m[1], 10)
  return yy >= 30 ? `19${m[1]}` : code
}
