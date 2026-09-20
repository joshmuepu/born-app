import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import type { Quote } from '../types'
import { addRecentSearch } from '../recentSearches'
import './SermonPanel.css'

interface Props {
  onResults: (results: Quote[], query: string) => void
  onSearchingChange?: (searching: boolean) => void
  /** Bump `nonce` to run `term` as if the operator had typed and searched it —
   *  how the empty state's recent-search chips re-run a past search. */
  externalQuery?: { term: string; nonce: number } | null
}

type MatchMode = 'phrase' | 'all' | 'any'

/** The word fragment the caret is completing (last whitespace-delimited token). */
function lastWord(text: string): string {
  const parts = text.split(/\s+/)
  return parts[parts.length - 1] ?? ''
}

export default function SearchBar({ onResults, onSearchingChange, externalQuery }: Props) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [titleFilter, setTitleFilter] = useState('')
  const [exactDate, setExactDate] = useState('')
  const [matchMode, setMatchMode] = useState<MatchMode>('phrase')

  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const filtersToggleRef = useRef<HTMLButtonElement>(null)
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

  // Close the suggestions dropdown and the filters popover on an outside click.
  useEffect(() => {
    const onOutside = (e: MouseEvent): void => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
      if (
        filtersRef.current &&
        !filtersRef.current.contains(e.target as Node) &&
        !filtersToggleRef.current?.contains(e.target as Node)
      ) {
        setShowFilters(false)
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

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return
      setIsSearching(true)
      onSearchingChange?.(true)
      closeSuggestions()
      try {
        const filters = {
          yearFrom: yearFrom.trim() || undefined,
          yearTo: yearTo.trim() || undefined,
          titleFilter: titleFilter.trim() || undefined,
          dateCode: exactDate.trim() || undefined,
          matchMode
        }
        const results = await window.electronAPI.searchSermons(q.trim(), filters)
        onResults(results, q.trim())
        addRecentSearch(q.trim())
      } finally {
        setIsSearching(false)
        onSearchingChange?.(false)
      }
    },
    [yearFrom, yearTo, titleFilter, exactDate, matchMode, onResults, onSearchingChange, closeSuggestions]
  )

  const handleSearch = useCallback(() => runSearch(query), [runSearch, query])

  // A recent-search chip elsewhere in the panel re-runs a past query.
  useEffect(() => {
    if (!externalQuery?.term) return
    setQuery(externalQuery.term)
    runSearch(externalQuery.term)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuery?.nonce])

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

  const filterCount = [yearFrom || yearTo, titleFilter, exactDate, matchMode !== 'phrase'].filter(Boolean).length
  const hasFilters = filterCount > 0

  return (
    <div className="search-bar-container">
      <div className="search-bar">
        <div className="search-input-wrap">
          <Search className="search-icon" width={14} height={14} strokeWidth={2} aria-hidden="true" />
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
              <X width={13} height={13} strokeWidth={2.4} />
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
        <div className="filter-popover-wrap">
          <button
            ref={filtersToggleRef}
            className={`btn-secondary filter-toggle${hasFilters ? ' filter-toggle--active' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
            title="Narrow your search"
          >
            <SlidersHorizontal width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
            Filters{hasFilters ? ` (${filterCount})` : ''}
          </button>

          {showFilters && (
            <div className="filter-popover" ref={filtersRef}>
              <div className="filter-section">
                <div className="filter-section-label">Match</div>
                <div className="filter-mode">
                  <button
                    className={`filter-mode-btn${matchMode === 'phrase' ? ' active' : ''}`}
                    onClick={() => setMatchMode('phrase')}
                  >
                    Phrase
                  </button>
                  <button
                    className={`filter-mode-btn${matchMode === 'all' ? ' active' : ''}`}
                    onClick={() => setMatchMode('all')}
                  >
                    All words
                  </button>
                  <button
                    className={`filter-mode-btn${matchMode === 'any' ? ' active' : ''}`}
                    onClick={() => setMatchMode('any')}
                  >
                    Any word
                  </button>
                </div>
              </div>

              <div className="filter-section">
                <div className="filter-section-label">Date</div>
                <div className="filter-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="filter-input filter-input--sm"
                    placeholder="Year from"
                    value={yearFrom}
                    onChange={(e) => setYearFrom(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  />
                  <span className="filter-sep">to</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="filter-input filter-input--sm"
                    placeholder="Year to"
                    value={yearTo}
                    onChange={(e) => setYearTo(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  />
                </div>
                <input
                  type="text"
                  className="filter-input filter-input--date"
                  placeholder="Exact date — e.g. 63-0825E"
                  value={exactDate}
                  onChange={(e) => setExactDate(e.target.value)}
                />
              </div>

              <div className="filter-section">
                <div className="filter-section-label">Sermon title</div>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Only search sermons whose title contains…"
                  value={titleFilter}
                  onChange={(e) => setTitleFilter(e.target.value)}
                />
              </div>

              <div className="filter-popover-footer">
                {hasFilters ? (
                  <button
                    className="filter-clear"
                    onClick={() => { setYearFrom(''); setYearTo(''); setTitleFilter(''); setExactDate(''); setMatchMode('phrase') }}
                  >
                    Clear filters
                  </button>
                ) : <span />}
                <button className="btn-primary btn-sm" onClick={() => setShowFilters(false)}>Done</button>
              </div>
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={handleSearch} disabled={isSearching || !query.trim()}>
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </div>
    </div>
  )
}
