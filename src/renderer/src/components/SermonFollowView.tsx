import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Search, Headphones } from 'lucide-react'
import { formatTapeTime, type TapeFileStatus, type TapeRecording } from '../../../shared/tape'
import { baseNumber, flatIndexFor } from '../../../shared/tapeParagraphs'
import { useTapeFollow } from '../useTapeFollow'
import { onTape } from '../tapeBus'
import type { Quote } from '../types'
import { refsOverlap } from '../../../shared/paragraphRef'
import { quoteToItem } from '../../../shared/queueItem'
import { highlight } from '../highlight'
import VirtualList from './VirtualList'
import { startQueueDrag } from '../dragItem'
import { useContextMenu } from './ContextMenu'
import { quoteMenu } from '../contextMenus'
import { useAppActions } from '../AppActions'
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
  /** Which language to fetch this sermon's paragraphs in — defaults to 'en'
   *  (Main's own usage, unchanged). A channel following another language
   *  passes its own here instead. */
  language?: string
  /** Open the Tape place (the recording's follow view, or the Add tab for a sermon that has no recording yet). */
  onOpenTape?: (t: { sermonId: number; tab?: 'follow' | 'add' | 'timing' }) => void
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
  onAddToQueue,
  language = 'en',
  onOpenTape
}: Props) {
  const actions = useAppActions()
  const ctx = useContextMenu()
  const [paras, setParas] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [recs, setRecs] = useState<Array<TapeRecording & { status: TapeFileStatus }>>([])
  const [mapVersion, setMapVersion] = useState(0)
  const [jump, setJump] = useState<{ n: number; id: number } | null>(null)
  const loadRecs = useCallback(() => { void window.electronAPI.tapeRecordings?.(sermonId)?.then(setRecs).catch(() => {}) }, [sermonId])
  useEffect(() => { loadRecs() }, [loadRecs])
  // recordings and timing change in the Tape place: refresh what this reader shows
  useEffect(() => onTape((e) => { if (e === 'map-changed') setMapVersion((v) => v + 1); loadRecs() }), [loadRecs])
  // What to keep in view: the projected paragraph if we're live, else the
  // paragraph the operator opened the sermon on.
  const focusRef = liveRef ?? anchorRef

  const flatSlides = useMemo<FlatSlide[]>(() => {
    const out: FlatSlide[] = []
    for (const q of paras) {
      const slides = quoteToItem(q).slides
      slides.forEach((s, i) => {
        out.push({ quote: q, slideIndex: i, marker: s.marker ?? q.paragraphRef, text: s.text })
      })
    }
    return out
  }, [paras])

  // ── the tape (docs/design/sermon-audio): the highlight is the TAPE's, the scroll is the user's ──
  const tapeRec = recs[0] && recs[0].status === 'ok' ? recs[0] : null
  const textNumbers = useMemo(() => [...new Set(flatSlides.map((f) => baseNumber(f.marker)).filter((n): n is number => n !== null))], [flatSlides])
  const tf = useTapeFollow(tapeRec, language, mapVersion, textNumbers)
  const tapeActive = !!tapeRec && tf.mine && !!tf.map && !!tf.here
  const tapeNumber = tapeActive ? tf.here!.n : null
  const tapeIndex = useMemo(() => (tapeActive ? flatIndexFor(flatSlides.map((f) => f.marker), tf.here!.n, tf.here!.progress) : -1), [tapeActive, flatSlides, tf.here])
  useEffect(() => {
    if (!jump) return
    const t = window.setTimeout(() => setJump(null), 8000)
    return () => window.clearTimeout(t)
  }, [jump])
  const jumpToPara = (n: number): boolean => {
    if (!tf.jumpToParagraph(n)) return false
    setJump({ n, id: Date.now() })
    return true
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    window.electronAPI.getSermonParagraphs(sermonId, language).then((p) => {
      if (alive) {
        setParas(p)
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [sermonId, language])

  // The row to keep in view: the projected paragraph while live, otherwise the
  // paragraph the sermon was opened on. Exact page match wins over the fuzzy
  // range match, same rule the highlight below uses.
  const focusIndex = useMemo(() => {
    if (liveRef !== null) {
      const i = flatSlides.findIndex((fs) => fs.marker === liveRef)
      if (i >= 0) return i
    }
    return flatSlides.findIndex((fs) => refsOverlap(focusRef, fs.marker))
  }, [flatSlides, liveRef, focusRef])

  const title = paras[0]?.sermonTitle ?? ''
  const dateCode = paras[0]?.dateCode ?? ''

  return (
    <div
      className={`follow-view${tapeActive ? ' follow-view--tape' : ''}`}
      tabIndex={-1}
      onKeyDown={(e) => {
        // the reader is a reader: the only tape key here is F (follow / free-browse). Play, skip and volume are the bar's, with global shortcuts.
        if (!tapeActive) return
        const t = e.target as HTMLElement
        if (t.closest('input, select, textarea, [role=slider]') || e.metaKey || e.ctrlKey || e.altKey) return
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); tf.setFollow(!tf.follow) }
      }}
    >
      <div className="follow-head">
        <button className="btn-quiet btn-sm btn-icon-text" onClick={onBack}>
          <ChevronLeft width={14} height={14} strokeWidth={2.2} aria-hidden="true" /> Results
        </button>
        <span className="follow-title">{title}</span>
        <span className="follow-meta">{dateCode}</span>
        {!onOpenTape ? null : tapeActive ? (
          <>
            <button className="btn-quiet btn-sm tape-chip tape-chip--on" onClick={() => onOpenTape?.({ sermonId, tab: 'follow' })} title="Following the tape — open the Tape place">
              <Headphones width={13} height={13} strokeWidth={2.2} aria-hidden="true" /> Following the tape · ¶{tf.here!.n}
            </button>
            {!tf.follow && <button className="btn-secondary btn-sm" onClick={() => tf.setFollow(true)}>Back to the tape</button>}
            {jump && <span className="tape-jump" role="status">Jumped to ¶{jump.n} <button className="btn-quiet btn-sm" onClick={() => { tf.undoJump(); setJump(null) }}>Undo</button></span>}
          </>
        ) : recs.length > 0 ? (
          <button className="btn-quiet btn-sm tape-chip tape-chip--on" onClick={() => onOpenTape?.({ sermonId, tab: recs[0].status === 'ok' && recs[0].synced ? 'follow' : recs[0].status === 'ok' ? 'timing' : 'follow' })} title="The recording for this sermon — open it in the Tape place">
            <Headphones width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
            {`Tape · ${formatTapeTime(recs[0].file.durationSec)}${recs[0].status !== 'ok' ? ' · file missing' : recs[0].synced ? ' · timed' : ' · no timing yet'}`}
          </button>
        ) : (
          <button className="btn-quiet btn-sm tape-chip" onClick={() => onOpenTape?.({ sermonId, tab: 'add' })} title="Add a recording of this sermon so the text can follow it">
            <Headphones width={13} height={13} strokeWidth={2.2} aria-hidden="true" /> Add a recording
          </button>
        )}
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
        <VirtualList
          className="follow-list follow-list--virtual"
          items={flatSlides}
          estimateSize={150}
          threshold={400}
          scrollerProps={{
            // the reader's scroll is the user's: a hand on the wheel, the scrollbar or the screen turns follow off (the highlight stays the tape's)
            onWheel: () => { if (tapeActive) tf.setFollow(false) },
            onTouchMove: () => { if (tapeActive) tf.setFollow(false) },
            onPointerDown: (e) => { if (tapeActive && e.target === e.currentTarget) tf.setFollow(false) }
          }}
          gap={6}
          paddingStart={8}
          paddingEnd={24}
          itemKey={(fs) => `${fs.quote.paragraphRef}:${fs.slideIndex}`}
          focusIndex={tapeActive && tf.follow && tapeIndex >= 0 ? tapeIndex : focusIndex >= 0 && !(tapeActive && tf.follow) ? focusIndex : null}
          renderItem={(fs) => {
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
            const live = liveRef !== null && liveRef === fs.marker
            const onTape = tapeNumber !== null && baseNumber(fs.marker) === tapeNumber
            const focused = !live && refsOverlap(focusRef, fs.marker)
            return (
              <div
                className={[
                  'follow-para',
                  live ? 'follow-para--on-screen' : '',
                  onTape ? 'follow-para--tape' : tapeActive ? 'follow-para--tape-dim' : '',
                  focused ? 'follow-para--focus' : ''
                ].filter(Boolean).join(' ')}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => startQueueDrag(e, { type: 'quote', quote: fs.quote })}
                {...ctx.bind(() =>
                  quoteMenu(fs.quote, {
                    actions,
                    project: () => onProject(fs.quote, fs.slideIndex),
                    addToQueue: () => onAddToQueue(fs.quote),
                    openSermon: false
                  })
                )}
                title="Put this paragraph on the screen — or drag it into the queue"
                onClick={(e) => {
                  // the card only ever puts the paragraph on the screen (as it always did); moving the TAPE is the paragraph NUMBER's job
                  onProject(fs.quote, fs.slideIndex)
                  e.currentTarget.blur()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onProject(fs.quote, fs.slideIndex)
                    e.currentTarget.blur()
                  }
                }}
              >
                <div className="follow-para-head">
                  {tapeActive && baseNumber(fs.marker) !== null ? (
                    <button
                      className="follow-para-ref follow-para-ref--jump"
                      onClick={(e) => { e.stopPropagation(); const n = baseNumber(fs.marker); if (n !== null && jumpToPara(n)) tf.setFollow(true); e.currentTarget.blur() }}
                      onKeyDown={(e) => e.stopPropagation()}
                      aria-label={`Move the tape to paragraph ${baseNumber(fs.marker)}`}
                      title="Move the tape to this paragraph"
                    >¶{fs.marker}</button>
                  ) : (
                    <span className="follow-para-ref">¶{fs.marker}</span>
                  )}
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
          }}
        />
      )}
      {ctx.element}
    </div>
  )
}
