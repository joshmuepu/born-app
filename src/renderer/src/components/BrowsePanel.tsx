import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { ChevronLeft, X, CalendarDays, BookOpen, MapPin, Clock } from 'lucide-react'
import VirtualList from './VirtualList'
import { startQueueDrag } from '../dragItem'
import { useContextMenu } from './ContextMenu'
import { quoteMenu } from '../contextMenus'
import { useAppActions } from '../AppActions'
import { toggleFavorite, loadFavorites } from '../favorites'
import type { MenuItem } from './ContextMenu'
import SermonModeStrip, { type SermonMode } from './SermonModeStrip'
import DrillShell, { ViewToggle, useBrowseView, useBackslashToggle } from './DrillShell'
import type {
  Quote,
  SermonIndexItem,
  SeriesEntry,
  LocationState,
  DateTree,
  DateTreeYear
} from '../types'
import { quoteToItem } from '../../../shared/queueItem'
import './BrowsePanel.css'

interface Props {
  visible: boolean
  /** The sermon paragraph currently on the projector, so its row can be marked. */
  onScreen?: { sermonId: number; paragraphRef: string } | null
  onAddToQueue: (quote: Quote) => void
  /** `slideIndex` projects that exact sub-paragraph of `quote` — a source row
   *  can span several numbered paragraphs ("156-157"), so which flattened
   *  row was clicked has to reach the projector as that specific paragraph. */
  onSendToProjection: (quote: Quote, slideIndex?: number) => void
  /** Seeds the paragraph-drill-down language from this instead of the shared
   *  'born.browseLanguage' localStorage key, and skips that key entirely
   *  (read and write) for this instance — same reasoning as BiblePanel's
   *  `initialTranslation`: a second channel's BrowsePanel must never inherit
   *  Main's last-used language, or silently change what Main defaults to
   *  next launch. Main's own instance doesn't pass this. */
  initialLanguage?: string
  /** The unified strip also carries a Search entry — this leaves Browse for it. */
  onGoSearch?: () => void
  /** A sermon was opened in the reading pane (for back/forward history). */
  onSermonOpened?: (s: { id: number; title: string }) => void
  /** Ask Browse to switch to a mode (from the strip shown on the search view). */
  modeRequest?: { tab: 'date' | 'series' | 'location' | 'recent'; nonce: number } | null
}

type BrowseTab = 'series' | 'location' | 'date' | 'recent'

/** Make a clickable div keyboard-operable (Enter / Space). */
function activate(onClick: () => void): {
  role: 'button'
  tabIndex: number
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
} {
  return {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    }
  }
}

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

