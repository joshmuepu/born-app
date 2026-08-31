import { useEffect, useRef, useState } from 'react'
import type { Quote } from '../types'
import { refsOverlap } from '../../../shared/paragraphRef'

interface Props {
  /** The sermon currently being projected. */
  sermonId: number
  /** The paragraph ref on screen right now (follows Next / Prev). */
  currentRef: string | null
  onBack: () => void
  onProject: (quote: Quote) => void
  onAddToQueue: (quote: Quote) => void
}

/**
 * After you project a sermon quote from the search results, the results are
 * replaced by this — the whole sermon, with the paragraph on screen highlighted
 * and kept in view — so the operator can read ahead and follow along. Same idea
 * as the Bible panel after a lookup.
 */
export default function SermonFollowView({
  sermonId,
  currentRef,
  onBack,
  onProject,
  onAddToQueue
}: Props) {
  const [paras, setParas] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const liveRef = useRef<HTMLDivElement>(null)

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

  // Keep the on-screen paragraph scrolled into view as Next / Prev moves it.
  useEffect(() => {
    liveRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [currentRef, paras])

  const title = paras[0]?.sermonTitle ?? ''
  const dateCode = paras[0]?.dateCode ?? ''

  return (
    <div className="follow-view">
      <div className="follow-head">
        <button className="btn-quiet btn-sm" onClick={onBack}>← Results</button>
        <span className="follow-title">{title}</span>
        <span className="follow-meta">{dateCode}</span>
      </div>

      {loading ? (
        <div className="results-loading"><div className="spinner" /><span>Loading sermon…</span></div>
      ) : (
        <div className="follow-list">
          {paras.map((q) => {
            const live = currentRef !== null && refsOverlap(currentRef, q.paragraphRef)
            return (
              <div
                key={q.paragraphRef}
                ref={live ? liveRef : undefined}
                className={`follow-para${live ? ' follow-para--on-screen' : ''}`}
              >
                <div className="follow-para-head">
                  <span className="follow-para-ref">¶{q.paragraphRef}</span>
                  {live && <span className="on-screen-tag">On screen</span>}
                </div>
                <p className="follow-para-text">{q.text}</p>
                <div className="result-actions">
                  <button className="btn-quiet btn-sm" onClick={() => onAddToQueue(q)}>+ Queue</button>
                  <button className="btn-primary btn-sm" onClick={() => onProject(q)}>
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
