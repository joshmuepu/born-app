/**
 * tapeParagraphs.ts — the unit a tape is synchronised to is the NUMBERED PARAGRAPH, not a database row. About two thirds of the
 * sermon rows are ranges ("41-47") that hold several numbered paragraphs inline, and the reader, the projector and the phone all
 * already split them with quoteToItem()/splitSubParagraphs(). This module reads that same split, so a sync map always agrees with what
 * the operator sees on screen.
 */
import type { Quote } from './queueItem'
import { quoteToItem } from './queueItem'

export interface NumberedParagraph {
  /** the paragraph number (1, 2, 3…); a heading row that carries no number takes 0 and is attached to the next number */
  n: number
  /** the text of the whole paragraph (pages joined) */
  text: string
  /** the pages the projector would show for it, in order (a long paragraph is several) */
  pages: string[]
  /** the row reference the first page came from (for projecting it the normal way) */
  paragraphRef: string
  /** the reader's markers for each page ("14", "14a", "14b") */
  markers: string[]
}

/** Group a sermon's rows into numbered paragraphs (in reading order). Rows without a number are headings: they are kept with the next paragraph. */
export function numberedParagraphs(rows: Quote[]): NumberedParagraph[] {
  const out: NumberedParagraph[] = []
  let pending: string[] = []
  for (const q of rows) {
    const slides = quoteToItem(q).slides
    for (const s of slides) {
      const marker = s.marker ?? q.paragraphRef
      const m = /^\s*(\d+)/.exec(marker)
      if (!m) {
        // a heading ("header" rows, no number): keep with the following paragraph
        if (s.text.trim()) pending.push(s.text.trim())
        continue
      }
      const n = parseInt(m[1], 10)
      const last = out[out.length - 1]
      if (last && last.n === n) {
        last.pages.push(s.text)
        last.text += ' ' + s.text
        last.markers.push(marker)
      } else {
        out.push({ n, text: s.text, pages: [s.text], paragraphRef: s.paragraphRef ?? q.paragraphRef, markers: [marker] })
        if (pending.length) pending = []
      }
    }
  }
  return out
}

/** The paragraph numbers in `text` that `map` does not have, and the other way round — used to warn when a translation numbers differently. */
export function numberAgreement(textNumbers: number[], mapNumbers: number[]): { textOnly: number[]; mapOnly: number[]; common: number; ok: boolean } {
  const T = new Set(textNumbers), M = new Set(mapNumbers)
  const textOnly = textNumbers.filter((n) => !M.has(n))
  const mapOnly = mapNumbers.filter((n) => !T.has(n))
  let common = 0
  for (const n of T) if (M.has(n)) common++
  return { textOnly, mapOnly, common, ok: textOnly.length === 0 && mapOnly.length === 0 }
}
