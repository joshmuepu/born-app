import { useState, useCallback, useEffect, useRef } from 'react'
import type { Quote } from '../types'

interface Props {
  onResults: (results: Quote[], query: string) => void
  onSearchingChange?: (searching: boolean) => void
}

/** The word fragment the caret is completing (last whitespace-delimited token). */
function lastWord(text: string): string {
  const parts = text.split(/\s+/)
  return parts[parts.length - 1] ?? ''
}

export default function SearchBar({ onResults, onSearchingChange }: Props) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [titleFilter, setTitleFilter] = useState('')
  const [forceTokens, setForceTokens] = useState(false)

  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Monotonic id so a slow in-flight request can't overwrite a newer one.
  const reqId = useRef(0)

  // ── Word suggestions ──────────────────────────────────────────────────────
  useEffect(() => {
    const word = lastWord(query.trim())
    if (suggestTimer.current) clearTimeout(suggestTimer.current)

    if (word.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      setActiveSuggestion(-1)
    } else {
      const mine = ++reqId.current
      suggestTimer.current = setTimeout(() => {
        window.electronAPI
          .getAutocompleteSuggestions(word)
          .then((s) => {
            if (mine !== reqId.current) return // a newer keystroke superseded us
            const list = Array.isArray(s) ? s.filter((x) => typeof x === 'string') : []
            setSuggestions(list)
            setShowSuggestions(list.length > 0)
            setActiveSuggestion(-1)
          })
          .catch(() => {
            if (mine !== reqId.current) return
            setSuggestions([])
            setShowSuggestions(false)
          })
      }, 250)
    }

    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current)
    }
  }, [query])

  // Close the dropdown on an outside click.
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

  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false)
    setActiveSuggestion(-1)
    // Bump the request id so a pending response is ignored.
    reqId.current++
  }, [])

  const applySuggestion = useCallback(
    (suggestion: string) => {
      setQuery((prev) => {
        const words = prev.trimEnd().split(/\s+/)
        words[words.length - 1] = suggestion
        return words.join(' ') + ' '
      })
      closeSuggestions()
      inputRef.current?.focus()
    },
    [closeSuggestions]
  )

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setIsSearching(true)
    onSearchingChange?.(true)
    closeSuggestions()
    try {
      const filters = {
        yearFrom: yearFrom.trim() || undefined,
        yearTo: yearTo.trim() || undefined,
        titleFilter: titleFilter.trim() || undefined,
        forceTokens
      }
      const results = await window.electronAPI.searchSermons(query.trim(), filters)
      onResults(results, query.trim())
    } finally {
      setIsSearching(false)
      onSearchingChange?.(false)
    }
  }, [query, yearFrom, yearTo, titleFilter, forceTokens, onResults, onSearchingChange, closeSuggestions])

  const clearSearch = useCallback(() => {
    setQuery('')
    closeSuggestions()
    onResults([], '')
    inputRef.current?.focus()
  }, [closeSuggestions, onResults])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showSuggestions && suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setActiveSuggestion((p) => Math.min(p + 1, suggestions.length - 1))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setActiveSuggestion((p) => Math.max(p - 1, -1))
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          closeSuggestions()
          return
        }
        if ((e.key === 'Enter' || e.key === 'Tab') && activeSuggestion >= 0) {
          e.preventDefault()
          applySuggestion(suggestions[activeSuggestion])
          return
        }
      }
      if (e.key === 'Enter') handleSearch()
      else if (e.key === 'Escape' && query) {
        e.preventDefault()
        clearSearch()
      }
    },
    [showSuggestions, suggestions, activeSuggestion, applySuggestion, closeSuggestions, handleSearch, query, clearSearch]
  )

  const filterCount = [yearFrom || yearTo, titleFilter].filter(Boolean).length
  const hasFilters = filterCount > 0

  return (
    <div className="search-bar-container">
      <div className="search-bar">
        <div className="search-input-wrap">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            id="born-search-input"
            type="text"
            className="search-input"
            placeholder="Search for a word or phrase — e.g. Holy Spirit"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            autoComplete="off"
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              onClick={clearSearch}
              title="Clear search (Esc)"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="autocomplete-dropdown" ref={dropdownRef}>
              {suggestions.map((s, i) => (
                <div
                  key={s}
                  className={`autocomplete-item${i === activeSuggestion ? ' active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applySuggestion(s)
                  }}
                  onMouseEnter={() => setActiveSuggestion(i)}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className={`btn-secondary filter-toggle${hasFilters ? ' filter-toggle--active' : ''}`}
          onClick={() => setShowFilters((v) => !v)}
          title="Narrow your search by year or sermon"
        >
          Filters{hasFilters ? ` (${filterCount})` : ''}
        </button>
        <button className="btn-primary" onClick={handleSearch} disabled={isSearching || !query.trim()}>
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {showFilters && (
        <div className="search-filters">
          <div className="filter-row">
            <label className="filter-label">Years</label>
            <input
              type="text"
              inputMode="numeric"
              className="filter-input filter-input--sm"
              placeholder="From"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            />
            <span className="filter-sep">to</span>
            <input
              type="text"
              inputMode="numeric"
              className="filter-input filter-input--sm"
              placeholder="To"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            />
          </div>
          <div className="filter-row">
            <label className="filter-label">Sermon</label>
            <input
              type="text"
              className="filter-input"
              placeholder="Only search sermons whose title contains…"
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
            />
          </div>
          <div className="filter-row">
            <label className="filter-label">Match</label>
            <div className="filter-mode">
              <button
                className={`filter-mode-btn${!forceTokens ? ' active' : ''}`}
                onClick={() => setForceTokens(false)}
              >
                This exact phrase
              </button>
              <button
                className={`filter-mode-btn${forceTokens ? ' active' : ''}`}
                onClick={() => setForceTokens(true)}
              >
                Any of these words
              </button>
            </div>
          </div>
          {hasFilters && (
            <button
              className="filter-clear"
              onClick={() => { setYearFrom(''); setYearTo(''); setTitleFilter('') }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
