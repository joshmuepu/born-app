import { useEffect, useState } from 'react'
import { SearchX, Search, Clock, CalendarDays } from 'lucide-react'
import type { Quote } from '../types'
import { highlight, smartSnippet, yearFromDateCode } from '../highlight'
import { refsOverlap } from '../../../shared/paragraphRef'
import { resultCountLabel } from '../../../shared/searchLimits'
import './SermonPanel.css'
import { getRecentSearches } from '../recentSearches'

interface Props {
  results: Quote[]
  query?: string
  loading?: boolean
  searched?: boolean
  /** The quote paragraph currently on the projector, so its card can be marked. */
  onScreen?: { sermonId: number; paragraphRef: string } | null
  onAddToQueue: (quote: Quote) => void
  onSendToProjection: (quote: Quote) => void
  /** Open the whole sermon, scrolled to this paragraph (without projecting). */
  onOpenSermon: (quote: Quote) => void
  /** Re-run a past search term — a recent-search chip in the empty state. */
  onQuickSearch: (term: string) => void
  /** Open a sermon at a specific paragraph (or the start, with '') without a
   *  search — "On This Day" and "Jump back in" in the empty state. */
  onJumpToSermon: (sermonId: number, anchorRef: string) => void
}

/** Strip a leading "146 " / "146-147 " paragraph number the API prepends. */
function bodyOf(text: string): string {
  return text.replace(/^\s*\d+(?:[-–]\d+)?\s+/, '')
}

function EmptySearchState({
  searched,
  query,
  onScreen,
  onQuickSearch,
  onJumpToSermon
}: Pick<Props, 'searched' | 'query' | 'onScreen' | 'onQuickSearch' | 'onJumpToSermon'>): JSX.Element {
  const [recent, setRecent] = useState<string[]>([])
  const [onThisDay, setOnThisDay] = useState<Array<{ id: number; date_code: string; title: string }>>([])
  const [onScreenSermon, setOnScreenSermon] = useState<{ title: string; date_code: string } | null>(null)

  useEffect(() => {
    if (searched) return
    setRecent(getRecentSearches())
    window.electronAPI.getOnThisDay().then(setOnThisDay).catch(() => setOnThisDay([]))
  }, [searched])

  useEffect(() => {
    if (searched || !onScreen) {
      setOnScreenSermon(null)
      return
    }
    let alive = true
    window.electronAPI.getSermonsByIds([onScreen.sermonId]).then((rows) => {
      if (!alive) return
      const r = rows[0] as { title: string; date_code: string } | undefined
      setOnScreenSermon(r ? { title: r.title, date_code: r.date_code } : null)
    })
    return () => {
      alive = false
    }
  }, [searched, onScreen])

  if (searched) {
    return (
      <div className="results-empty">
        <div className="empty-state-icon">
          <SearchX width={20} height={20} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <p>No quotes found for &ldquo;{query}&rdquo;.</p>
        <p className="results-empty-hint">Try fewer words, or switch to All words / Any word in Filters.</p>
      </div>
    )
  }

  const hasAnything = recent.length > 0 || onThisDay.length > 0 || (onScreen && onScreenSermon)

  if (!hasAnything) {
    return (
      <div className="results-empty">
        <div className="empty-state-icon">
          <Search width={20} height={20} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <p>Type a word or phrase above to search sermon quotes.</p>
      </div>
    )
  }

  return (
    <div className="search-empty-hub">
      {onScreen && onScreenSermon && (
        <div className="empty-section">
          <div className="empty-section-label">JUMP BACK IN</div>
          <button
            className="resume-card"
            onClick={() => onJumpToSermon(onScreen.sermonId, onScreen.paragraphRef)}
          >
            <span className="resume-dot" />
            <span className="resume-body">
              <span className="resume-title">{onScreenSermon.title} · ¶{onScreen.paragraphRef}</span>
              <span className="resume-sub">On screen right now — resume reading</span>
            </span>
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <div className="empty-section">
          <div className="empty-section-label">
            <Clock width={11} height={11} strokeWidth={2.2} aria-hidden="true" /> RECENT SEARCHES
          </div>
          <div className="empty-chip-row">
            {recent.map((term) => (
              <button key={term} className="empty-chip" onClick={() => onQuickSearch(term)}>
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {onThisDay.length > 0 && (
        <div className="empty-section">
          <div className="empty-section-label">
            <CalendarDays width={11} height={11} strokeWidth={2.2} aria-hidden="true" /> ON THIS DAY
          </div>
          <div className="on-this-day-grid">
            {onThisDay.map((s) => (
              <button key={s.id} className="on-this-day-card" onClick={() => onJumpToSermon(s.id, '')}>
                <span className="on-this-day-code">{s.date_code}</span>
                <span className="on-this-day-title">{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResultsList({
  results,
  query,
  loading,
  searched,
  onScreen,
  onAddToQueue,
  onSendToProjection,
  onOpenSermon,
  onQuickSearch,
  onJumpToSermon
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
      <EmptySearchState
        searched={searched}
        query={query}
        onScreen={onScreen}
        onQuickSearch={onQuickSearch}
        onJumpToSermon={onJumpToSermon}
      />
    )
  }

  return (
    <div className="results-panel">
      <div className="results-count">{resultCountLabel(results.length)}</div>
      <div className="results-list">
        {results.map((quote, index) => {
          const live =
            !!onScreen &&
            onScreen.sermonId === quote.sermonId &&
            refsOverlap(onScreen.paragraphRef, quote.paragraphRef)
          const mode = quote.matchType ?? 'all'
          const { snippet, moreCount } = smartSnippet(bodyOf(quote.text), query, mode)
          return (
          <div key={index} className={`result-item${live ? ' result-item--on-screen' : ''}`}>
            <div
              className="result-body"
              role="button"
              tabIndex={0}
              title="Open the whole sermon at this paragraph"
              onClick={() => onOpenSermon(quote)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpenSermon(quote)
                }
              }}
            >
              <div className="result-head">
                <span className="result-title">{quote.sermonTitle}</span>
                <span className="result-meta">
                  {live && <span className="on-screen-tag">On screen</span>}
                  {yearFromDateCode(quote.dateCode)} · ¶{quote.paragraphRef}
                </span>
              </div>
              <p className="result-text">{highlight(snippet, query, mode)}</p>
              {moreCount > 0 && (
                <span className="result-more-matches">
                  {moreCount} more match{moreCount === 1 ? '' : 'es'} in this paragraph
                </span>
              )}
            </div>
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
