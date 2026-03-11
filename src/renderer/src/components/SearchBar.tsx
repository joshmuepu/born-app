import { useState, useCallback, useEffect, useRef } from 'react'
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

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [hitCount, setHitCount] = useState<number | null>(null)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)

  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounced autocomplete + hit count
  useEffect(() => {
    const word = query.trim().split(/\s+/).pop() ?? ''

    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (word.length >= 2) {
      suggestTimer.current = setTimeout(() => {
        try {
          window.electronAPI.getAutocompleteSuggestions(word)
            .then((s) => {
              setSuggestions(s)
              setShowSuggestions(s.length > 0)
              setActiveSuggestion(-1)
            })
            .catch(() => { /* best-effort */ })
        } catch { /* IPC not ready */ }
      }, 300)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }

    if (countTimer.current) clearTimeout(countTimer.current)
    if (query.trim().length >= 2) {
      const captured = query.trim()
      countTimer.current = setTimeout(() => {
        const searchType = forceTokens ? 'AllWords' : 'ExactPhrase'
        try {
          window.electronAPI.getHitsCountPreview(captured, searchType)
            .then((count) => setHitCount(count))
            .catch(() => { /* best-effort */ })
        } catch { /* IPC not ready */ }
      }, 400)
    } else {
      setHitCount(null)
    }

    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current)
      if (countTimer.current) clearTimeout(countTimer.current)
    }
  }, [query, forceTokens])

  // Close suggestions on outside click
  useEffect(() => {
    const onOutside = (e: MouseEvent): void => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setIsSearching(true)
    setShowSuggestions(false)
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

  const applySuggestion = useCallback(
    (suggestion: string) => {
      const words = query.trimEnd().split(/\s+/)
      words[words.length - 1] = suggestion
      setQuery(words.join(' ') + ' ')
      setSuggestions([])
      setShowSuggestions(false)
      setActiveSuggestion(-1)
      inputRef.current?.focus()
    },
    [query]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (showSuggestions && activeSuggestion >= 0) {
          applySuggestion(suggestions[activeSuggestion])
        } else {
          handleSearch()
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveSuggestion((prev) => Math.max(prev - 1, -1))
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
      }
    },
    [handleSearch, showSuggestions, activeSuggestion, suggestions, applySuggestion]
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
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            autoFocus
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="autocomplete-dropdown" ref={dropdownRef}>
              {suggestions.map((s, i) => (
                <div
                  key={s}
                  className={`autocomplete-item${i === activeSuggestion ? ' active' : ''}`}
                  onMouseDown={() => applySuggestion(s)}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
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
          {!isSearching && hitCount !== null && hitCount > 0 && (
            <span className="hit-count">~{hitCount.toLocaleString()}</span>
          )}
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