export default function BrowsePanel({
  visible,
  onScreen,
  onAddToQueue,
  onSendToProjection,
  initialLanguage,
  onGoSearch,
  onSermonOpened,
  modeRequest
}: Props) {
  // "Pull up last Sunday" is the most common live-service need, so Date leads.
  const actions = useAppActions()
  const ctx = useContextMenu()
  const [tab, setTab] = useState<BrowseTab>('date')

  // Language for paragraph drill-down (English by default; others fetched + cached).
  const [language, setLanguage] = useState<string>(
    () => initialLanguage ?? (localStorage.getItem('born.browseLanguage') || 'en')
  )
  const [languages, setLanguages] = useState<Record<string, string>>({})

  // Born Again drill-down: the browse columns sit on the left, the sermon text
  // always opens on the right. Grid or list is the operator's choice (remembered);
  // the columns can slide away so the text gets the full width.
  const [view, chooseView] = useBrowseView()
  const [collapsed, setCollapsed] = useState(false)

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

  // Recently Played tab
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([])
  const [recentLoaded, setRecentLoaded] = useState(false)

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

  const loadRecent = useCallback(async () => {
    const data = await window.electronAPI.getRecentSermons()
    setRecentQuotes(data)
    setRecentLoaded(true)
  }, [])

  const clearRecent = useCallback(async () => {
    await window.electronAPI.clearRecentSermons()
    setRecentQuotes([])
  }, [])

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
    if (t === 'recent') loadRecent()
  }, [loadSeries, loadLocation, loadDate, loadRecent])

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
      onSermonOpened?.({ id: sermon.id, title: sermon.title })
      setLoadingParagraphs(true)
      setParagraphs([])
      try {
        const paras = await window.electronAPI.getSermonParagraphs(sermon.id, lang)
        setParagraphs(paras)
      } finally {
        setLoadingParagraphs(false)
      }
    },
    [language, onSermonOpened]
  )

  const changeLanguage = useCallback(
    (lang: string) => {
      setLanguage(lang)
      if (initialLanguage === undefined) {
        try {
          localStorage.setItem('born.browseLanguage', lang)
        } catch {
          /* ignore */
        }
      }
      if (selectedSermon) loadParagraphs(selectedSermon, lang)
    },
    [selectedSermon, loadParagraphs, initialLanguage]
  )

  // ── Render helpers ────────────────────────────────────────────────────────────

  /** Right-click a sermon in the list: open it, favorite it, copy its name. */
  const sermonItemMenu = (s: SermonIndexItem): MenuItem[] => {
    const id = `S:${s.id}`
    const on = loadFavorites().some((f) => f.id === id)
    return [
      { id: 'open', label: 'Open this sermon', onSelect: () => loadParagraphs(s) },
      {
        id: 'fav',
        label: on ? 'Remove from favorites' : 'Favorite this sermon',
        onSelect: () => {
          const nowOn = toggleFavorite({
            id,
            kind: 'sermon',
            title: s.title,
            subtitle: `${s.date_code} · ${s.para_count}¶`,
            quote: {
              text: '',
              sermonTitle: s.title,
              dateCode: s.date_code,
              sermonId: s.id,
              paragraphIndex: 0,
              paragraphRef: ''
            }
          })
          actions.notify(nowOn ? 'Added to favorites' : 'Removed from favorites')
        }
      },
      {
        id: 'copy',
        label: 'Copy title and date',
        onSelect: () => void navigator.clipboard?.writeText(`${s.title} (${s.date_code})`).then(() => actions.notify('Copied the title'))
      }
    ]
  }

  const renderSermonList = (): JSX.Element => (
    <div className="browse-sermons">
      <div className="browse-back-row">
        <button className="browse-back" onClick={() => { setBrowsedSermons([]); setSelectedSermon(null); setParagraphs([]) }}>
          <ChevronLeft width={14} height={14} strokeWidth={2.4} /> Back
        </button>
        <span className="browse-group-label">{groupLabel}</span>
        <span className="browse-count">{browsedSermons.length} sermons</span>
      </div>
      <div className="browse-list browse-list--grid">
        {browsedSermons.map((s) => (
          <div
            key={s.id}
            className={`browse-item${selectedSermon?.id === s.id ? ' selected' : ''}`}
            {...activate(() => loadParagraphs(s))}
            {...ctx.bind(() => sermonItemMenu(s))}
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

  // One row per page of each paragraph ("1a", "1b" …) — the same split the
  // projector uses, so a row can never differ from what goes on screen.
  const paragraphSlides = useMemo(
    () =>
      paragraphs.flatMap((q) =>
        quoteToItem(q).slides.map((s, slideIndex) => ({
          q,
          slideIndex,
          marker: s.marker ?? q.paragraphRef,
          text: s.text
        }))
      ),
    [paragraphs]
  )

  const renderParagraphs = (): JSX.Element => (
    <div className="browse-paragraphs">
      <div className="browse-back-row">
        <button className="browse-back browse-back--stack" onClick={() => { setSelectedSermon(null); setParagraphs([]) }}>
          <ChevronLeft width={14} height={14} strokeWidth={2.4} /> Back
        </button>
        <span className="browse-group-label">{selectedSermon?.title}</span>
        <span className="browse-count">{selectedSermon?.date_code}{paragraphs.length ? ` · ${paragraphs.length}¶` : ''}</span>
      </div>
      {loadingParagraphs ? (
        <div className="browse-loading">Loading paragraphs…</div>
      ) : (
        <VirtualList
          className="browse-list browse-list--virtual"
          items={paragraphSlides}
          estimateSize={128}
          threshold={400}
          gap={2}
          paddingStart={8}
          paddingEnd={24}
          itemKey={(p) => `${p.q.paragraphRef}:${p.slideIndex}`}
          renderItem={({ q, slideIndex, marker, text }) => {
            // Exact match, not refsOverlap: this list is already one row per
            // page ("1a", "1b", …), so refsOverlap's numeric-only comparison
            // (it ignores the letter suffix) would mark every page of the
            // same paginated paragraph as on-screen at once.
            const live = !!onScreen && onScreen.sermonId === q.sermonId && onScreen.paragraphRef === marker
            return (
              <div
                className={`browse-para-item${live ? ' browse-para-item--on-screen' : ''}`}
                draggable
                onDragStart={(e) => startQueueDrag(e, { type: 'quote', quote: q })}
                {...ctx.bind(() =>
                  quoteMenu(q, {
                    actions,
                    project: () => onSendToProjection(q, slideIndex),
                    addToQueue: () => onAddToQueue(q),
                    openSermon: false
                  })
                )}
              >
                <div className="browse-para-ref">
                  {marker}
                  {live && <span className="on-screen-tag">On screen</span>}
                </div>
                <div className="browse-para-text">{text}</div>
                <div className="browse-para-actions">
                  <button className="btn-secondary btn-sm" onClick={() => onAddToQueue(q)}>
                    + Queue
                  </button>
                  <button className="btn-primary btn-sm" onClick={() => onSendToProjection(q, slideIndex)}>
                    Project
                  </button>
                </div>
              </div>
            )
          }}
        />
      )}
      {paragraphs.length === 0 && !loadingParagraphs && (
        <div className="browse-empty">No paragraphs found</div>
      )}
    </div>
  )

  // ── Series tab ────────────────────────────────────────────────────────────────

  const renderSeries = (): JSX.Element => {
    if (browsedSermons.length > 0) return renderSermonList()
    return (
      <div className="browse-list browse-list--grid">
        {seriesList.length === 0 && <div className="browse-loading">Loading series…</div>}
        {seriesList.map((s) => (
          <div
            key={s.i}
            className="browse-item"
            {...activate(() => loadSermonsForIds(s.s, s.n))}
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
        <button className="search-clear" onClick={() => setLocFilter('')} title="Clear (Esc)" aria-label="Clear filter"><X width={13} height={13} strokeWidth={2.4} /></button>
      )}
    </div>
  )

  const renderLocation = (): JSX.Element => {
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
          <div className="browse-list browse-list--grid">
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
            <button className="browse-back" onClick={() => setSelectedState(null)}><ChevronLeft width={14} height={14} strokeWidth={2.4} /> Back</button>
            <span className="browse-group-label">{selectedState.name}</span>
            <span className="browse-count">{selectedState.cities.length} cities</span>
          </div>
          <div className="browse-list browse-list--grid">
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
        <div className="browse-list browse-list--grid">
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
          <div className="browse-list browse-list--grid">
            {browsedSermons.map((s) => (
              <div
                key={s.id}
                className={`browse-item${selectedSermon?.id === s.id ? ' selected' : ''}`}
                {...activate(() => loadParagraphs(s))}
                {...ctx.bind(() => sermonItemMenu(s))}
              >
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

  // ── Recently Played tab ───────────────────────────────────────────────────────

  const renderRecent = (): JSX.Element => (
    <div className="browse-sermons">
      <div className="browse-back-row">
        <span className="browse-group-label">Recently played</span>
        {recentQuotes.length > 0 && (
          <button className="browse-back" onClick={clearRecent}>Clear</button>
        )}
      </div>
      {!recentLoaded ? (
        <div className="browse-loading">Loading…</div>
      ) : recentQuotes.length === 0 ? (
        <div className="browse-empty">
          Sermon quotes you queue or project show up here, newest first.
        </div>
      ) : (
        <div className="browse-list">
          {recentQuotes.flatMap((q, i) =>
            quoteToItem(q).slides.map((s, slideIndex) => {
              const marker = s.marker ?? q.paragraphRef
              // Exact match — see the same note in the Date/Series list above.
              const live = !!onScreen && onScreen.sermonId === q.sermonId && onScreen.paragraphRef === marker
              return (
                <div key={`${i}:${slideIndex}`} className={`browse-para-item${live ? ' browse-para-item--on-screen' : ''}`}>
                  <div className="browse-para-ref">
                    {q.sermonTitle} · {q.dateCode} · ¶{marker}
                    {live && <span className="on-screen-tag">On screen</span>}
                  </div>
                  <div className="browse-para-text">{s.text}</div>
                  <div className="browse-para-actions">
                    <button className="btn-secondary btn-sm" onClick={() => onAddToQueue(q)}>+ Queue</button>
                    <button className="btn-primary btn-sm" onClick={() => onSendToProjection(q, slideIndex)}>
                      {live ? 'Restart here' : 'Project'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )

  // Load the first tab + language list the first time the panel becomes visible
  // (not before — keeps startup light and avoids a network call if Browse is
  // never opened).
  const langsRequested = useRef(false)
  useEffect(() => {
    if (!visible) return
    loadDate()
    if (!langsRequested.current) {
      langsRequested.current = true
      window.electronAPI.getLanguages().then((l) => setLanguages(l ?? {}))
    }
  }, [visible, loadDate])

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), [])
  useBackslashToggle(visible, toggleCollapsed)

  // The strip on the sermon search view can send us to a mode.
  const lastModeNonce = useRef(0)
  useEffect(() => {
    if (modeRequest && modeRequest.nonce !== lastModeNonce.current) {
      lastModeNonce.current = modeRequest.nonce
      switchTab(modeRequest.tab)
    }
  }, [modeRequest, switchTab])

  const split = tab !== 'recent'

  return (
    <div
      className="browse-panel"
      data-view={view}
      data-collapsed={collapsed && split}
      data-open={selectedSermon ? 'true' : 'false'}
    >
      <SermonModeStrip
        active={tab}
        onSelect={(m: SermonMode) => (m === 'search' ? onGoSearch?.() : switchTab(m))}
        tools={
          <>
            {Object.keys(languages).length > 0 && (
              <select
                className="language-select browse-language"
                value={language}
                onChange={(e) => changeLanguage(e.target.value)}
                title="Quote language"
                aria-label="Quote language"
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
            <ViewToggle view={view} onChange={chooseView} />
          </>
        }
      />

      {split ? (
        <DrillShell
          open={!!selectedSermon}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          leftClassName="browse-left"
          rightClassName="browse-right"
          left={
            <div className="browse-content">
              {tab === 'series' && renderSeries()}
              {tab === 'location' && renderLocation()}
              {tab === 'date' && renderDate()}
            </div>
          }
          right={
            selectedSermon ? (
              renderParagraphs()
            ) : (
              <div className="drill-idle">
                <BookOpen width={28} height={28} strokeWidth={1.5} aria-hidden="true" />
                <p>Pick a sermon — the text opens here.</p>
              </div>
            )
          }
        />
      ) : (
        <div className="browse-content">{renderRecent()}</div>
      )}
      {ctx.element}
    </div>
  )
}
