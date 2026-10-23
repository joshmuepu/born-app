import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Search } from 'lucide-react'
import type { Quote } from '../types'
import { refsOverlap } from '../../../shared/paragraphRef'
import { quoteToItem } from '../../../shared/queueItem'
import { highlight } from '../highlight'
import './SermonPanel.css'
import type { HighlightMode } from '../../../shared/searchHighlight'

interface Props {
  /** The sermon being shown. */
  sermonId: number
  /** The paragraph the operator clicked / projected — kept in view and marked. */
  anchorRef: string
  /** The paragraph on the projector right now (null unless this sermon is live). */
  liveRef: string | null
  /** Still-active search term, if the operator got here from a search result —
   *  kept highlighted here too, since this is the screen where they're actually
   *  choosing which paragraph to put on the screen. */
  query?: string
  matchType?: HighlightMode
  onBack: () => void
  /** `slideIndex` projects that exact sub-paragraph of `quote` — needed
   *  because a source row can span several numbered paragraphs ("156-157"),
   *  and clicking the card for 157 specifically must not fall back to 156. */
  onProject: (quote: Quote, slideIndex?: number) => void
  onAddToQueue: (quote: Quote) => void
}

/** One card per *paragraph*, not per source row — a row can legitimately
 *  span several numbered paragraphs ("156-157" stored as one DB record),
 *  and showing that as a single card ran two paragraphs together with no
 *  visual break, under one misleading "¶156-157" label. quoteToItem() is
 *  the same split every other surface (search preview, the remote,
 *  projection itself) already uses, so this list can never show something
 *  different from what actually ends up on screen. Its pagination also
 *  bounds every slide to a projector-sized chunk, which is why the old
 *  "show full paragraph" truncation is gone — there's no longer a card long
 *  enough to need it. */
interface FlatSlide {
  quote: Quote
  slideIndex: number
  marker: string
  text: string
}

/** "¶41a" for a numbered paragraph; a paragraph with no number is "Slide 2" (or nothing, if it is one slide). */
function paraLabel(marker: string): string {
  if (!marker.startsWith('§') && !marker.includes('#')) return `¶${marker}`
  const page = marker.split('#')[1]
  return page !== undefined ? `Slide ${Number(page) + 1}` : ''
}

/**
 * Clicking a search result opens this — the whole sermon, scrolled to the
 * paragraph you picked. Click any paragraph to put it on the screen; once
 * something is projected the highlight follows Next / Prev. Same idea as the
 * Bible chapter view.
 */
