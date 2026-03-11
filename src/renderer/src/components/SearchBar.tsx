import { useState, useCallback, useRef } from 'react'
import type { Quote } from '../types'

interface Props {
  onResults: (results: Quote[]) => void
}

export default function SearchBar({ onResults }: Props) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [titleFilter, setTitleFilter] = useState('')
  const [forceTokens, setForceTokens] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setIsSearching(true)
    try {
      const filters = {
        yearFrom: yearFrom.trim() || undefined,
        yearTo: yearTo.trim() || undefined,
        titleFilter: titleFilter.trim() || undefined,
        forceTokens
      }
      const results = await window.electronAPI.searchSermons(query.trim(), filters)
      onResults(results)
    } finally {
      setIsSearching(false)
    }
  }, [query, yearFrom, yearTo, titleFilter, forceTokens, onResults])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch()
    },
    [handleSearch]
  )

  const hasFilters = yearFrom || yearTo || titleFilter

  return (
    <div className="search-bar-container">
      <div className="search-bar">
        <div className="search-input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search sermons… (e.g. Holy Spirit, faith)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        <button
          className={`btn-secondary btn-sm filter-toggle${hasFilters ? ' filter-toggle--active' : ''}`}
          onClick={() => setShowFilters((v) => !v)}
          title="Toggle filters"
        >
          {hasFilters ? 'Filters ●' : 'Filters ▾'}
        </button>
        <button
          className="btn-primary"
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
        >
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {showFilters && (
        <div className="search-filters">
          <div className="filter-row">
            <label className="filter-label">Year</label>
            <input
              type="text"
              className="filter-input filter-input--sm"
              placeholder="From (e.g. 1955)"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
            />
            <span className="filter-sep">–</span>
            <input
              type="text"
              className="filter-input filter-input--sm"
              placeholder="To (e.g. 1965)"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
            />
          </div>
          <div className="filter-row">
            <label className="filter-label">Title</label>
            <input
              type="text"
              className="filter-input"
              placeholder="Filter by sermon title…"
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
            />
          </div>
          <div className="filter-row">
            <label className="filter-label">Mode</label>
            <div className="filter-mode">
              <button
                className={`filter-mode-btn${!forceTokens ? ' active' : ''}`}
                onClick={() => setForceTokens(false)}
              >
                Phrase first
              </button>
              <button
                className={`filter-mode-btn${forceTokens ? ' active' : ''}`}
                onClick={() => setForceTokens(true)}
              >
                All words
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
