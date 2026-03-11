import { useState, useCallback, useEffect } from 'react'
import type { Quote, SermonIndexItem, SeriesEntry, StateEntry, CityEntry, DateGroup } from '../types'
import './BrowsePanel.css'

interface Props {
  onAddToQueue: (quote: Quote) => void
  onSendToProjection: (quote: Quote) => void
}

type BrowseTab = 'series' | 'location' | 'date'

export default function BrowsePanel({ onAddToQueue, onSendToProjection }: Props) {
  const [tab, setTab] = useState<BrowseTab>('series')

  // Series tab
  const [seriesList, setSeriesList] = useState<SeriesEntry[]>([])
  const [seriesLoaded, setSeriesLoaded] = useState(false)

  // Location tab
  const [statesList, setStatesList] = useState<StateEntry[]>([])
  const [citiesMap, setCitiesMap] = useState<Map<number, string>>(new Map())
  const [locationLoaded, setLocationLoaded] = useState(false)
  const [selectedState, setSelectedState] = useState<StateEntry | null>(null)

  // Date tab
  const [dateGroups, setDateGroups] = useState<DateGroup[]>([])
  const [dateLoaded, setDateLoaded] = useState(false)

  // Shared: sermon list + paragraph drill-down
  const [browsedSermons, setBrowsedSermons] = useState<SermonIndexItem[]>([])
  const [selectedSermon, setSelectedSermon] = useState<SermonIndexItem | null>(null)
  const [paragraphs, setParagraphs] = useState<Quote[]>([])
  const [loadingParagraphs, setLoadingParagraphs] = useState(false)
  const [groupLabel, setGroupLabel] = useState('')

  // ── Tab loaders ──────────────────────────────────────────────────────────────

  const loadSeries = useCallback(async () => {
    if (seriesLoaded) return
    const data = await window.electronAPI.getBrowseSeries() as SeriesEntry[]
    setSeriesList(data)
    setSeriesLoaded(true)
  }, [seriesLoaded])

  const loadLocation = useCallback(async () => {
    if (locationLoaded) return
    const [states, cities] = await Promise.all([
      window.electronAPI.getBrowseStates() as Promise<StateEntry[]>,
      window.electronAPI.getBrowseCities() as Promise<CityEntry[]>
    ])
    setStatesList(states)
    const map = new Map<number, string>()
    for (const c of cities) map.set(c.i, c.n)
    setCitiesMap(map)
    setLocationLoaded(true)
  }, [locationLoaded])

  const loadDate = useCallback(async () => {
    if (dateLoaded) return
    const data = await window.electronAPI.getBrowseDateGroups() as DateGroup[]
    setDateGroups(data)
    setDateLoaded(true)
  }, [dateLoaded])

  const switchTab = useCallback((t: BrowseTab) => {
    setTab(t)
    setBrowsedSermons([])
    setSelectedSermon(null)
    setParagraphs([])
    setGroupLabel('')
    setSelectedState(null)
    if (t === 'series') loadSeries()
    if (t === 'location') loadLocation()
    if (t === 'date') loadDate()
  }, [loadSeries, loadLocation, loadDate])

  // ── Sermon list loading ───────────────────────────────────────────────────────

  const loadSermonsForIds = useCallback(async (ids: number[], label: string) => {
    const sermons = await window.electronAPI.getSermonsByIds(ids) as SermonIndexItem[]
    setBrowsedSermons(sermons)
    setSelectedSermon(null)
    setParagraphs([])
    setGroupLabel(label)
  }, [])

  // ── Paragraph loading ─────────────────────────────────────────────────────────

  const loadParagraphs = useCallback(async (sermon: SermonIndexItem) => {
    setSelectedSermon(sermon)
    setLoadingParagraphs(true)
    setParagraphs([])
    try {
      const paras = await window.electronAPI.getSermonParagraphs(sermon.id, 'en')
      setParagraphs(paras)
    } finally {
      setLoadingParagraphs(false)
    }
  }, [])

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderSermonList = (): JSX.Element => (
    <div className="browse-sermons">
      <div className="browse-back-row">
        <button className="browse-back" onClick={() => { setBrowsedSermons([]); setSelectedSermon(null); setParagraphs([]) }}>
          ← Back
        </button>
        <span className="browse-group-label">{groupLabel}</span>
        <span className="browse-count">{browsedSermons.length} sermons</span>
      </div>
      <div className="browse-list">
        {browsedSermons.map((s) => (
          <div
            key={s.id}
            className={`browse-item${selectedSermon?.id === s.id ? ' selected' : ''}`}
            onClick={() => loadParagraphs(s)}
          >
            <div className="browse-item-code">{s.date_code}</div>
            <div className="browse-item-title">{s.title}</div>
            <div className="browse-item-meta">
              {s.para_count} paragraphs · {s.duration_min}m{s.is_book ? ' · Book' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderParagraphs = (): JSX.Element => (
    <div className="browse-paragraphs">
      <div className="browse-back-row">
        <button className="browse-back" onClick={() => { setSelectedSermon(null); setParagraphs([]) }}>
          ← Back
        </button>
        <span className="browse-group-label">{selectedSermon?.title}</span>
        <span className="browse-count">{selectedSermon?.date_code}</span>
      </div>
      {loadingParagraphs ? (
        <div className="browse-loading">Loading paragraphs…</div>
      ) : (
        <div className="browse-list">
          {paragraphs.map((q) => (
            <div key={q.paragraphRef} className="browse-para-item">
              <div className="browse-para-ref">{q.paragraphRef}</div>
              <div className="browse-para-text">{q.text}</div>
              <div className="browse-para-actions">
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => onAddToQueue(q)}
                >
                  + Queue
                </button>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => onSendToProjection(q)}
                >
                  Project
                </button>
              </div>
            </div>
          ))}
          {paragraphs.length === 0 && !loadingParagraphs && (
            <div className="browse-empty">No paragraphs found</div>
          )}
        </div>
      )}
    </div>
  )

  // ── Series tab ────────────────────────────────────────────────────────────────

  const renderSeries = (): JSX.Element => {
    if (selectedSermon) return renderParagraphs()
    if (browsedSermons.length > 0) return renderSermonList()
    return (
      <div className="browse-list">
        {seriesList.length === 0 && <div className="browse-loading">Loading series…</div>}
        {seriesList.map((s) => (
          <div
            key={s.i}
            className="browse-item"
            onClick={() => loadSermonsForIds(s.s, s.n)}
          >
            <div className="browse-item-title">{s.n}</div>
            <div className="browse-item-meta">{s.s.length} sermons</div>
          </div>
        ))}
      </div>
    )
  }

  // ── Location tab ──────────────────────────────────────────────────────────────

  const renderLocation = (): JSX.Element => {
    if (selectedSermon) return renderParagraphs()
    if (browsedSermons.length > 0) return renderSermonList()
    if (selectedState) {
      return (
        <div className="browse-sermons">
          <div className="browse-back-row">
            <button className="browse-back" onClick={() => setSelectedState(null)}>← Back</button>
            <span className="browse-group-label">{selectedState.n}</span>
            <span className="browse-count">{selectedState.c.length} cities</span>
          </div>
          <div className="browse-list">
            {selectedState.c.map((cityId) => {
              const cityName = citiesMap.get(cityId) ?? `City ${cityId}`
              return (
                <div key={cityId} className="browse-item">
                  <div className="browse-item-title">{cityName}</div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return (
      <div className="browse-list">
        {statesList.length === 0 && <div className="browse-loading">Loading locations…</div>}
        {statesList.map((s) => (
          <div key={s.i} className="browse-item" onClick={() => setSelectedState(s)}>
            <div className="browse-item-title">{s.n}</div>
            <div className="browse-item-meta">{s.c.length} cities</div>
          </div>
        ))}
      </div>
    )
  }

  // ── Date tab ──────────────────────────────────────────────────────────────────

  const renderDate = (): JSX.Element => {
    if (selectedSermon) return renderParagraphs()
    if (browsedSermons.length > 0) return renderSermonList()
    return (
      <div className="browse-list">
        {dateGroups.length === 0 && <div className="browse-loading">Loading date groups…</div>}
        {dateGroups.map((g) => (
          <div
            key={g.label}
            className="browse-item"
            onClick={() => loadSermonsForIds(g.sermonIds, g.label)}
          >
            <div className="browse-item-title">{g.label}</div>
            <div className="browse-item-meta">{g.sermonIds.length} sermons</div>
          </div>
        ))}
      </div>
    )
  }

  // Load the first tab on mount
  useEffect(() => {
    loadSeries()
  }, [loadSeries])

  return (
    <div className="browse-panel">
      <div className="browse-tabs">
        <button
          className={`browse-tab${tab === 'series' ? ' active' : ''}`}
          onClick={() => switchTab('series')}
        >
          Series
        </button>
        <button
          className={`browse-tab${tab === 'location' ? ' active' : ''}`}
          onClick={() => switchTab('location')}
        >
          Location
        </button>
        <button
          className={`browse-tab${tab === 'date' ? ' active' : ''}`}
          onClick={() => switchTab('date')}
        >
          Date
        </button>
      </div>

      <div className="browse-content">
        {tab === 'series' && renderSeries()}
        {tab === 'location' && renderLocation()}
        {tab === 'date' && renderDate()}
      </div>
    </div>
  )
}
