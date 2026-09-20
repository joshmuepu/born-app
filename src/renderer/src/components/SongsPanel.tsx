import { useState, useEffect, useCallback, useRef, useMemo, type ReactElement } from 'react'
import { ChevronLeft, X, Search, ListMusic, Clock } from 'lucide-react'
import type { SongSummary, SongDetail } from '../types'
import { resultCountLabel } from '../../../shared/searchLimits'
import { highlight } from '../highlight'
import './SongsPanel.css'

interface Props {
  visible: boolean
  /** The song slide currently on the projector, so its card can be marked. */
  onScreen?: { songId: number; slideIndex: number } | null
  /** A song to open automatically (e.g. after projecting it from the queue). */
  focusSongId?: number | null
  onAddSong: (song: SongDetail) => void
  onProjectSong: (song: SongDetail, slide?: number) => void
}

const MIN_QUERY_LEN = 2

/** First letter to group/jump by — non-letters (numbers, punctuation) bucket
 *  under '#', same convention the remote's A-Z rail already uses. */
function letterOf(title: string): string {
  const ch = (title.trim()[0] ?? '#').toUpperCase()
  return /[A-Z]/.test(ch) ? ch : '#'
}

function groupByLetter(list: SongSummary[]): Array<{ letter: string; items: SongSummary[] }> {
  const groups: Array<{ letter: string; items: SongSummary[] }> = []
  for (const s of list) {
    const letter = letterOf(s.title)
    const last = groups[groups.length - 1]
    if (last && last.letter === letter) last.items.push(s)
    else groups.push({ letter, items: [s] })
  }
  return groups
}

const ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]

