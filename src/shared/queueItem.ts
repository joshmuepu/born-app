/**
 * queueItem.ts — the service-queue data model, shared by the main and renderer
 * processes. A queue item is one of several content types; every item exposes a
 * flat list of `slides` that the projection window steps through.
 */

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

/** Wrap a bare sermon quote as a one-slide queue item. */
export function quoteToItem(quote: Quote): QuoteItem {
  // Branham sermon text starts with the paragraph number, e.g. "146 But the …".
  // Pull it out so the projection can style it as a marker.
  const m = quote.text.match(/^\s*(\d+(?:[-–]\d+)?)\s+(.*)$/s)
  return {
    kind: 'quote',
    id: makeId('q'),
    quote,
    slides: [
      {
        text: m ? m[2] : quote.text,
        marker: m ? m[1] : quote.paragraphRef || undefined,
        reference: [quote.sermonTitle, quote.dateCode, quote.paragraphRef].filter(Boolean).join(' · ')
      }
    ]
  }
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
