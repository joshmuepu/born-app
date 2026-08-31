import type { Quote } from '../types'
import { highlight, yearFromDateCode } from '../highlight'

interface Props {
  results: Quote[]
  query?: string
  loading?: boolean
  searched?: boolean
  /** The quote paragraph currently on the projector, so its card can be marked. */
  onScreen?: { sermonId: number; paragraphRef: string } | null
  onAddToQueue: (quote: Quote) => void
  onSendToProjection: (quote: Quote) => void
}

/** Strip a leading "146 " / "146-147 " paragraph number the API prepends. */
function bodyOf(text: string): string {
  return text.replace(/^\s*\d+(?:[-–]\d+)?\s+/, '')
}

export default function ResultsList({
  results,
  query,
  loading,
  searched,
  onScreen,
  onAddToQueue,
  onSendToProjection
}: Props) {
  if (loading) {
    return (
      <div className="results-loading">
        <div className="spinner" />
        <span>Searching…</span>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="results-empty">
        {searched ? (
          <>
            <p>No quotes found for “{query}”.</p>
            <p className="results-empty-hint">Try fewer words, or switch to “Any of these words” in Filters.</p>
          </>
        ) : (
          <p>Type a word or phrase above to search {results.length ? '' : 'sermon quotes'}.</p>
        )}
      </div>
    )
  }

  return (
    <div className="results-panel">
      <div className="results-count">{results.length} result{results.length === 1 ? '' : 's'}</div>
      <div className="results-list">
        {results.map((quote, index) => {
          const live =
            !!onScreen &&
            onScreen.sermonId === quote.sermonId &&
            onScreen.paragraphRef === quote.paragraphRef
          return (
          <div key={index} className={`result-item${live ? ' result-item--on-screen' : ''}`}>
            <div className="result-head">
              <span className="result-title">{quote.sermonTitle}</span>
              <span className="result-meta">
                {live && <span className="on-screen-tag">On screen</span>}
                {yearFromDateCode(quote.dateCode)} · ¶{quote.paragraphRef}
              </span>
            </div>
            <p className="result-text">{highlight(bodyOf(quote.text), query)}</p>
            <div className="result-actions">
              <button
                className="btn-secondary btn-sm"
                onClick={() => onAddToQueue(quote)}
              >
                Add to Queue
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={() => onSendToProjection(quote)}
              >
                Project
              </button>
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