export default function SongsPanel({ visible, onScreen, focusSongId, onAddSong, onProjectSong }: Props) {
  const [tab, setTab] = useState<'search' | 'browse'>('search')
  const [browseSection, setBrowseSection] = useState<'all' | 'recent'>('all')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SongSummary[]>([])
  const [searched, setSearched] = useState(false)

  const [allSongs, setAllSongs] = useState<SongSummary[] | null>(null)
  const [allLoading, setAllLoading] = useState(false)
  const [recentSongs, setRecentSongs] = useState<SongSummary[]>([])
  const [recentLoaded, setRecentLoaded] = useState(false)

  const [selected, setSelected] = useState<SongDetail | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRecent = useCallback(() => {
    window.electronAPI.getRecentSongs().then((r) => {
      setRecentSongs(r)
      setRecentLoaded(true)
    })
  }, [])
  const loadAllSongs = useCallback(() => {
    setAllLoading(true)
    window.electronAPI.searchSongs('').then((r) => {
      setAllSongs(r)
      setAllLoading(false)
    })
  }, [])

  useEffect(() => {
    if (visible) loadRecent()
  }, [visible, loadRecent])
  useEffect(() => {
    if (visible && tab === 'browse' && browseSection === 'all' && allSongs === null) loadAllSongs()
  }, [visible, tab, browseSection, allSongs, loadAllSongs])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const q = query.trim()
    if (q.length < MIN_QUERY_LEN) {
      setResults([])
      setSearched(false)
      return
    }
    timer.current = setTimeout(() => {
      window.electronAPI.searchSongs(q).then((r) => {
        setResults(r)
        setSearched(true)
      })
    }, 200)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query])

  const openSong = useCallback((id: number) => {
    window.electronAPI.getSong(id).then(setSelected)
  }, [])

  const clearRecent = useCallback(() => {
    window.electronAPI.clearRecentSongs().then(() => setRecentSongs([]))
  }, [])

  // Open the song when it's projected from elsewhere (the queue or the web
  // remote). Fires only when focusSongId actually changes to a new song — not
  // every time `selected` changes — so the "← Songs" back button isn't
  // immediately undone by a still-set focusSongId.
  const lastFocus = useRef<number | null>(null)
  useEffect(() => {
    if (focusSongId != null && focusSongId !== lastFocus.current) openSong(focusSongId)
    lastFocus.current = focusSongId ?? null
  }, [focusSongId, openSong])

  /** Queue / project a song straight from a list row, no need to open it. */
  const queueSong = useCallback(
    (id: number) => {
      window.electronAPI.getSong(id).then((d) => {
        if (d) onAddSong(d)
        loadRecent()
      })
    },
    [onAddSong, loadRecent]
  )
  const projectSong = useCallback(
    (id: number) => {
      window.electronAPI.getSong(id).then((d) => {
        if (d) onProjectSong(d, 0)
        loadRecent()
      })
    },
    [onProjectSong, loadRecent]
  )
  const projectSlide = useCallback(
    (i: number) => {
      if (!selected) return
      onProjectSong(selected, i)
      loadRecent()
    },
    [selected, onProjectSong, loadRecent]
  )

  const handleImport = useCallback(async () => {
    setImportMsg('Importing…')
    const r = await window.electronAPI.importSongs()
    if (!r) {
      setImportMsg(null)
      return
    }
    const parts: string[] = []
    if (r.added.length) parts.push(`${r.added.length} added`)
    if (r.skipped) parts.push(`${r.skipped} already present`)
    if (r.failed.length) parts.push(`${r.failed.length} failed`)
    setImportMsg(parts.join(' · ') || 'Nothing imported')
    if (query.trim().length >= MIN_QUERY_LEN) window.electronAPI.searchSongs(query).then(setResults)
    setAllSongs(null)
    setTimeout(() => setImportMsg(null), 6000)
  }, [query])

  const handleDelete = useCallback(
    async (id: number) => {
      if (await window.electronAPI.deleteSong(id)) {
        setSelected(null)
        setAllSongs(null)
        if (query.trim().length >= MIN_QUERY_LEN) window.electronAPI.searchSongs(query).then(setResults)
      }
    },
    [query]
  )

  const rowMeta = (s: SongSummary): string =>
    [s.author, s.songKey ? `Key of ${s.songKey}` : null, `${s.slideCount} slide${s.slideCount === 1 ? '' : 's'}`]
      .filter(Boolean)
      .join(' · ')

  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const allGroups = useMemo(() => (allSongs ? groupByLetter(allSongs) : []), [allSongs])
  const availableLetters = useMemo(() => new Set(allGroups.map((g) => g.letter)), [allGroups])
  const jumpToLetter = (letter: string): void => {
    letterRefs.current[letter]?.scrollIntoView({ block: 'start' })
  }

  /** A song row shared by search results, the all-songs browse list, and
   *  the recently-played list — title + meta on the left, quick actions on
   *  the right, click the body to open the full slide list.
   *  A plain function, not a component: it closes over the row-local `s` and
   *  gets called as `renderSongRow(s)`, not `<SongRow s={s}/>` — a nested
   *  component declaration would get a fresh identity every render, which
   *  would make React remount every row instead of reconciling by key. */
  const renderSongRow = (s: SongSummary): ReactElement => {
    const showSnippet = s.matchedInTitle === false && !!s.matchSlide
    return (
      <div className="song-row" key={s.id}>
        <div className="song-row-body" role="button" tabIndex={0} onClick={() => openSong(s.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSong(s.id) } }}
        >
          <div className="song-row-title">
            {searched ? highlight(s.title, query) : s.title}
            {s.source === 'import' && <span className="song-row-badge">Imported</span>}
          </div>
          <div className="song-row-meta">{rowMeta(s)}</div>
          {showSnippet && s.matchSlide && (
            <div className="song-row-snippet">
              <span className="song-row-snippet-text">"{highlight(s.matchSlide.text, query)}"</span>
              <span className="song-row-snippet-tag">
                Matched in lyrics{s.matchSlide.label ? ` — ${s.matchSlide.label}` : ''}
              </span>
            </div>
          )}
        </div>
        <div className="song-row-actions">
          <button className="btn-quiet btn-sm" title="Add to the queue" onClick={() => queueSong(s.id)}>
            + Queue
          </button>
          <button className="btn-secondary btn-sm" title="Put on the screen now" onClick={() => projectSong(s.id)}>
            Project
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="songs-panel">
      <div className="panel-subtab-bar">
        <button className={`panel-subtab${tab === 'search' ? ' active' : ''}`} onClick={() => setTab('search')}>
          Search
        </button>
        <button className={`panel-subtab${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>
          Browse
        </button>
        <button className="btn-secondary btn-sm songs-import-btn" onClick={handleImport}>
          Import…
        </button>
      </div>
      {importMsg && <div className="songs-import-msg">{importMsg}</div>}

      {selected ? (
        <div className="song-detail">
          <div className="song-detail-head">
            <button className="browse-back" onClick={() => setSelected(null)}>
              <ChevronLeft width={14} height={14} strokeWidth={2.4} /> Songs
            </button>
            <div className="song-detail-title">
              {selected.title}
              {selected.author ? <span className="song-detail-author"> · {selected.author}</span> : null}
              {selected.songKey ? <span className="song-detail-key">Key of {selected.songKey}</span> : null}
            </div>
            <div className="result-actions">
              <button className="btn-secondary btn-sm" onClick={() => onAddSong(selected)}>
                + Queue
              </button>
              <button className="btn-primary btn-sm" onClick={() => onProjectSong(selected, 0)}>
                Project
              </button>
              {selected.source === 'import' && (
                <button className="btn-secondary btn-sm" onClick={() => handleDelete(selected.id)}>
                  Delete
                </button>
              )}
            </div>
          </div>

          {selected.slides.length > 1 && (
            <div className="song-jump-row">
              {selected.slides.map((s, i) => {
                const live = !!onScreen && onScreen.songId === selected.id && onScreen.slideIndex === i
                return (
                  <button
                    key={i}
                    className={`song-jump-chip${live ? ' is-live' : ''}`}
                    onClick={() => projectSlide(i)}
                    title={live ? `Repeat ${s.label}` : `Jump to ${s.label}`}
                  >
                    {s.label}
                    {live && <span className="song-jump-chip-dot" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          )}

          <div className="song-slides">
            {selected.slides.map((s, i) => {
              const live = !!onScreen && onScreen.songId === selected.id && onScreen.slideIndex === i
              return (
                <div
                  key={i}
                  className={`song-slide${live ? ' song-slide--on-screen' : ''}`}
                  role="button"
                  tabIndex={0}
                  title="Put this slide on the screen"
                  onClick={() => onProjectSong(selected, i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onProjectSong(selected, i)
                    }
                  }}
                >
                  <div className="song-slide-head">
                    <div className="song-slide-label">{s.label}</div>
                    {live && <span className="on-screen-tag">On screen</span>}
                  </div>
                  <div className="song-slide-text">{s.text}</div>
                  <button
                    className="btn-secondary btn-sm song-slide-project"
                    onClick={(e) => { e.stopPropagation(); onProjectSong(selected, i) }}
                  >
                    {live ? 'Restart here' : 'Project'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : tab === 'search' ? (
        <div className="songs-search">
          <div className="songs-search-bar">
            <div className="search-input-wrap">
              <Search className="search-icon" width={14} height={14} strokeWidth={2} aria-hidden="true" />
              <input
                className="search-input"
                placeholder="Search titles & lyrics…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery('') } }}
                autoFocus
              />
              {query && (
                <button className="search-clear" onClick={() => setQuery('')} title="Clear (Esc)" aria-label="Clear search"><X width={13} height={13} strokeWidth={2.4} /></button>
              )}
            </div>
          </div>

          {searched && <div className="results-count">{resultCountLabel(results.length)}</div>}

          <div className="songs-list">
            {!searched && (
              <div className="songs-search-empty">
                {query.trim().length > 0 ? (
                  <p>Keep typing — search needs at least {MIN_QUERY_LEN} letters.</p>
                ) : (
                  <>
                    <p className="songs-search-empty-hint">
                      Search by title or a lyric you remember — or{' '}
                      <button className="songs-inline-link" onClick={() => setTab('browse')}>browse all songs</button>.
                    </p>
                    {recentLoaded && recentSongs.length > 0 && (
                      <div className="songs-recent-chips">
                        <div className="songs-recent-chips-label"><Clock width={12} height={12} strokeWidth={2} /> RECENTLY PLAYED</div>
                        <div className="songs-recent-chips-row">
                          {recentSongs.map((s) => (
                            <button key={s.id} className="songs-recent-chip" onClick={() => openSong(s.id)}>
                              {s.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {searched && results.length === 0 && <div className="songs-empty">No songs found.</div>}
            {searched && results.map((s) => renderSongRow(s))}
          </div>
        </div>
      ) : (
        <div className="songs-browse">
          <div className="song-browse-hub">
            <button
              className={`song-browse-hub-card${browseSection === 'all' ? ' active' : ''}`}
              onClick={() => setBrowseSection('all')}
            >
              <div className="song-browse-hub-icon"><ListMusic width={16} height={16} strokeWidth={2} /></div>
              <div className="song-browse-hub-title">All Songs</div>
              <div className="song-browse-hub-sub">A–Z{allSongs ? ` · ${allSongs.length}` : ''}</div>
            </button>
            <button
              className={`song-browse-hub-card${browseSection === 'recent' ? ' active' : ''}`}
              onClick={() => setBrowseSection('recent')}
            >
              <div className="song-browse-hub-icon"><Clock width={16} height={16} strokeWidth={2} /></div>
              <div className="song-browse-hub-title">Recently Played</div>
              <div className="song-browse-hub-sub">What you used last{recentLoaded ? ` · ${recentSongs.length}` : ''}</div>
            </button>
          </div>

          {browseSection === 'recent' ? (
            <div className="songs-list">
              {recentLoaded && recentSongs.length === 0 && (
                <div className="songs-empty">Nothing played yet this session.</div>
              )}
              {recentSongs.length > 0 && (
                <div className="songs-recent-clear-row">
                  <button className="songs-inline-link" onClick={clearRecent}>Clear</button>
                </div>
              )}
              {recentSongs.map((s) => renderSongRow(s))}
            </div>
          ) : allLoading || allSongs === null ? (
            <div className="songs-empty">Loading…</div>
          ) : (
            <div className="songs-browse-body">
              <div className="songs-all-list">
                {allGroups.map((g) => (
                  <div key={g.letter}>
                    <div
                      className="songs-letter-head"
                      ref={(el) => { letterRefs.current[g.letter] = el }}
                    >
                      {g.letter}
                    </div>
                    {g.items.map((s) => renderSongRow(s))}
                  </div>
                ))}
              </div>
              <div className="songs-azrail">
                {ALPHABET.map((l) => (
                  <button
                    key={l}
                    className={`songs-azrail-btn${availableLetters.has(l) ? '' : ' is-empty'}`}
                    disabled={!availableLetters.has(l)}
                    onClick={() => jumpToLetter(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
