import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronDown, X, BookOpen, Search, Check, Clock } from 'lucide-react'
import type {
  BibleTranslation,
  ResolvedPassage,
  BibleSearchHit,
  BibleSearchMode,
  BibleSearchRange
} from '../types'
import { formatVerse, parseReference, isRefError, formatReference, type ParsedRef } from '../../../shared/bibleRef'
import { bookByNum, BIBLE_BOOKS } from '../../../shared/bibleBooks'
import { resultCountLabel } from '../../../shared/searchLimits'
import { highlight } from '../highlight'
import './BiblePanel.css'

interface Props {
  visible: boolean
  /** The verse currently on the projector, so its row can be marked. */
  onScreen?: { bookNum: number; chapter: number; verse: number } | null
  /** A chapter to show because the operator clicked a queue item to read it
   *  (not projecting). Takes precedence over `onScreen` while set. */
  preview?: { bookNum: number; chapter: number; verse: number } | null
  onAddPassage: (p: ResolvedPassage) => void
  onProjectPassage: (p: ResolvedPassage, slide?: number) => void
  /** Reported on every change (including the initial default) so the app can
   *  tell the remote which translation is actually live — the remote has no
   *  picker of its own, it just reflects this. */
  onTranslationChange?: (code: string) => void
}

/** Search scope: the whole Bible (default), a testament, or one book —
 *  opt-in narrowing, never required to get a result. */
type RangeSel = 'all' | 'ot' | 'nt' | number

const OT_BOOKS = BIBLE_BOOKS.filter((b) => b.num <= 39)
const NT_BOOKS = BIBLE_BOOKS.filter((b) => b.num >= 40)

function rangeFor(sel: RangeSel): BibleSearchRange | undefined {
  if (sel === 'all') return undefined
  if (sel === 'ot') return { bookFrom: 1, bookTo: 39 }
  if (sel === 'nt') return { bookFrom: 40, bookTo: 66 }
  return { bookFrom: sel, bookTo: sel }
}

