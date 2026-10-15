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
  /** Quote slides only: the exact source paragraph this slide's text came
   *  from. A quote's own `paragraphRef` can be a merged range ("173-174")
   *  that this slide only covers part of (see splitSubParagraphs below), or
   *  flow-through (liveNav.ts) can append a slide from an entirely different
   *  paragraph — so a follow channel resolving content for this slide must
   *  use this, not the parent item's `quote.paragraphRef`. */
  paragraphRef?: string
  /** Quote slides only: which projector-sized page of `paragraphRef`'s own
   *  text this slide shows (0 for the first/only page, 1 for "b", …) — a
   *  long paragraph splits into several slides same as a long Bible verse,
   *  and a follow channel needs to know which page to show, not just which
   *  paragraph. */
  page?: number
}

/** Which remote contributor added an item — absent for anything added
 *  directly on the desktop. `deviceId` is the durable identity (generated
 *  once per phone, stored in that phone's own localStorage); `label` is the
 *  human-facing name shown in the operator's grouped queue view. Grouping
 *  is by `label` (two phones both called "Song Leader" read as one group),
 *  but a mid-service re-send only ever replaces items from the same
 *  `deviceId`, never just a matching label. */
export interface QueueSource {
  deviceId: string
  label: string
}

interface QueueItemBase {
  /** Stable id for React keys and reorder maths. */
  id: string
  slides: Slide[]
  source?: QueueSource
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

/**
 * Media (images and slideshows — Phase 1a). Saved to `.born` only as a *compat
 * shell* (see serializeItem) so an older BORN reads it as a harmless quote row
 * instead of crashing. `slides` stays empty until the media output exists.
 */
export type MediaKind = 'image' | 'slideshow'
export interface MediaItem extends QueueItemBase {
  kind: 'media'
  mediaId: string
  mediaKind: MediaKind
  name: string
  /** Unknown `ext` fields from a newer writer, carried through a save unchanged. */
  _ext?: Record<string, unknown>
  /** Unknown top-level fields on the shell, carried through unchanged. */
  _top?: Record<string, unknown>
}

/**
 * An item this version cannot use: written by a newer BORN (`reason: 'newer'`)
 * or damaged (`'malformed'`). It is shown as a clearly labelled, non-projectable
 * row and written back to disk exactly as it was read (`raw`), so opening and
 * re-saving a file never loses what a newer version put in it.
 */
export interface UnknownItem extends QueueItemBase {
  kind: 'unknown'
  reason: 'newer' | 'malformed'
  label: string
  raw: unknown
}

export type QueueItem = QuoteItem | BibleItem | SongItem | MediaItem | UnknownItem

export const NEWER_VERSION_LABEL = 'Made by a newer version of BORN'
export const UNREADABLE_LABEL = "Couldn't read this item"

let idCounter = 0
/** Cheap unique id — good enough for in-memory queue rows. */
export function makeId(prefix = 'item'): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

/** Inline paragraph numbers sit after a sentence-ish boundary, before a
 *  capital letter, quote, bracketed aside, ellipsis, or another digit (a
 *  transcript opening with "21st verse…") — e.g. "…while we pray? 174
 *  Father, bless…", or "…that church. 53 (Got your pencil?) Now…". Confirmed
 *  against the real database: real transcripts commonly open a paragraph
 *  with an editorial bracket/parenthetical rather than straight into prose,
 *  and the original narrower set (quote or capital letter only) silently
 *  dropped those as boundaries — worse, since matching is strictly
 *  sequential (see splitSubParagraphs below), missing one boundary cascaded
 *  into skipping every later one in the same quote too. */
const INLINE_PARAGRAPH_START = /(?:^|[.?!"'”’)\]\s])(\d{1,3})(?=\s+["'“‘(\[…A-Z0-9])/g

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
export function splitSubParagraphs(body: string, lo: number, hi: number): Array<{ num: number; text: string }> {
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
  // Only split when paragraphRef itself is a real numbered (range), never a
  // structural/synthetic ref ("header", "§123") — parseParagraphRef already
  // returns null for both of those, so range alone is the correct, complete
  // gate. It used to ALSO require quote.text's own leading number to be a
  // clean, bare digit string (leadMarker) matching /^\d+$/ — but a genuine
  // range like "91-92" makes leadMarker fall back to the hyphenated ref
  // itself ("91-92"), which fails that check and silently skipped splitting
  // real multi-paragraph quotes entirely. Confirmed against the real
  // database: ~2,300 rows (including the opening paragraph of roughly half
  // of all sermons, whose "1" is rendered as a decorative glyph instead of
  // a literal digit) were never being split because of this redundant
  // check — splitSubParagraphs doesn't need body to start with `lo`'s own
  // marker anyway, only to find lo+1's.
  const subParagraphs: Array<{ num: number | null; text: string }> = range
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
        marker: num ? `${num}${suffix}` : undefined,
        paragraphRef: refValue,
        page: i
      })
    })
  })

  if (slides.length === 0) {
    return {
      kind: 'quote',
      id: makeId('q'),
      quote,
      slides: [
        {
          text: body,
          reference: cite(quote.paragraphRef),
          marker: leadMarker,
          paragraphRef: quote.paragraphRef
        }
      ]
    }
  }
  return { kind: 'quote', id: makeId('q'), quote, slides }
}

/** Version of the `ext` envelope this build writes and understands. */
export const EXT_VERSION = 1

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => x !== null && typeof x === 'object' && !Array.isArray(x)
const validSlides = (x: unknown): x is Slide[] =>
  Array.isArray(x) && x.every((sl) => isObj(sl) && typeof sl.text === 'string')

