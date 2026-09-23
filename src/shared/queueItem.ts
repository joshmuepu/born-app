/**
 * queueItem.ts — the service-queue data model, shared by the main and renderer
 * processes. A queue item is one of several content types; every item exposes a
 * flat list of `slides` that the projection window steps through.
 */
import { paginateText } from './paginate'
import { parseParagraphRef } from './paragraphRef'

export interface Quote {
  text: string
  sermonTitle: string
  dateCode: string
  sermonId: number
  paragraphIndex: number
  paragraphRef: string
  language?: string
  /** Which match actually produced this row — lets highlighting show only the
   *  exact phrase for a true phrase match, vs. every significant word when
   *  the row came from an all/any-word (or a phrase-search fallback) match. */
  matchType?: 'phrase' | 'all' | 'any'
}

export interface Slide {
  /** The text shown on screen for this slide. */
  text: string
  /** Optional small heading, e.g. "Chorus" for a song section. */
  label?: string
  /** Optional citation line, e.g. "John 3:16 · KJV". */
  reference?: string
  /** Small number shown at the start of the text — verse number, paragraph number. */
  marker?: string
}

interface QueueItemBase {
  /** Stable id for React keys and reorder maths. */
  id: string
  slides: Slide[]
}

export interface QuoteItem extends QueueItemBase {
  kind: 'quote'
  quote: Quote
}

export interface BibleItem extends QueueItemBase {
  kind: 'bible'
  translation: string
  reference: string
  bookNum: number
  chapter: number
  verseStart: number
  verseEnd: number
}

export interface SongItem extends QueueItemBase {
  kind: 'song'
  songId: number
  title: string
  author?: string
}

export type QueueItem = QuoteItem | BibleItem | SongItem

let idCounter = 0
/** Cheap unique id — good enough for in-memory queue rows. */
export function makeId(prefix = 'item'): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

/** Inline paragraph numbers sit after a sentence-ish boundary, before a
 *  capital letter or quote — e.g. "…while we pray? 174 Father, bless…". */
const INLINE_PARAGRAPH_START = /(?:^|[.?!"'”’)\]\s])(\d{1,3})(?=\s+["'“‘A-Z])/g

/**
 * A Branham "paragraph" row is often a numbered *range* ("173-174") with the
 * sub-paragraph numbers written inline in one combined block of text. Split
 * it into one chunk per source paragraph *before* pagination, so a slide
 * never mixes two paragraphs together (the projected slide has to open
 * exactly on the paragraph a search matched, not somewhere above it).
 *
 * Only ever accepts the next sequential number as a real boundary — a
 * coincidental number elsewhere in the text (a street address, a count)
 * can't be mistaken for one, because it has to match the *specific* value
 * `current + 1` at the point it's found. If a transition is never found
 * (rare — a paragraph that doesn't open with a capital letter, say), that
 * one boundary just doesn't split — the same combined-text behavior as
 * before the fix, not a broken split.
 */
function splitSubParagraphs(body: string, lo: number, hi: number): Array<{ num: number; text: string }> {
  if (hi <= lo) return [{ num: lo, text: body }]

  const boundaries: Array<{ index: number; num: number }> = []
  let current = lo
  INLINE_PARAGRAPH_START.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_PARAGRAPH_START.exec(body)) !== null) {
    const n = parseInt(match[1], 10)
    if (n === current + 1 && n <= hi) {
      boundaries.push({ index: match.index + (match[0].length - match[1].length), num: n })
      current = n
    }
  }
  if (boundaries.length === 0) return [{ num: lo, text: body }]

  const parts: Array<{ num: number; text: string }> = []
  let cursor = 0
  let num = lo
  for (const b of boundaries) {
    parts.push({ num, text: body.slice(cursor, b.index).trim() })
    cursor = b.index
    num = b.num
  }
  parts.push({ num, text: body.slice(cursor).trim() })

  // Each part after the first still has its own leading number as literal
  // text ("174 Father…") — lift it out; it's shown separately as `marker`.
  return parts
    .map((p) => {
      const lead = /^(\d{1,3})\s+([\s\S]*)$/.exec(p.text)
      return lead && parseInt(lead[1], 10) === p.num ? { num: p.num, text: lead[2] } : p
    })
    .filter((p) => p.text.length > 0)
}

