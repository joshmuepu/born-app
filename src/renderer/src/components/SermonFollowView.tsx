import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { Quote } from '../types'
import { refsOverlap } from '../../../shared/paragraphRef'

interface Props {
  /** The sermon being shown. */
  sermonId: number
  /** The paragraph the operator clicked / projected — kept in view and marked. */
  anchorRef: string
  /** The paragraph on the projector right now (null unless this sermon is live). */
  liveRef: string | null
  onBack: () => void
  onProject: (quote: Quote) => void
  onAddToQueue: (quote: Quote) => void
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
      </div>

      {loading ? (
        <div className="results-loading"><div className="spinner" /><span>Loading sermon…</span></div>
      ) : (
        <div className="follow-list">
          {paras.map((q) => {
            const live = liveRef !== null && refsOverlap(liveRef, q.paragraphRef)
            const focused = !live && refsOverlap(focusRef, q.paragraphRef)
            return (
              <div
                key={q.paragraphRef}
                ref={live || focused ? focusEl : undefined}
                className={[
                  'follow-para',
                  live ? 'follow-para--on-screen' : '',
                  focused ? 'follow-para--focus' : ''
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
                <p className="follow-para-text">{q.text}</p>
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