function unknownItem(raw: unknown, reason: 'newer' | 'malformed'): UnknownItem {
  const o = isObj(raw) ? raw : {}
  const src = o.source
  const source =
    isObj(src) && typeof src.deviceId === 'string' && typeof src.label === 'string'
      ? { deviceId: src.deviceId, label: src.label }
      : undefined
  return {
    kind: 'unknown',
    id: typeof o.id === 'string' && o.id ? o.id : makeId('unk'),
    slides: [],
    source,
    reason,
    label: reason === 'newer' ? NEWER_VERSION_LABEL : UNREADABLE_LABEL,
    raw
  }
}

/** The smallest shape each known kind needs so nothing downstream can throw. */
function knownShapeOk(kind: string, e: Obj): boolean {
  if (!validSlides(e.slides)) return false
  if (kind === 'quote') return isObj(e.quote) && typeof e.quote.text === 'string'
  if (kind === 'bible') return typeof e.reference === 'string' && typeof e.translation === 'string'
  if (kind === 'song') return typeof e.songId === 'number' && typeof e.title === 'string'
  return false
}

/** `ext.kind` values this build can promote back into a real item. */
const EXT_READERS: Record<string, (e: Obj, ext: Obj) => QueueItem | null> = {
  media: (e, ext) => {
    if (typeof ext.mediaId !== 'string' || !ext.mediaId) return null
    if (ext.mediaKind !== 'image' && ext.mediaKind !== 'slideshow') return null
    const { v: _v, kind: _k, mediaId, mediaKind, name, ...extra } = ext
    const { kind: _kk, id, slides: _s, quote: _q, ext: _e, source, ...top } = e
    return {
      kind: 'media',
      id: typeof id === 'string' && id ? id : makeId('media'),
      slides: [],
      source: source as MediaItem['source'],
      mediaId,
      mediaKind,
      name: typeof name === 'string' ? name : 'Media',
      ...(Object.keys(extra).length ? { _ext: extra } : {}),
      ...(Object.keys(top).length ? { _top: top } : {})
    }
  }
}

/**
 * Turn one persisted entry into a QueueItem. Never throws and never drops an
 * entry: anything this version cannot use becomes an UnknownItem that keeps the
 * original JSON, so a damaged or newer-format item is visible, harmless, and
 * survives a save.
 */
export function normalizeQueueEntry(entry: unknown): QueueItem {
  if (!isObj(entry)) return unknownItem(entry, 'malformed')

  // The envelope a newer BORN writes for item kinds older builds don't know.
  if (isObj(entry.ext) && typeof entry.ext.kind === 'string') {
    const ext = entry.ext
    const extKind = ext.kind as string
    const reader = Object.prototype.hasOwnProperty.call(EXT_READERS, extKind) ? EXT_READERS[extKind] : undefined
    if (reader && Number.isInteger(ext.v) && (ext.v as number) <= EXT_VERSION) {
      const item = reader(entry, ext)
      return item ?? unknownItem(entry, 'malformed')
    }
    return unknownItem(entry, 'newer')
  }

  if (typeof entry.kind === 'string') {
    if (entry.kind === 'quote' || entry.kind === 'bible' || entry.kind === 'song') {
      if (!knownShapeOk(entry.kind, entry)) return unknownItem(entry, 'malformed')
      const item = entry as unknown as QueueItem
      return item.id ? item : ({ ...item, id: makeId(item.kind) } as QueueItem)
    }
    return unknownItem(entry, 'newer')
  }

  // Oldest format: a bare Quote.
  if ('text' in entry && 'sermonId' in entry) return quoteToItem(entry as unknown as Quote)
  return unknownItem(entry, 'malformed')
}

/**
 * Migrate a persisted queue (old format was `Quote[]`, new format is
 * `QueueItem[]`). Every entry yields an item — see normalizeQueueEntry.
 */
export function migrateQueue(raw: unknown): QueueItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeQueueEntry)
}

/** Can this item go on a screen in this build? (Unknown items and, until the
 *  media output exists, media items cannot.) */
export function isProjectable(item: QueueItem): boolean {
  if (item.kind === 'unknown' || item.kind === 'media') return false
  return item.slides.length > 0
}

/** What a queue row says when `isProjectable` is false. */
export function unprojectableReason(item: QueueItem): string | null {
  if (item.kind === 'unknown') return item.label
  if (item.kind === 'media') return 'Media is not available in this build yet'
  return item.slides.length === 0 ? 'Nothing to show' : null
}

/**
 * The persisted shape of one item. Known kinds are written as they are.
 * Newer kinds are written as a *compat shell*: an ordinary `quote` row an
 * older BORN can open, step over and re-save (and which reads as a clear
 * warning), carrying the real data in `ext`. Unknown items are written back
 * exactly as they were read.
 */
export function serializeItem(item: QueueItem): unknown {
  if (item.kind === 'unknown') return item.raw
  if (item.kind === 'media') {
    const text = `${item.name} — ${item.mediaKind === 'slideshow' ? 'slideshow' : 'picture'} (${NEWER_VERSION_LABEL.toLowerCase()})`
    return {
      ...(item._top ?? {}),
      kind: 'quote',
      id: item.id,
      slides: [{ text }],
      quote: {
        text,
        sermonTitle: `${item.name} (needs a newer BORN)`,
        dateCode: '',
        sermonId: -1,
        paragraphIndex: 0,
        paragraphRef: ''
      },
      ...(item.source ? { source: item.source } : {}),
      ext: { ...(item._ext ?? {}), v: EXT_VERSION, kind: 'media', mediaId: item.mediaId, mediaKind: item.mediaKind, name: item.name }
    }
  }
  return item
}

export function serializeQueue(items: QueueItem[]): unknown[] {
  return items.map(serializeItem)
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
    case 'media':
      return item.name
    case 'unknown':
      return item.label
    default:
      return 'Unknown item'
  }
}