export default function SermonFollowView({
  sermonId,
  anchorRef,
  liveRef,
  query,
  matchType,
  onBack,
  onProject,
  onAddToQueue
}: Props) {
  const [paras, setParas] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const focusEl = useRef<HTMLDivElement>(null)
  // The first jump into a sermon (from a search result, possibly hundreds of
  // paragraphs in) should land instantly — animating that whole distance
  // reads as an amateurish "reveal." Once we're actually here, following
  // along a paragraph at a time (Next/Prev) is short enough that a smooth
  // scroll is the nicer, more deliberate touch.
  const hasScrolledOnce = useRef(false)

  // What to keep in view: the projected paragraph if we're live, else the
  // last one that was (hiding the screen must not move the reader: the
  // operator is still in the same place), else the paragraph the operator
  // opened the sermon on. A new anchor (another queue row) starts over.
  const lastLive = useRef<{ sermonId: number; anchor: string; ref: string } | null>(null)
  if (liveRef !== null) lastLive.current = { sermonId, anchor: anchorRef, ref: liveRef }
  const held = lastLive.current
  const heldRef = held && held.sermonId === sermonId && held.anchor === anchorRef ? held.ref : null
  const focusRef = liveRef ?? heldRef ?? anchorRef

  const isLive = (fs: { marker: string }): boolean => liveRef !== null && liveRef === fs.marker
  const isFocused = (fs: { marker: string }): boolean =>
    liveRef === null && heldRef !== null
      ? heldRef === fs.marker
      : refsOverlap(focusRef, fs.marker) || fs.marker === `${focusRef}#0`

  const flatSlides = useMemo<FlatSlide[]>(() => {
    const out: FlatSlide[] = []
    for (const q of paras) {
      const slides = quoteToItem(q).slides
      slides.forEach((s, i) => {
        // No number of its own: name the page after the source row, so each page can be marked on its own.
        const marker = s.marker ?? (slides.length > 1 ? `${q.paragraphRef}#${i}` : q.paragraphRef)
        out.push({ quote: q, slideIndex: i, marker, text: s.text })
      })
    }
    return out
  }, [paras])

  const firstMarked = flatSlides.findIndex((fs) => isLive(fs) || isFocused(fs))

  useEffect(() => {
    let alive = true
    setLoading(true)
    window.electronAPI.getSermonParagraphs(sermonId, 'en').then((p) => {
      if (alive) {
        setParas(p)
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [sermonId])

  useEffect(() => {
    if (!focusEl.current) return
    focusEl.current.scrollIntoView({
      block: 'center',
      behavior: hasScrolledOnce.current ? 'smooth' : 'auto'
    })
    hasScrolledOnce.current = true
  }, [focusRef, paras])

  const title = paras[0]?.sermonTitle ?? ''
  const dateCode = paras[0]?.dateCode ?? ''

  return (
    <div className="follow-view">
      <div className="follow-head">
        <button className="btn-quiet btn-sm btn-icon-text" onClick={onBack}>
          <ChevronLeft width={14} height={14} strokeWidth={2.2} aria-hidden="true" /> Results
        </button>
        <span className="follow-title">{title}</span>
        <span className="follow-meta">{dateCode}</span>
        {query && (
          <span className="follow-still-searching">
            <Search width={12} height={12} strokeWidth={2.2} aria-hidden="true" />
            still searching &ldquo;<b>{query}</b>&rdquo;
          </span>
        )}
      </div>

      {loading ? (
        <div className="results-loading"><div className="spinner" /><span>Loading sermon…</span></div>
      ) : (
        <div className="follow-list">
          {flatSlides.map((fs, i) => {
            // Exact match, not refsOverlap: this list is already flattened to
            // one card per page ("1a", "1b", …), so liveRef — the specific
            // page actually on screen — must match exactly. refsOverlap's
            // numeric-range comparison ignores the letter suffix entirely,
            // which previously marked every page of a paginated paragraph
            // (and, worse, every paragraph whose number fell inside a range
            // accidentally parsed from an unrelated reference) as "on
            // screen" at once. `focused` legitimately still wants the fuzzy
            // match: it falls back to the whole clicked/merged anchorRef
            // when nothing from this sermon is live yet.
            const live = isLive(fs)
            const focused = !live && isFocused(fs)
            return (
              <div
                key={`${fs.quote.paragraphRef}:${fs.slideIndex}`}
                ref={i === firstMarked ? focusEl : undefined}
                className={[
                  'follow-para',
                  live ? 'follow-para--on-screen' : '',
                  focused ? 'follow-para--focus' : ''
                ].filter(Boolean).join(' ')}
                role="button"
                tabIndex={0}
                title="Put this paragraph on the screen"
                onClick={(e) => { onProject(fs.quote, fs.slideIndex); e.currentTarget.blur() }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onProject(fs.quote, fs.slideIndex)
                    e.currentTarget.blur()
                  }
                }}
              >
                <div className="follow-para-head">
                  <span className="follow-para-ref">{paraLabel(fs.marker)}</span>
                  {live && <span className="on-screen-tag">On screen</span>}
                </div>
                <p className="follow-para-text">{highlight(fs.text, query, matchType)}</p>
                <div className="result-actions">
                  <button
                    className="btn-quiet btn-sm"
                    onClick={(e) => { e.stopPropagation(); onAddToQueue(fs.quote); e.currentTarget.blur() }}
                  >
                    + Queue
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    onClick={(e) => { e.stopPropagation(); onProject(fs.quote, fs.slideIndex); e.currentTarget.blur() }}
                  >
                    {live ? 'Restart here' : 'Project'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