export default function BiblePanel({
  visible,
  onScreen,
  preview,
  onAddPassage,
  onProjectPassage,
  onTranslationChange
}: Props) {
  const isLive = (bookNum: number, chapter: number, verse: number): boolean =>
    !!onScreen && onScreen.bookNum === bookNum && onScreen.chapter === chapter && onScreen.verse === verse
  const [translations, setTranslations] = useState<BibleTranslation[]>([])
  const [translation, setTranslation] = useState(
    () => localStorage.getItem('born.bibleTranslation') || 'KJV'
  )
  useEffect(() => {
    onTranslationChange?.(translation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translation])

  const [tab, setTab] = useState<'search' | 'browse'>('search')

  // One smart box: parseReference (pure, synchronous) decides on every
  // keystroke whether this reads as a reference or a keyword search — no
  // mode to declare up front.
  const [query, setQuery] = useState('')
  const [passage, setPassage] = useState<ResolvedPassage | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const [hits, setHits] = useState<BibleSearchHit[]>([])
  const [searchMode, setSearchMode] = useState<BibleSearchMode>('phrase')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Search scope — default whole-Bible, opt-in narrowing via the popover.
  const [scope, setScope] = useState<RangeSel>('all')
  const [scopePopoverOpen, setScopePopoverOpen] = useState(false)
  const scopeRef = useRef<HTMLDivElement>(null)
  const scopeToggleRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const onOutside = (e: MouseEvent): void => {
      if (
        scopeRef.current &&
        !scopeRef.current.contains(e.target as Node) &&
        !scopeToggleRef.current?.contains(e.target as Node)
      ) {
        setScopePopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])
  const scoped = scope !== 'all'
  const scopeLabel =
    scope === 'all' ? 'Whole Bible' : scope === 'ot' ? 'Old Testament' : scope === 'nt' ? 'New Testament' : bookByNum(scope)?.abbrev ?? 'Book'

  // Browse tab: a 2-hub picker (All Books / Recently Looked Up), then either
  // the full-width book grid → chapter grid, or the recent list — all in
  // place, no drawer.
  const [browseSection, setBrowseSection] = useState<'all' | 'recent'>('all')
  const [browseBook, setBrowseBook] = useState<number | null>(null)

  const [recentRefs, setRecentRefs] = useState<Array<{ reference: string; translation: string }>>([])
  const [recentLoaded, setRecentLoaded] = useState(false)
  const loadRecent = useCallback(() => {
    window.electronAPI.getRecentBibleRefs().then((r) => {
      setRecentRefs(r)
      setRecentLoaded(true)
    })
  }, [])
  useEffect(() => {
    if (visible) loadRecent()
  }, [visible, loadRecent])
  const clearRecent = useCallback(() => {
    window.electronAPI.clearRecentBibleRefs().then(() => setRecentRefs([]))
  }, [])

  // The chapter view: click a search result (or project a passage) and the panel
  // shows the whole chapter, scrolled to that verse. While something is on the
  // projector the highlight follows Next / Prev; otherwise it sits on the verse
  // the operator opened. Same idea as the sermon follow-along view.
  const [browseAnchor, setBrowseAnchor] = useState<{
    bookNum: number
    chapter: number
    verse: number
  } | null>(null)
  const [chapterView, setChapterView] = useState<ResolvedPassage | null>(null)
  // Set by "← Search"/"← Browse" so the operator can look something else up
  // even mid-service; cleared again the moment a new verse hits the projector.
  const [showSearch, setShowSearch] = useState(false)
  const focusVerseRef = useRef<HTMLDivElement>(null)

  // What the chapter view is centred on: a queue-item the operator is previewing
  // wins; then the projected verse; then a keyword-hit they opened.
  const focusVerse = preview ?? onScreen ?? browseAnchor

  useEffect(() => {
    if (!focusVerse) {
      setChapterView(null)
      return
    }
    const book = bookByNum(focusVerse.bookNum)
    if (!book) return
    let cancelled = false
    window.electronAPI
      .lookupPassage(`${book.name} ${focusVerse.chapter}`, translation)
      .then((res) => {
        if (!cancelled && res && !(res as { error?: string }).error) {
          setChapterView(res as ResolvedPassage)
        }
      })
    return () => {
      cancelled = true
    }
  }, [focusVerse?.bookNum, focusVerse?.chapter, translation])

  // A new verse on the projector — or a queue item opened for reading — means
  // "show me that": drop a manual browse anchor and any "← Search" detour.
  useEffect(() => {
    if (onScreen || preview) {
      setBrowseAnchor(null)
      setShowSearch(false)
    }
  }, [onScreen?.bookNum, onScreen?.chapter, onScreen?.verse, preview?.bookNum, preview?.chapter, preview?.verse])

  // Only animate a scroll within the chapter that's already showing (e.g.
  // Next/Prev moving a verse at a time) — jumping to a freshly-loaded chapter
  // should land on the target verse instantly, not visibly scroll there.
  const lastChapterView = useRef<ResolvedPassage | null>(null)
  useEffect(() => {
    if (!focusVerseRef.current) return
    const isNewChapter = lastChapterView.current !== chapterView
    lastChapterView.current = chapterView
    focusVerseRef.current.scrollIntoView({
      block: 'center',
      behavior: isNewChapter ? 'auto' : 'smooth'
    })
  }, [focusVerse?.verse, chapterView])

  const loaded = useRef(false)
  useEffect(() => {
    if (!visible || loaded.current) return
    loaded.current = true
    window.electronAPI.getBibleTranslations().then((t) => {
      setTranslations(t)
      if (t.length && !t.some((x) => x.code === translation)) setTranslation(t[0].code)
    })
  }, [visible, translation])

  const doLookup = useCallback(async (ref: string, trans: string) => {
    const r = ref.trim()
    if (!r) return
    const res = await window.electronAPI.lookupPassage(r, trans)
    if ((res as { error?: string }).error) {
      setPassage(null)
      setLookupError((res as { error: string }).error)
    } else {
      setPassage(res as ResolvedPassage)
      setLookupError(null)
    }
  }, [])

  // Wrap the parent's add/project callbacks so every path through this panel
  // also refreshes "Recently Looked Up" — noteBibleUsed (called by the
  // parent) writes to settings, but this panel's own recentRefs state won't
  // see that until asked again. Same pattern as SongsPanel's queueSong/
  // projectSong wrapping onAddSong/onProjectSong.
  const addPassage = useCallback(
    (p: ResolvedPassage) => {
      onAddPassage(p)
      loadRecent()
    },
    [onAddPassage, loadRecent]
  )
  const projectPassage = useCallback(
    (p: ResolvedPassage, slide = 0) => {
      onProjectPassage(p, slide)
      loadRecent()
    },
    [onProjectPassage, loadRecent]
  )

  /** Queue or project a single verse (or any reference) straight from a result,
   *  without opening it first. */
  const resolveThen = useCallback(
    async (ref: string, then: (p: ResolvedPassage) => void) => {
      const res = await window.electronAPI.lookupPassage(ref, translation)
      if (res && !(res as { error?: string }).error) then(res as ResolvedPassage)
    },
    [translation]
  )
  const queueRef = useCallback((ref: string) => resolveThen(ref, addPassage), [resolveThen, addPassage])
  const projectRef = useCallback(
    (ref: string) => resolveThen(ref, (p) => projectPassage(p, 0)),
    [resolveThen, projectPassage]
  )

  /** Click a result: open the whole chapter, sitting on that verse (no projection). */
  const openChapterAt = useCallback((bookNum: number, chapter: number, verse: number) => {
    setShowSearch(false)
    setBrowseAnchor({ bookNum, chapter, verse })
  }, [])

  /** Click a "Recently Looked Up" chip: re-resolve the reference (translation
   *  may have changed since) and open it, same as any other browse entry. */
  const openRecentRef = useCallback(
    (r: { reference: string; translation: string }) => {
      setShowSearch(false)
      window.electronAPI.lookupPassage(r.reference, r.translation).then((res) => {
        if (res && !(res as { error?: string }).error) {
          const p = res as ResolvedPassage
          setBrowseAnchor({ bookNum: p.bookNum, chapter: p.chapter, verse: p.verseStart })
        }
      })
    },
    []
  )

  const changeTranslation = (code: string): void => {
    setTranslation(code)
    try {
      localStorage.setItem('born.bibleTranslation', code)
    } catch {
      /* ignore */
    }
    const q = query.trim()
    if (!q) return
    const parsed = parseReference(q)
    if (!isRefError(parsed)) doLookup(q, code)
    else if (q.length >= 2) window.electronAPI.searchBible(q, code, searchMode, rangeFor(scope)).then(setHits)
  }

  // What the box currently reads as — recomputed synchronously on every
  // keystroke (parseReference is pure/instant), so the "Recognized as…"
  // confirmation and the mode-specific controls never lag behind typing.
  const parsedRef = useMemo(() => (query.trim() ? parseReference(query.trim()) : null), [query])
  const validRef: ParsedRef | null = parsedRef && !isRefError(parsedRef) ? parsedRef : null
  const isReferenceIntent = !!validRef

  const runQuery = useCallback(
    (q: string) => {
      const parsed = parseReference(q)
      if (!isRefError(parsed)) {
        doLookup(q, translation)
        setHits([])
      } else if (q.length >= 2) {
        window.electronAPI.searchBible(q, translation, searchMode, rangeFor(scope)).then(setHits)
        setPassage(null)
        setLookupError(null)
      } else {
        setHits([])
        setPassage(null)
        setLookupError(null)
      }
    },
    [translation, searchMode, scope, doLookup]
  )

  // The actual lookup/search is debounced; the "Recognized as…" preview
  // above is not (it's a pure function, no reason to wait).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const q = query.trim()
    if (!q) {
      setPassage(null)
      setLookupError(null)
      setHits([])
      return
    }
    timer.current = setTimeout(() => runQuery(q), 200)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query, runQuery])

  const handleQueryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      if (timer.current) clearTimeout(timer.current)
      const q = query.trim()
      if (q) runQuery(q)
    } else if (e.key === 'Escape' && query) {
      e.preventDefault()
      setQuery('')
    }
  }

  const readingView = focusVerse && chapterView && !showSearch && (() => {
    const book = bookByNum(focusVerse.bookNum)
    // "live" only when the chapter on screen is the one being shown.
    const projecting =
      !!onScreen &&
      onScreen.bookNum === focusVerse.bookNum &&
      onScreen.chapter === focusVerse.chapter
    return (
      <>
        <div className="follow-head">
          <button className="btn-quiet btn-sm btn-icon-text" onClick={() => setShowSearch(true)}>
            <ChevronLeft width={14} height={14} strokeWidth={2.4} /> {tab === 'search' ? 'Search' : 'Browse'}
          </button>
          <button
            className="btn-secondary btn-sm btn-icon-text"
            onClick={() => {
              setBrowseBook(focusVerse.bookNum)
              setTab('browse')
              setShowSearch(true)
            }}
            title="Jump to a different book or chapter"
          >
            <BookOpen width={14} height={14} strokeWidth={2} /> Books
          </button>
          <span className="follow-title">
            {book?.name} {focusVerse.chapter} · {chapterView.translation}
          </span>
          <span className="follow-meta">
            {projecting ? 'On screen — following along' : 'Tap a verse to put it on screen'}
          </span>
        </div>
        <div className="follow-list">
          {chapterView.verses.map((v, i) => {
            const live = projecting && v.verse === onScreen!.verse
            const focused = !live && v.verse === focusVerse.verse
            const project = (): void => {
              setBrowseAnchor({ bookNum: focusVerse.bookNum, chapter: focusVerse.chapter, verse: v.verse })
              projectPassage(chapterView, chapterView.slideStarts[i] ?? 0)
            }
            return (
              <div
                key={v.verse}
                ref={live || focused ? focusVerseRef : undefined}
                className={[
                  'bible-verse',
                  live ? 'bible-verse--on-screen' : '',
                  focused ? 'bible-verse--focus' : ''
                ].filter(Boolean).join(' ')}
                role="button"
                tabIndex={0}
                title={`Put verse ${v.verse} on the screen`}
                onClick={project}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    project()
                  }
                }}
              >
                <span className="bible-verse-num">{v.verse}</span>
                <span className="bible-verse-text">{v.text}</span>
                <div className="bible-verse-actions">
                  {live && <span className="on-screen-tag">On screen</span>}
                  <button
                    className="btn-quiet btn-sm"
                    title={`Add verse ${v.verse} to the queue`}
                    onClick={(e) => {
                      e.stopPropagation()
                      queueRef(formatVerse(focusVerse.bookNum, focusVerse.chapter, v.verse))
                    }}
                  >
                    + Queue
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    title={`Put verse ${v.verse} on the screen`}
                    onClick={(e) => { e.stopPropagation(); project() }}
                  >
                    {live ? 'Restart here' : 'Project'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </>
    )
  })()

  const scopePopover = scopePopoverOpen && (
    <div className="bible-scope-popover" ref={scopeRef}>
      <button className={`bible-scope-option${scope === 'all' ? ' active' : ''}`} onClick={() => { setScope('all'); setScopePopoverOpen(false) }}>
        Whole Bible
      </button>
      <button className={`bible-scope-option${scope === 'ot' ? ' active' : ''}`} onClick={() => { setScope('ot'); setScopePopoverOpen(false) }}>
        Old Testament
      </button>
      <button className={`bible-scope-option${scope === 'nt' ? ' active' : ''}`} onClick={() => { setScope('nt'); setScopePopoverOpen(false) }}>
        New Testament
      </button>
      <div className="bible-scope-grid">
        {BIBLE_BOOKS.map((b) => (
          <button
            key={b.num}
            className={`bible-scope-book${scope === b.num ? ' active' : ''}`}
            onClick={() => { setScope(b.num); setScopePopoverOpen(false) }}
          >
            {b.abbrev}
          </button>
        ))}
      </div>
    </div>
  )

  const searchView = (
    <>
      <div className="bible-controls">
        <div className="search-input-wrap">
          <Search className="search-icon" width={14} height={14} strokeWidth={2} aria-hidden="true" />
          <input
            className="search-input"
            placeholder="Reference or a word — John 3:16, or faith…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleQueryKeyDown}
            autoFocus
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')} title="Clear (Esc)" aria-label="Clear search"><X width={13} height={13} strokeWidth={2.4} /></button>
          )}
        </div>
        <div className="bible-scope-wrap">
          <button
            ref={scopeToggleRef}
            className={`bible-scope-btn${scoped ? ' is-scoped' : ''}`}
            onClick={() => setScopePopoverOpen((o) => !o)}
            title="Narrow search to a testament or book"
          >
            {scopeLabel}
            {!scoped && <ChevronDown width={11} height={11} strokeWidth={2.5} />}
          </button>
          {scoped && (
            <button className="bible-scope-clear" title="Search the whole Bible again" onClick={() => setScope('all')}>
              <X width={11} height={11} strokeWidth={2.5} />
            </button>
          )}
          {scopePopover}
        </div>
        <select
          className="language-select"
          value={translation}
          onChange={(e) => changeTranslation(e.target.value)}
          title="Translation"
        >
          {translations.length === 0 && <option value={translation}>{translation}</option>}
          {translations.map((t) => (
            <option key={t.code} value={t.code}>{t.code}</option>
          ))}
        </select>
      </div>

      {validRef && (
        <div className="bible-recognized">
          <Check width={11} height={11} strokeWidth={2.5} />
          Recognized as {formatReference(validRef)}
        </div>
      )}

      {!isReferenceIntent && query.trim().length > 0 && (
        <div className="bible-search-options">
          <div className="filter-mode" role="tablist" aria-label="Search mode">
            <button className={`filter-mode-btn filter-mode-btn--sm${searchMode === 'phrase' ? ' active' : ''}`} title="Match the words in this exact order" onClick={() => setSearchMode('phrase')}>
              Phrase
            </button>
            <button className={`filter-mode-btn filter-mode-btn--sm${searchMode === 'all' ? ' active' : ''}`} title="Match verses containing every word, in any order" onClick={() => setSearchMode('all')}>
              All words
            </button>
            <button className={`filter-mode-btn filter-mode-btn--sm${searchMode === 'any' ? ' active' : ''}`} title="Match verses containing any of the words" onClick={() => setSearchMode('any')}>
              Any word
            </button>
          </div>
          {scoped && <span className="bible-scope-hint">Searching only {scopeLabel} — clear the {scopeLabel === 'Old Testament' || scopeLabel === 'New Testament' ? 'testament' : 'book'} chip to search everywhere again</span>}
        </div>
      )}

      {query.trim() === '' && (
        <div className="bible-search-empty">
          <p className="bible-search-empty-hint">
            Type a reference or a word — or{' '}
            <button className="bible-inline-link" onClick={() => setTab('browse')}>browse all books</button>.
          </p>
          {recentLoaded && recentRefs.length > 0 && (
            <div className="bible-recent-chips">
              <div className="bible-recent-chips-label">
                <Clock width={12} height={12} strokeWidth={2} /> RECENTLY LOOKED UP
              </div>
              <div className="bible-recent-chips-row">
                {recentRefs.map((r) => (
                  <button key={r.reference} className="bible-recent-chip" onClick={() => openRecentRef(r)}>
                    {r.reference}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isReferenceIntent ? (
        <>
          {lookupError && <div className="bible-hint bible-hint--error">{lookupError}</div>}
          {passage && (
            <div className="bible-passage">
              <div className="bible-passage-head">
                <span className="bible-passage-ref">{passage.reference} · {passage.translation}</span>
                <div className="result-actions">
                  <button className="btn-secondary btn-sm" onClick={() => addPassage(passage)}>+ Queue</button>
                  <button className="btn-primary btn-sm" onClick={() => projectPassage(passage, 0)}>Project</button>
                </div>
              </div>
              <div className="bible-verses">
                {passage.verses.map((v, i) => (
                  <div
                    key={v.verse}
                    className={`bible-verse${isLive(passage.bookNum, passage.chapter, v.verse) ? ' bible-verse--on-screen' : ''}`}
                    role="button"
                    tabIndex={0}
                    title={`Open ${bookByNum(passage.bookNum)?.name ?? ''} ${passage.chapter} at verse ${v.verse}`}
                    onClick={() => openChapterAt(passage.bookNum, passage.chapter, v.verse)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openChapterAt(passage.bookNum, passage.chapter, v.verse)
                      }
                    }}
                  >
                    <span className="bible-verse-num">{v.verse}</span>
                    <span className="bible-verse-text">{v.text}</span>
                    <div className="bible-verse-actions">
                      {isLive(passage.bookNum, passage.chapter, v.verse) && (
                        <span className="on-screen-tag">On screen</span>
                      )}
                      <button
                        className="btn-quiet btn-sm"
                        title={`Add verse ${v.verse} to the queue`}
                        onClick={(e) => {
                          e.stopPropagation()
                          queueRef(formatVerse(passage.bookNum, passage.chapter, v.verse))
                        }}
                      >
                        + Queue
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        title={`Put verse ${v.verse} on the screen`}
                        onClick={(e) => {
                          e.stopPropagation()
                          projectPassage(passage, passage.slideStarts[i] ?? 0)
                        }}
                      >
                        Project
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : query.trim().length > 0 ? (
        <>
          {hits.length > 0 && (
            <div className="results-count">
              {resultCountLabel(hits.length)}{scoped ? ` in ${scopeLabel}` : ''}
            </div>
          )}
          <div className="bible-verses">
            {hits.length === 0 && query.trim().length >= 2 && (
              <div className="bible-hint">No verses found.</div>
            )}
            {hits.map((h) => (
              <div
                key={`${h.bookNum}-${h.chapter}-${h.verse}`}
                className={`bible-verse bible-verse--hit${isLive(h.bookNum, h.chapter, h.verse) ? ' bible-verse--on-screen' : ''}`}
              >
                <div
                  className="bible-hit-body"
                  role="button"
                  tabIndex={0}
                  title="Open the whole chapter at this verse"
                  onClick={() => openChapterAt(h.bookNum, h.chapter, h.verse)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openChapterAt(h.bookNum, h.chapter, h.verse)
                    }
                  }}
                >
                  <span className="bible-verse-ref">{h.reference}</span>
                  <span className="bible-verse-text">{highlight(h.text, query)}</span>
                </div>
                <div className="bible-verse-actions">
                  <button className="btn-quiet btn-sm" title="Add this verse to the queue" onClick={() => queueRef(h.reference)}>
                    + Queue
                  </button>
                  <button className="btn-secondary btn-sm" title="Put this verse on the screen" onClick={() => projectRef(h.reference)}>
                    Project
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  )

  const browseView = (
    <div className="bible-browse">
      {browseBook === null && (
        <div className="bible-browse-hub">
          <button
            className={`bible-browse-hub-card${browseSection === 'all' ? ' active' : ''}`}
            onClick={() => setBrowseSection('all')}
          >
            <div className="bible-browse-hub-icon"><BookOpen width={16} height={16} strokeWidth={2} /></div>
            <div className="bible-browse-hub-title">All Books</div>
            <div className="bible-browse-hub-sub">Old &amp; New Testament</div>
          </button>
          <button
            className={`bible-browse-hub-card${browseSection === 'recent' ? ' active' : ''}`}
            onClick={() => setBrowseSection('recent')}
          >
            <div className="bible-browse-hub-icon"><Clock width={16} height={16} strokeWidth={2} /></div>
            <div className="bible-browse-hub-title">Recently Looked Up</div>
            <div className="bible-browse-hub-sub">What you opened last{recentLoaded ? ` · ${recentRefs.length}` : ''}</div>
          </button>
        </div>
      )}
      {browseBook === null && browseSection === 'recent' ? (
        <div className="bible-browse-scroll">
          {recentLoaded && recentRefs.length === 0 && (
            <div className="bible-hint">Nothing looked up yet this session.</div>
          )}
          {recentRefs.length > 0 && (
            <div className="bible-recent-clear-row">
              <button className="bible-inline-link" onClick={clearRecent}>Clear</button>
            </div>
          )}
          <div className="bible-browse-grid">
            {recentRefs.map((r) => (
              <button key={r.reference} className="bible-browse-book" onClick={() => openRecentRef(r)} title={r.reference}>
                <span className="bible-browse-book-abbrev">{r.reference}</span>
                <span className="bible-browse-book-count">{r.translation}</span>
              </button>
            ))}
          </div>
        </div>
      ) : browseBook === null ? (
        <div className="bible-browse-scroll">
          <div className="bible-browse-section">
            <div className="bible-browse-head">
              <span>Old Testament</span>
              <span className="bible-browse-count">39 books</span>
            </div>
            <div className="bible-browse-grid">
              {OT_BOOKS.map((b) => (
                <button key={b.num} className="bible-browse-book" onClick={() => setBrowseBook(b.num)} title={b.name}>
                  <span className="bible-browse-book-abbrev">{b.abbrev}</span>
                  <span className="bible-browse-book-count">{b.chapters} ch</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bible-browse-section">
            <div className="bible-browse-head">
              <span>New Testament</span>
              <span className="bible-browse-count">27 books</span>
            </div>
            <div className="bible-browse-grid">
              {NT_BOOKS.map((b) => (
                <button key={b.num} className="bible-browse-book" onClick={() => setBrowseBook(b.num)} title={b.name}>
                  <span className="bible-browse-book-abbrev">{b.abbrev}</span>
                  <span className="bible-browse-book-count">{b.chapters} ch</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bible-browse-scroll">
          <div className="bible-browse-crumb">
            <button className="btn-quiet btn-sm btn-icon-text" onClick={() => setBrowseBook(null)}>
              <ChevronLeft width={14} height={14} strokeWidth={2.4} /> Books
            </button>
            <span className="bible-browse-crumb-title">{bookByNum(browseBook)?.name}</span>
          </div>
          <div className="bible-browse-grid bible-browse-grid--chapters">
            {Array.from({ length: bookByNum(browseBook)?.chapters ?? 0 }, (_, i) => i + 1).map((c) => (
              <button key={c} className="bible-browse-chapter" onClick={() => openChapterAt(browseBook, c, 1)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="bible-panel">
      <div className="panel-subtab-bar">
        <button className={`panel-subtab${tab === 'search' ? ' active' : ''}`} onClick={() => { setTab('search'); setShowSearch(true) }}>
          Search
        </button>
        <button className={`panel-subtab${tab === 'browse' ? ' active' : ''}`} onClick={() => { setTab('browse'); setShowSearch(true) }}>
          Browse
        </button>
      </div>
      <div className="bible-panel-main">
        {readingView || (tab === 'search' ? searchView : browseView)}
      </div>
    </div>
  )
}
