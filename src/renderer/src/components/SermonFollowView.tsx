import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Search, Headphones } from 'lucide-react'
import TapeAttach from './TapeAttach'
import TapeBar from './TapeBar'
import TapeSyncEditor from './TapeSyncEditor'
import { formatTapeTime, type TapeFileStatus, type TapeRecording } from '../../../shared/tape'
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
  language = 'en'
}: Props) {
  const actions = useAppActions()
  const ctx = useContextMenu()
  const [paras, setParas] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [tapeOpen, setTapeOpen] = useState(false)
  const [syncing, setSyncing] = useState<{ rec: TapeRecording & { status: TapeFileStatus } } | null>(null)
  const [recs, setRecs] = useState<Array<TapeRecording & { status: TapeFileStatus }>>([])
  const loadRecs = useCallback(() => { void window.electronAPI.tapeRecordings?.(sermonId)?.then(setRecs).catch(() => {}) }, [sermonId])
  useEffect(() => { loadRecs() }, [loadRecs])
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
    <div className="follow-view">
      <div className="follow-head">
        <button className="btn-quiet btn-sm btn-icon-text" onClick={onBack}>
          <ChevronLeft width={14} height={14} strokeWidth={2.2} aria-hidden="true" /> Results
        </button>
        <span className="follow-title">{title}</span>
        <span className="follow-meta">{dateCode}</span>
        <button
          className={`btn-quiet btn-sm tape-chip${recs.length ? ' tape-chip--on' : ''}`}
          onClick={() => setTapeOpen(true)}
          title={recs.length ? 'The tape for this sermon' : 'Add a recording of this sermon so the text can follow it'}
        >
          <Headphones width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
          {recs.length
            ? `Tape · ${formatTapeTime(recs[0].file.durationSec)}${recs[0].status !== 'ok' ? ' · file missing' : recs[0].synced ? ' · timed' : ' · no timing yet'}`
            : 'Add tape…'}
        </button>
        {recs.length > 0 && recs[0].status === 'ok' && (
          <button className="btn-quiet btn-sm tape-chip" onClick={() => setSyncing({ rec: recs[0] })} title="Tap along to time every paragraph, or correct the timing">
            {recs[0].synced ? 'Edit timing' : 'Tap to sync'}
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
          gap={6}
          paddingStart={8}
          paddingEnd={24}
          itemKey={(fs) => `${fs.quote.paragraphRef}:${fs.slideIndex}`}
          focusIndex={focusIndex >= 0 ? focusIndex : null}
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
            const focused = !live && refsOverlap(focusRef, fs.marker)
            return (
              <div
                className={[
                  'follow-para',
                  live ? 'follow-para--on-screen' : '',
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
                  <span className="follow-para-ref">¶{fs.marker}</span>
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
      {recs.length > 0 && recs[0].status === 'ok' && <TapeBar recording={recs[0]} />}
      {tapeOpen && <TapeAttach sermonId={sermonId} sermonTitle={title} dateCode={dateCode} onClose={() => { setTapeOpen(false); loadRecs() }} onChanged={loadRecs} onSync={(id) => { const r = recs.find((x) => x.id === id) ?? recs[0]; if (r) { setTapeOpen(false); setSyncing({ rec: r }) } }} />}
      {syncing && <TapeSyncEditor recording={syncing.rec} sermonId={sermonId} sermonTitle={title} dateCode={dateCode} language={language} onClose={() => { setSyncing(null); loadRecs() }} onSaved={loadRecs} />}
    </div>
  )
}