/**
 * Wrap a bare sermon quote as a queue item. A Branham paragraph is far too long
 * to read from the back of a room on one slide, so it's split into
 * projector-sized pages (like Bible verses); Next steps through the pages.
 */
/** Real paragraph numbers ("26", "41-47") are shown; synthetic ("§123") and
 *  structural ("header") refs are hidden from the marker + citation. */
function displayRef(ref: string): string {
  const r = (ref ?? '').trim()
  if (!r || r.startsWith('§') || !/\d/.test(r)) return ''
  return r
}

export function quoteToItem(quote: Quote): QuoteItem {
  // Sermon text starts with the paragraph number, e.g. "146 But the …".
  const m = quote.text.match(/^\s*(\d+(?:[-–]\d+)?)\s+(.*)$/s)
  const leadMarker = m ? m[1] : displayRef(quote.paragraphRef) || undefined
  const body = m ? m[2] : quote.text
  const cite = (ref: string): string =>
    [quote.sermonTitle, quote.dateCode, displayRef(ref)].filter(Boolean).join(' · ')

  const range = parseParagraphRef(quote.paragraphRef)
  // Only split when the row's own leading number and its paragraphRef agree
  // it's a real numbered paragraph — a structural/synthetic ref ("header",
  // "§123") never has sub-paragraphs to find.
  const subParagraphs: Array<{ num: number | null; text: string }> =
    range && leadMarker && /^\d+$/.test(leadMarker)
      ? splitSubParagraphs(body, range[0], range[1])
      : [{ num: null, text: body }]

  const slides: Slide[] = []
  subParagraphs.forEach((sub, subIdx) => {
    const pages = paginateText(sub.text)
    const pageTexts = pages.length > 0 ? pages : [sub.text]
    // A split paragraph gets an a/b/c suffix on every page (including the
    // first), same convention as a long Bible verse — "26a", "26b", ….
    pageTexts.forEach((text, i) => {
      const suffix = pageTexts.length > 1 ? String.fromCharCode(97 + i) : ''
      const num = sub.num !== null ? String(sub.num) : subIdx === 0 ? leadMarker : undefined
      const refValue = sub.num !== null ? String(sub.num) : quote.paragraphRef
      slides.push({
        text,
        reference: cite(`${refValue}${suffix}`),
        marker: num ? `${num}${suffix}` : undefined
      })
    })
  })

  if (slides.length === 0) {
    return {
      kind: 'quote',
      id: makeId('q'),
      quote,
      slides: [{ text: body, reference: cite(quote.paragraphRef), marker: leadMarker }]
    }
  }
  return { kind: 'quote', id: makeId('q'), quote, slides }
}

/**
 * Migrate a persisted queue (old format was `Quote[]`, new format is
 * `QueueItem[]`). Anything already shaped like a QueueItem passes through.
 */
export function migrateQueue(raw: unknown): QueueItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry): QueueItem | null => {
      if (entry && typeof entry === 'object' && 'kind' in entry && Array.isArray((entry as QueueItem).slides)) {
        const item = entry as QueueItem
        return item.id ? item : { ...item, id: makeId(item.kind) }
      }
      if (entry && typeof entry === 'object' && 'text' in entry && 'sermonId' in entry) {
        return quoteToItem(entry as Quote)
      }
      return null
    })
    .filter((x): x is QueueItem => x !== null)
}

/** Short label for a queue row / stage view. */
export function itemTitle(item: QueueItem): string {
  switch (item.kind) {
    case 'quote':
      return item.quote.sermonTitle || item.quote.dateCode
    case 'bible':
      return `${item.reference} · ${item.translation}`
    case 'song':
      return item.title
  }
}
