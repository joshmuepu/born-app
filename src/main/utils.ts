/**
 * Pure utility functions shared across main-process modules.
 * Kept here (no Electron deps) so they can be unit-tested in Node.js.
 */

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseParagraphIndex(ref: string): number {
  if (ref === 'header') return 0
  const m = ref.match(/^p(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

/** A book chapter's own structural heading/title line — "CHAPTER THREE",
 *  "THE MESSENGER", "CONCLUSION" — stored by the source as if it were an
 *  ordinary paragraph, indistinguishable by shape except that it's short
 *  and has none of the sentence-ending punctuation a real paragraph
 *  (transcribed speech or edited prose) always has. Verified against every
 *  paragraph of all 11 "An Exposition of the Seven Church Ages" chapters:
 *  118 rows matched, every one a genuine heading, zero real paragraphs
 *  caught. Only meant to run on book-type source content — dated sermons
 *  don't have this problem and shouldn't have their own short paragraphs
 *  second-guessed by it. */
const ENDS_WITH_SENTENCE_PUNCTUATION = /[.!?]["'”’]?\s*$/
export function isHeadingLike(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 60) return false
  return !ENDS_WITH_SENTENCE_PUNCTUATION.test(t)
}

/** Merges a heading-like section into the paragraph that follows it, so it
 *  reads as context atop real content instead of standing alone as its own
 *  quotable, searchable, projectable "paragraph" with nothing under it —
 *  which is exactly what a bare "THE EPHESIAN CHURCH AGE" looks like
 *  live, projected, with nothing else on the screen. Consecutive heading
 *  lines (a chapter title immediately followed by a section title) stack
 *  into one combined prefix on the next real paragraph. */
export function mergeHeadingSections<T extends { text: string }>(sections: T[]): T[] {
  const out: T[] = []
  let pendingHeading = ''
  for (const s of sections) {
    if (isHeadingLike(s.text)) {
      pendingHeading = pendingHeading ? `${pendingHeading}\n${s.text}` : s.text
      continue
    }
    out.push(pendingHeading ? { ...s, text: `${pendingHeading}\n\n${s.text}` } : s)
    pendingHeading = ''
  }
  // A trailing heading with nothing real after it to attach to (shouldn't
  // normally happen) — keep it as its own section rather than silently
  // dropping real content.
  if (pendingHeading) out.push({ text: pendingHeading } as T)
  return out
}
