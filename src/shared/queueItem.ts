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

/**
 * A Branham "paragraph" is often a numbered *range* ("41-47") with the
 * sub-paragraph numbers written inline in the text. Once that range is split
 * into pages, work out which number(s) each page actually shows, so the
 * on-screen citation reads "· 6" rather than "· 5-6" when you're only on 6.
 */
function pageParagraphRefs(pages: string[], paragraphRef: string): string[] {
  const range = /^\s*(\d+)\s*[-–]\s*(\d+)\s*$/.exec(paragraphRef || '')
  if (!range) return pages.map(() => paragraphRef)
  const hi = parseInt(range[2], 10)
  let current = parseInt(range[1], 10)
  return pages.map((page) => {
    const start = current
    // Inline numbers sit after a sentence-ish boundary, before a capital or
    // quote. Only ever accept the next sequential number.
    const re = /(?:^|[.?!"'”’)\]\s])(\d{1,3})(?=\s+["'“‘A-Z])/g
    let match: RegExpExecArray | null
    while ((match = re.exec(page)) !== null) {
      const n = parseInt(match[1], 10)
      if (n === current + 1 && n <= hi) current = n
    }
    return start === current ? String(start) : `${start}-${current}`
  })
}

/**
 * Wrap a bare sermon quote as a queue item. A Branham paragraph is far too long
 * to read from the back of a room on one slide, so it's split into
 * projector-sized pages (like Bible verses); Next steps through the pages.
 */
export function quoteToItem(quote: Quote): QuoteItem {
  // Sermon text starts with the paragraph number, e.g. "146 But the …".
  const m = quote.text.match(/^\s*(\d+(?:[-–]\d+)?)\s+(.*)$/s)
  const marker = m ? m[1] : quote.paragraphRef || undefined
  const body = m ? m[2] : quote.text
  const cite = (ref: string): string =>
    [quote.sermonTitle, quote.dateCode, ref].filter(Boolean).join(' · ')

  const pages = paginateText(body)
  if (pages.length === 0) {
    return {
      kind: 'quote',
      id: makeId('q'),
      quote,
      slides: [{ text: body, reference: cite(quote.paragraphRef), marker }]
    }
  }
  const pageRefs = pageParagraphRefs(pages, quote.paragraphRef)
  const range = parseParagraphRef(quote.paragraphRef)
  const slides: Slide[] = pages.map((text, i) => {
    // A page can open on an inline sub-paragraph number ("147 And now…"); lift
    // it out so it shows as the marker, not doubled up in the body.
    let body = text
    let mk = i === 0 ? marker : undefined
    const lead = /^(\d{1,3})\s+([\s\S]*)$/.exec(text)
    if (lead && range) {
      const n = parseInt(lead[1], 10)
      if (n >= range[0] && n <= range[1]) {
        mk = lead[1]
        body = lead[2]
      }
    }
    if (!mk && i > 0 && /^\d/.test(pageRefs[i])) mk = pageRefs[i].split(/[-–]/)[0]
    return { text: body, reference: cite(pageRefs[i]), marker: mk }
  })
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
