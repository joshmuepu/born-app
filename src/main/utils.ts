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

/**
 * One row per paragraph, from The Table's own paragraph marks.
 *
 * The Table returns a sermon as sections (often several numbered paragraphs each: "183-211"). Inside a section every paragraph is its own
 * <p>, and a numbered paragraph carries its number in <span class="pn">. So: a <p> with a number starts that paragraph; a <p> without one
 * continues the paragraph before it, also across sections (the source splits a paragraph there at an interjection); the opening paragraph,
 * whose number is a decorative symbol in the source, takes its section's first number, unless the source numbers that paragraph itself
 * further on (some sermons open with a lettered lead-in, "1b", "1c" …, before their real paragraph 1: the lead-in then stays unnumbered).
 * Words before any numbered paragraph stay as an unnumbered lead-in. The title line ("header") is kept as it is. Every word of every
 * section ends up in exactly one row, in order.
 */
export function paragraphsOfSections(sections: Array<{ ref: string; html: string }>): Array<{ ref: string; index: number; text: string }> {
  const P = /<p\b[^>]*>[\s\S]*?<\/p>/gi
  const PN = /<span class="pn">\s*(\d+)\s*<\/span>/i
  const numberedAnywhere = new Set<string>()
  for (const sec of sections) for (const b of sec.html.match(P) ?? []) { const n = PN.exec(b)?.[1]; if (n) numberedAnywhere.add(n) }
  const out: Array<{ ref: string; text: string }> = []
  let current: { ref: string; text: string } | null = null
  const emitted = new Set<string>()
  for (const sec of sections) {
    if (sec.ref === 'header') { out.push({ ref: 'header', text: stripHtml(sec.html) }); current = null; continue }
    const lo = /^\s*(\d+)/.exec(sec.ref)?.[1] ?? null
    const found = sec.html.match(P)
    const blocks = found ? [...found] : [sec.html]
    if (found) {
      const rest = sec.html.replace(P, ' ')
      if (stripHtml(rest)) blocks.push(rest) // text outside any <p>: kept, after the section's paragraphs
    }
    blocks.forEach((b) => {
      const text = stripHtml(b)
      if (!text) return
      let num = PN.exec(b)?.[1] ?? null
      // the opening paragraph: no number of its own, nothing open yet, and the source does not number it anywhere else
      if (!num && !current && lo && !emitted.has(lo) && !numberedAnywhere.has(lo)) num = lo
      if (num) {
        current = { ref: num, text }
        out.push(current); emitted.add(num)
      } else if (current) {
        current.text = `${current.text} ${text}`
      } else {
        // an unnumbered lead-in before a numbered section (as the source has it; its later parts join it); a section with no numbering at
        // all keeps its own reference
        if (lo) { current = { ref: '', text }; out.push(current) } else out.push({ ref: sec.ref, text })
      }
    })
  }
  return out.map((r, index) => ({ ...r, index }))
}

/** Whether a sermon's paragraph split can be trusted: every numbered paragraph appears once and in order, and the rows hold exactly the
 *  words of the sections. A sermon that fails this keeps the rows the source sections it into. */
export function splitIsSafe(rows: Array<{ ref: string; text: string }>, sections: Array<{ ref: string; html: string }>): boolean {
  const nums = rows.filter((r) => /^\d+$/.test(r.ref)).map((r) => Number(r.ref))
  for (let i = 1; i < nums.length; i++) if (nums[i] <= nums[i - 1]) return false
  const words = (t: string): string => t.replace(/\s+/g, ' ').trim()
  return words(rows.map((r) => r.text).join(' ')) === words(sections.map((s) => stripHtml(s.html)).filter(Boolean).join(' '))
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
