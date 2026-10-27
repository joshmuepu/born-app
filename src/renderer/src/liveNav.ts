/**
 * liveNav.ts — "keep pressing Next" flow-through.
 *
 * A queue item is only a starting point. Once it's on screen, Next / Prev walk
 * the *source* — the next paragraph of that sermon, the next verse of that
 * chapter (rolling into the next chapter) — even for text that was never queued.
 * Jumping to another queue item is a deliberate click, never a side effect of
 * Next.
 */
import type { QueueItem, Slide } from '../../shared/queueItem'
import { quoteToItem } from '../../shared/queueItem'
import { parseParagraphRef } from '../../shared/paragraphRef'
import type { Quote } from './types'

export type FlowCursor =
  | { kind: 'quote'; sermonId: number; language: string; paragraphRef: string; page: number }
  | { kind: 'bible'; translation: string; bookNum: number; chapter: number; verse: number }

/** The source position of the first and last currently-loaded slide. */
export interface FlowCursors {
  head?: FlowCursor
  tail?: FlowCursor
}

/** Initial cursors for a freshly-projected item. Songs get none (no flow-through). */
export function cursorsFor(item: QueueItem): FlowCursors {
  if (item.kind === 'quote') {
    const base = {
      kind: 'quote' as const,
      sermonId: item.quote.sermonId,
      language: item.quote.language || 'en',
      paragraphRef: item.quote.paragraphRef
    }
    return {
      head: { ...base, page: 0 },
      tail: { ...base, page: Math.max(0, item.slides.length - 1) }
    }
  }
  if (item.kind === 'bible') {
    return {
      head: { kind: 'bible', translation: item.translation, bookNum: item.bookNum, chapter: item.chapter, verse: item.verseStart },
      tail: { kind: 'bible', translation: item.translation, bookNum: item.bookNum, chapter: item.chapter, verse: item.verseEnd }
    }
  }
  return {}
}

type SermonCache = Map<number, Quote[]>

/**
 * Fetch the slide just past `cursor` in the given direction, plus the cursor
 * that now sits at that edge. Returns null at the start/end of the source.
 */
export async function fetchAdjacentSlide(
  cursor: FlowCursor | undefined,
  dir: 'next' | 'prev',
  sermonCache: SermonCache
): Promise<{ slide: Slide; cursor: FlowCursor } | null> {
  if (!cursor) return null
  const step = dir === 'next' ? 1 : -1

  if (cursor.kind === 'quote') {
    // paragraphIndex isn't reliably populated; the array order from
    // getSermonParagraphs is the source of truth, keyed by paragraphRef.
    let paras = sermonCache.get(cursor.sermonId)
    if (!paras) {
      paras = (await window.electronAPI.getSermonParagraphs(cursor.sermonId, cursor.language)) || []
      sermonCache.set(cursor.sermonId, paras)
    }
    const pos = paras.findIndex((p) => p.paragraphRef === cursor.paragraphRef)
    if (pos === -1) {
      // an item saved before the library was stored one row per paragraph keeps its range ("11-12"): carry on from the paragraph at the
      // end it is leaving from (the last one for Next, the first for Back), at that paragraph's last or first page
      const range = parseParagraphRef(cursor.paragraphRef)
      if (range && range[1] > range[0]) {
        const edge = String(dir === 'next' ? range[1] : range[0])
        const row = paras.find((p) => p.paragraphRef === edge)
        if (row) {
          const edgePages = quoteToItem(row).slides.length
          return fetchAdjacentSlide({ ...cursor, paragraphRef: edge, page: dir === 'next' ? edgePages - 1 : 0 }, dir, sermonCache)
        }
      }
      // a single paragraph cut out of its stored range (a search result, sermonHit.ts): carry on from its place inside that row
      const n = /^\d+$/.test(cursor.paragraphRef) ? Number(cursor.paragraphRef) : NaN
      const at = Number.isNaN(n) ? -1 : paras.findIndex((p) => { const r = parseParagraphRef(p.paragraphRef); return !!r && r[0] <= n && n <= r[1] })
      if (at === -1) return null
      const base = quoteToItem(paras[at]).slides.findIndex((s) => (s.marker ?? '').replace(/[a-z]+$/, '') === cursor.paragraphRef)
      if (base === -1) return null
      return fetchAdjacentSlide({ ...cursor, paragraphRef: paras[at].paragraphRef, page: base + cursor.page }, dir, sermonCache)
    }

    // Step through the pages of the current paragraph first…
    const curPages = quoteToItem(paras[pos]).slides
    const nextPage = cursor.page + step
    if (nextPage >= 0 && nextPage < curPages.length) {
      return { slide: curPages[nextPage], cursor: { ...cursor, page: nextPage } }
    }

    // …then over to the adjacent paragraph.
    const q = paras[pos + step]
    if (!q) return null
    const pages = quoteToItem(q).slides
    const page = dir === 'next' ? 0 : pages.length - 1
    return {
      slide: pages[page],
      cursor: {
        kind: 'quote',
        sermonId: cursor.sermonId,
        language: cursor.language,
        paragraphRef: q.paragraphRef,
        page
      }
    }
  }

  const v = await window.electronAPI.getAdjacentVerse(
    cursor.translation,
    cursor.bookNum,
    cursor.chapter,
    cursor.verse,
    dir
  )
  if (!v) return null
  return {
    slide: {
      text: v.text,
      marker: String(v.verse),
      reference: `${v.reference} · ${v.translation}`
    },
    cursor: { kind: 'bible', translation: v.translation, bookNum: v.bookNum, chapter: v.chapter, verse: v.verse }
  }
}
