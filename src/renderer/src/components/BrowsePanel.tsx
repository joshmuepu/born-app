import { useState, useCallback, useEffect, useRef } from 'react'
import type {
  Quote,
  SermonIndexItem,
  SeriesEntry,
  LocationState,
  DateTree,
  DateTreeYear
} from '../types'
import { refsOverlap } from '../../../shared/paragraphRef'
import './BrowsePanel.css'

interface Props {
  visible: boolean
  /** The sermon paragraph currently on the projector, so its row can be marked. */
  onScreen?: { sermonId: number; paragraphRef: string } | null
  onAddToQueue: (quote: Quote) => void
  onSendToProjection: (quote: Quote) => void
}

type BrowseTab = 'series' | 'location' | 'date'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** Weeks of the given month as rows of 7 cells; null = padding day. Monday-first. */
function monthGrid(year: number, month: number): Array<Array<number | null>> {
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7 // 0 = Monday
  const days = new Date(year, month, 0).getDate()
  const cells: Array<number | null> = Array(firstDow).fill(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: Array<Array<number | null>> = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export default function BrowsePanel({ visible, onScreen, onAddToQueue, onSendToProjection }: Props) {
  const [tab, setTab] = useState<BrowseTab>('series')

  // Language for paragraph drill-down (English by default; others fetched + cached).
  const [language, setLanguage] = useState<string>(
    () => localStorage.getItem('born.browseLanguage') || 'en'
  )
  const [languages, setLanguages] = useState<Record<string, string>>({})

  // Series tab
  const [seriesList, setSeriesList] = useState<SeriesEntry[]>([])
  const [seriesLoaded, setSeriesLoaded] = useState(false)

  // Location tab
  const [locationTree, setLocationTree] = useState<LocationState[]>([])
  const [locationLoaded, setLocationLoaded] = useState(false)
  const [selectedState, setSelectedState] = useState<LocationState | null>(null)
  const [locFilter, setLocFilter] = useState('')

  // Date tab
  const [dateTree, setDateTree] = useState<DateTree | null>(null)
  const [dateLoaded, setDateLoaded] = useState(false)
  /** null = the year grid; otherwise the current drill-down. */
  const [dateFocus, setDateFocus] = useState<{
    year: number
    month: number | null
    day: number | null
  } | null>(null)
  /** Which calendar month is on screen (1-12) once a year is picked. */
  const [calMonth, setCalMonth] = useState(1)

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
    const tree = (await window.electronAPI.getBrowseLocation()) as LocationState[]
    setLocationTree(tree)
    setLocationLoaded(true)
  }, [locationLoaded])

  const loadDate = useCallback(async () => {
    if (dateLoaded) return
    const data = (await window.electronAPI.getBrowseDateTree()) as DateTree
    setDateTree(data)
    setDateLoaded(true)
  }, [dateLoaded])

  const switchTab = useCallback((t: BrowseTab) => {
    setTab(t)
    setBrowsedSermons([])
    setSelectedSermon(null)
    setParagraphs([])
    setGroupLabel('')
    setSelectedState(null)
    setLocFilter('')
    setDateFocus(null)
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

  const loadParagraphs = useCallback(
    async (sermon: SermonIndexItem, lang = language) => {
      setSelectedSermon(sermon)
      setLoadingParagraphs(true)
      setParagraphs([])
      try {
        const paras = await window.electronAPI.getSermonParagraphs(sermon.id, lang)
        setParagraphs(paras)
      } finally {
        setLoadingParagraphs(false)
      }
    },
    [language]
  )

  const changeLanguage = useCallback(
    (lang: string) => {
      setLanguage(lang)
      try {
        localStorage.setItem('born.browseLanguage', lang)
      } catch {
        /* ignore */
      }
      if (selectedSermon) loadParagraphs(selectedSermon, lang)
    },
    [selectedSermon, loadParagraphs]
  )

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
              {s.duration_min ? `${s.duration_min} min` : ''}
              {s.is_book ? `${s.duration_min ? ' · ' : ''}Book` : ''}
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
          {paragraphs.map((q) => {
            const live =
              !!onScreen &&
              onScreen.sermonId === q.sermonId &&
              refsOverlap(onScreen.paragraphRef, q.paragraphRef)
            return (
            <div
              key={q.paragraphRef}
              className={`browse-para-item${live ? ' browse-para-item--on-screen' : ''}`}
            >
              <div className="browse-para-ref">
                {q.paragraphRef}
                {live && <span className="on-screen-tag">On screen</span>}
              </div>
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
            )
          })}
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

  const renderLocationFilter = (): JSX.Element => (
    <div className="browse-filter">
      <input
        className="search-input"
        placeholder="Filter by city or state…"
        value={locFilter}
        onChange={(e) => setLocFilter(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && locFilter) { e.preventDefault(); setLocFilter('') } }}
      />
      {locFilter && (
        <button className="search-clear" onClick={() => setLocFilter('')} title="Clear (Esc)" aria-label="Clear filter">×</button>
      )}
    </div>
  )

  const renderLocation = (): JSX.Element => {
    if (selectedSermon) return renderParagraphs()
    if (browsedSermons.length > 0) return renderSermonList()

    const q = locFilter.trim().toLowerCase()

    // Typing flattens the whole tree to matching "City — State" rows.
    if (q) {
      const matches: Array<{
        key: string
        city: { id: number; name: string; sermonIds: number[] }
        state: LocationState
      }> = []
      for (const st of locationTree) {
        const stateHit = st.name.toLowerCase().includes(q)
        for (const c of st.cities) {
          if (stateHit || c.name.toLowerCase().includes(q)) {
            matches.push({ key: `${st.id}-${c.id}`, city: c, state: st })
          }
        }
      }
      matches.sort((a, b) => a.city.name.localeCompare(b.city.name))
      return (
        <div className="browse-sermons">
          {renderLocationFilter()}
          <div className="browse-list">
            {matches.length === 0 && (
              <div className="browse-empty">No places match “{locFilter.trim()}”.</div>
            )}
            {matches.map((m) => (
              <div
                key={m.key}
                className="browse-item"
                onClick={() => loadSermonsForIds(m.city.sermonIds, `${m.city.name}, ${m.state.name}`)}
              >
                <div className="browse-item-title">{m.city.name}</div>
                <div className="browse-item-meta">
                  {m.state.name} · {m.city.sermonIds.length} sermon{m.city.sermonIds.length === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (selectedState) {
      return (
        <div className="browse-sermons">
          {renderLocationFilter()}
          <div className="browse-back-row">
            <button className="browse-back" onClick={() => setSelectedState(null)}>← Back</button>
            <span className="browse-group-label">{selectedState.name}</span>
            <span className="browse-count">{selectedState.cities.length} cities</span>
          </div>
          <div className="browse-list">
            {selectedState.cities.map((c) => (
              <div
                key={c.id}
                className="browse-item"
                onClick={() => loadSermonsForIds(c.sermonIds, `${c.name}`)}
              >
                <div className="browse-item-title">{c.name}</div>
                <div className="browse-item-meta">
                  {c.sermonIds.length} sermon{c.sermonIds.length === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="browse-sermons">
        {renderLocationFilter()}
        <div className="browse-list">
          {!locationLoaded && <div className="browse-loading">Loading locations…</div>}
          {locationLoaded && locationTree.length === 0 && (
            <div className="browse-empty">Location list unavailable.</div>
          )}
          {locationTree.map((s) => (
            <div key={s.id} className="browse-item" onClick={() => setSelectedState(s)}>
              <div className="browse-item-title">{s.name}</div>
              <div className="browse-item-meta">
                {s.cities.length} cit{s.cities.length === 1 ? 'y' : 'ies'} ·{' '}
                {s.cities.reduce((n, c) => n + c.sermonIds.length, 0)} sermons
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Date tab ──────────────────────────────────────────────────────────────────

  /** Load the sermons for the current date focus and set the breadcrumb label. */
  const loadDateSelection = useCallback(
    (year: DateTreeYear, month: number | null, day: number | null) => {
      if (day != null && month != null) {
        const mo = year.months.find((m) => m.month === month)
        const dd = mo?.days.find((d) => d.day === day)
        loadSermonsForIds(dd?.ids ?? [], `${MONTHS[month - 1]} ${day}, ${year.year}`)
      } else if (month != null) {
        const mo = year.months.find((m) => m.month === month)
        const ids = [...(mo?.days.flatMap((d) => d.ids) ?? []), ...(mo?.unknownDayIds ?? [])]
        loadSermonsForIds(ids, `${MONTHS[month - 1]} ${year.year}`)
      } else {
        const ids = [
          ...year.months.flatMap((m) => m.days.flatMap((d) => d.ids)),
          ...year.months.flatMap((m) => m.unknownDayIds),
          ...year.unknownMonthIds
        ]
        loadSermonsForIds(ids, String(year.year))
      }
    },
    [loadSermonsForIds]
  )

  const pickYear = useCallback(
    (y: DateTreeYear) => {
      const firstMonth = y.months[0]?.month ?? 1
      setDateFocus({ year: y.year, month: null, day: null })
      setCalMonth(firstMonth)
      loadDateSelection(y, null, null)
    },
    [loadDateSelection]
  )

  const renderDate = (): JSX.Element => {
    if (selectedSermon) return renderParagraphs()
    if (!dateTree) return <div className="browse-loading">Loading dates…</div>

    // Year grid.
    if (!dateFocus) {
      return (
        <div className="browse-list browse-year-grid">
          {dateTree.years.map((y) => (
            <button key={y.year} className="browse-year-cell" onClick={() => pickYear(y)}>
              <span className="browse-year-num">{y.year}</span>
              <span className="browse-year-count">{y.count}</span>
            </button>
          ))}
          {dateTree.undatedIds.length > 0 && (
            <button
              className="browse-year-cell browse-year-cell--undated"
              onClick={() => loadSermonsForIds(dateTree.undatedIds, 'Church Age Book & undated')}
            >
              <span className="browse-year-num">Undated</span>
              <span className="browse-year-count">{dateTree.undatedIds.length}</span>
            </button>
          )}
        </div>
      )
    }

    const year = dateTree.years.find((y) => y.year === dateFocus.year)
    if (!year) {
      setDateFocus(null)
      return <div className="browse-loading">…</div>
    }
    const month = year.months.find((m) => m.month === calMonth)
    const dayIds = new Map<number, number>() // day → sermon count
    month?.days.forEach((d) => dayIds.set(d.day, d.ids.length))

    return (
      <div className="browse-date">
        <div className="browse-date-picker">
          <div className="browse-crumbs">
            <button className="browse-crumb" onClick={() => setDateFocus(null)}>All years</button>
            <span className="browse-crumb-sep">›</span>
            <button
              className={`browse-crumb${dateFocus.month == null ? ' is-current' : ''}`}
              onClick={() => { setDateFocus({ year: year.year, month: null, day: null }); loadDateSelection(year, null, null) }}
            >
              {year.year}
            </button>
            {dateFocus.month != null && (
              <>
                <span className="browse-crumb-sep">›</span>
                <button
                  className={`browse-crumb${dateFocus.day == null ? ' is-current' : ''}`}
                  onClick={() => { setDateFocus({ year: year.year, month: dateFocus.month, day: null }); loadDateSelection(year, dateFocus.month, null) }}
                >
                  {MONTHS_SHORT[dateFocus.month - 1]}
                </button>
              </>
            )}
            {dateFocus.day != null && (
              <>
                <span className="browse-crumb-sep">›</span>
                <span className="browse-crumb is-current">{dateFocus.day}</span>
              </>
            )}
          </div>

          <div className="browse-month-pills">
            {MONTHS_SHORT.map((label, i) => {
              const m = i + 1
              const has = year.months.find((mm) => mm.month === m)
              return (
                <button
                  key={m}
                  className={`browse-month-pill${calMonth === m ? ' is-shown' : ''}${dateFocus.month === m ? ' is-selected' : ''}`}
                  disabled={!has}
                  onClick={() => {
                    setCalMonth(m)
                    setDateFocus({ year: year.year, month: m, day: null })
                    loadDateSelection(year, m, null)
                  }}
                >
                  {label}
                  {has && <span className="browse-month-pill-count">{has.count}</span>}
                </button>
              )
            })}
          </div>

          <div className="browse-cal">
            <div className="browse-cal-title">{MONTHS[calMonth - 1]} {year.year}</div>
            <div className="browse-cal-grid">
              {WEEKDAYS.map((w) => (
                <div key={w} className="browse-cal-dow">{w}</div>
              ))}
              {monthGrid(year.year, calMonth).flat().map((d, i) => {
                if (d == null) return <div key={i} className="browse-cal-cell is-empty" />
                const n = dayIds.get(d)
                const selected = dateFocus.day === d && dateFocus.month === calMonth
                return (
                  <button
                    key={i}
                    className={`browse-cal-cell${n ? ' has-sermons' : ''}${selected ? ' is-selected' : ''}`}
                    disabled={!n}
                    onClick={() => {
                      setDateFocus({ year: year.year, month: calMonth, day: d })
                      loadDateSelection(year, calMonth, d)
                    }}
                  >
                    <span className="browse-cal-day">{d}</span>
                    {n ? <span className="browse-cal-dot">{n}</span> : null}
                  </button>
                )
              })}
            </div>
            {month && month.unknownDayIds.length > 0 && (
              <button
                className="browse-cal-unknown"
                onClick={() => { setDateFocus({ year: year.year, month: calMonth, day: null }); loadDateSelection(year, calMonth, null) }}
              >
                + {month.unknownDayIds.length} in {MONTHS[calMonth - 1]} with no exact day
              </button>
            )}
            {year.unknownMonthIds.length > 0 && (
              <button
                className="browse-cal-unknown"
                onClick={() => loadSermonsForIds(year.unknownMonthIds, `${year.year} — month unknown`)}
              >
                + {year.unknownMonthIds.length} in {year.year} with no month
              </button>
            )}
          </div>
        </div>

        <div className="browse-date-results">
          <div className="browse-back-row">
            <span className="browse-group-label">{groupLabel}</span>
            <span className="browse-count">{browsedSermons.length} sermon{browsedSermons.length === 1 ? '' : 's'}</span>
          </div>
          <div className="browse-list">
            {browsedSermons.map((s) => (
              <div key={s.id} className="browse-item" onClick={() => loadParagraphs(s)}>
                <div className="browse-item-code">{s.date_code}</div>
                <div className="browse-item-title">{s.title}</div>
                <div className="browse-item-meta">
                  {s.duration_min ? `${s.duration_min} min` : ''}
                  {s.is_book ? `${s.duration_min ? ' · ' : ''}Book` : ''}
                </div>
              </div>
            ))}
            {browsedSermons.length === 0 && (
              <div className="browse-empty">Nothing here.</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Load the first tab + language list the first time the panel becomes visible
  // (not before — keeps startup light and avoids a network call if Browse is
  // never opened).
  const langsRequested = useRef(false)
  useEffect(() => {
    if (!visible) return
    loadSeries()
    if (!langsRequested.current) {
      langsRequested.current = true
      window.electronAPI.getLanguages().then((l) => setLanguages(l ?? {}))
    }
  }, [visible, loadSeries])

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
        {Object.keys(languages).length > 0 && (
          <select
            className="language-select browse-language"
            value={language}
            onChange={(e) => changeLanguage(e.target.value)}
            title="Quote language"
          >
            <option value="en">English</option>
            {Object.entries(languages)
              .filter(([code]) => code !== 'en')
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
          </select>
        )}
      </div>

      <div className="browse-content">
        {tab === 'series' && renderSeries()}
        {tab === 'location' && renderLocation()}
        {tab === 'date' && renderDate()}
      </div>
    </div>
  )
}
