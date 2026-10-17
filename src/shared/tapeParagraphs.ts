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

/** The paragraph number a reader marker belongs to: "14" and "14a" and "14b" are all paragraph 14; "header" has none. */
export function baseNumber(marker: string | undefined | null): number | null {
  const m = /^\s*(\d+)/.exec(marker ?? '')
  return m ? parseInt(m[1], 10) : null
}

/**
 * Where in the reader's flat list (one card per PAGE of a paragraph) the tape is: the card for paragraph `n`, and — when the paragraph is long
 * enough to be several pages — the page the tape is up to, by how far through the paragraph it is. -1 when `n` is not in the list.
 */
export function flatIndexFor(markers: Array<string | undefined>, n: number | null, progress: number | null): number {
  if (n === null) return -1
  const idx: number[] = []
  markers.forEach((mk, i) => { if (baseNumber(mk) === n) idx.push(i) })
  if (idx.length === 0) return -1
  const k = progress === null ? 0 : Math.min(idx.length - 1, Math.floor(Math.max(0, Math.min(0.999999, progress)) * idx.length))
  return idx[k]
}

/** One page of a numbered paragraph, as the screens show it. */
export interface ScreenItem { n: number; marker: string; text: string }

/** A sermon's rows as the screens' items: every PAGE of every numbered paragraph (headings, which have no number, are left out). Same split the reader and projector use. */
export function screenItemsOf(rows: Quote[]): ScreenItem[] {
  const out: ScreenItem[] = []
  for (const q of rows) {
    for (const sl of quoteToItem(q).slides) {
      const marker = sl.marker ?? q.paragraphRef
      const n = baseNumber(marker)
      if (n !== null && sl.text.trim()) out.push({ n, marker, text: sl.text })
    }
  }
  return out
}
