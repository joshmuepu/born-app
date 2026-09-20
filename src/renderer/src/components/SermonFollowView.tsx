import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronDown, Search } from 'lucide-react'
import type { Quote } from '../types'
import { refsOverlap } from '../../../shared/paragraphRef'
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
  onProject: (quote: Quote) => void
  onAddToQueue: (quote: Quote) => void
}

/** Long enough that the default 12-line clamp on the focused paragraph would
 *  still cut it off mid-thought — offer an explicit "show more" instead of
 *  silently truncating. */
const LONG_PARAGRAPH_CHARS = 700

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const focusEl = useRef<HTMLDivElement>(null)
  // The first jump into a sermon (from a search result, possibly hundreds of
  // paragraphs in) should land instantly — animating that whole distance
  // reads as an amateurish "reveal." Once we're actually here, following
  // along a paragraph at a time (Next/Prev) is short enough that a smooth
  // scroll is the nicer, more deliberate touch.
  const hasScrolledOnce = useRef(false)

  // What to keep in view: the projected paragraph if we're live, else the
  // paragraph the operator opened the sermon on.
  const focusRef = liveRef ?? anchorRef

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
          {paras.map((q) => {
            const live = liveRef !== null && refsOverlap(liveRef, q.paragraphRef)
            const focused = !live && refsOverlap(focusRef, q.paragraphRef)
            const isLong = q.text.length > LONG_PARAGRAPH_CHARS
            const isExpanded = expanded.has(q.paragraphRef)
            return (
              <div
                key={q.paragraphRef}
                ref={live || focused ? focusEl : undefined}
                className={[
                  'follow-para',
                  live ? 'follow-para--on-screen' : '',
                  focused ? 'follow-para--focus' : '',
                  isExpanded ? 'follow-para--expanded' : ''
                ].filter(Boolean).join(' ')}
                role="button"
                tabIndex={0}
                title="Put this paragraph on the screen"
                onClick={() => onProject(q)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onProject(q)
                  }
                }}
              >
                <div className="follow-para-head">
                  <span className="follow-para-ref">¶{q.paragraphRef}</span>
                  {live && <span className="on-screen-tag">On screen</span>}
                </div>
                <p className="follow-para-text">{highlight(q.text, query, matchType)}</p>
                {isLong && (focused || live) && (
                  <button
                    className="follow-para-expand"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpanded((prev) => {
                        const next = new Set(prev)
                        if (next.has(q.paragraphRef)) next.delete(q.paragraphRef)
                        else next.add(q.paragraphRef)
                        return next
                      })
                    }}
                  >
                    <ChevronDown width={12} height={12} strokeWidth={2.4} aria-hidden="true" />
                    {isExpanded ? 'Show less' : 'Show full paragraph'}
                  </button>
                )}
                <div className="result-actions">
                  <button
                    className="btn-quiet btn-sm"
                    onClick={(e) => { e.stopPropagation(); onAddToQueue(q) }}
                  >
                    + Queue
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    onClick={(e) => { e.stopPropagation(); onProject(q) }}
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
