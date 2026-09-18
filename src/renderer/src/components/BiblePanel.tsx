import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  BibleTranslation,
  ResolvedPassage,
  BibleSearchHit,
  BibleSearchMode,
  BibleSearchRange
} from '../types'
import { formatVerse } from '../../../shared/bibleRef'
import { bookByNum, BIBLE_BOOKS } from '../../../shared/bibleBooks'
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
}

type Mode = 'reference' | 'keyword'

/** Keyword-search range: the whole Bible, a testament, or one book. */
type RangeSel = 'all' | 'ot' | 'nt' | number

const OT_BOOKS = BIBLE_BOOKS.filter((b) => b.num <= 39)
const NT_BOOKS = BIBLE_BOOKS.filter((b) => b.num >= 40)

function rangeFor(sel: RangeSel): BibleSearchRange | undefined {
  if (sel === 'all') return undefined
  if (sel === 'ot') return { bookFrom: 1, bookTo: 39 }
  if (sel === 'nt') return { bookFrom: 40, bookTo: 66 }
  return { bookFrom: sel, bookTo: sel }
}

export default function BiblePanel({ visible, onScreen, preview, onAddPassage, onProjectPassage }: Props) {
  const isLive = (bookNum: number, chapter: number, verse: number): boolean =>
    !!onScreen && onScreen.bookNum === bookNum && onScreen.chapter === chapter && onScreen.verse === verse
  const [translations, setTranslations] = useState<BibleTranslation[]>([])
  const [translation, setTranslation] = useState(
    () => localStorage.getItem('born.bibleTranslation') || 'KJV'
  )
  const [mode, setMode] = useState<Mode>('reference')

  const [refInput, setRefInput] = useState('')
  const [passage, setPassage] = useState<ResolvedPassage | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const [keyword, setKeyword] = useState('')
  const [hits, setHits] = useState<BibleSearchHit[]>([])
  const [searchMode, setSearchMode] = useState<BibleSearchMode>('phrase')
  const [rangeSel, setRangeSel] = useState<RangeSel>('all')
  const keywordTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Browse drawer: slides over the right third of the panel, whatever's
  // showing underneath stays put. null = show the book grid; otherwise the
  // book whose chapter grid is showing. Picking a chapter drops a
  // browseAnchor (below), which is what actually opens the reading view.
  const [browseOpen, setBrowseOpen] = useState(false)
  const [browseBook, setBrowseBook] = useState<number | null>(null)

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
  // Set by "← Search" so the operator can look something else up even mid-service;
  // cleared again the moment a new verse hits the projector.
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

  useEffect(() => {
    focusVerseRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
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

  const doLookup = useCallback(
    async (ref: string, trans: string) => {
      const r = ref.trim()
      if (!r) return
      const res = await window.electronAPI.lookupPassage(r, trans)
      if ((res as { error?: string }).error) {
        setPassage(null)
        setLookupError((res as { error: string }).error)
      } else {
        setPassage(res as ResolvedPassage)
        setLookupError(null)
        setRefInput((res as ResolvedPassage).reference)
      }
    },
    []
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
  const queueRef = useCallback((ref: string) => resolveThen(ref, onAddPassage), [resolveThen, onAddPassage])
  const projectRef = useCallback(
    (ref: string) => resolveThen(ref, (p) => onProjectPassage(p, 0)),
    [resolveThen, onProjectPassage]
  )

  /** Click a result: open the whole chapter, sitting on that verse (no projection). */
  const openChapterAt = useCallback((bookNum: number, chapter: number, verse: number) => {
    setShowSearch(false)
    setBrowseAnchor({ bookNum, chapter, verse })
    setBrowseOpen(false)
  }, [])

  const changeTranslation = (code: string): void => {
    setTranslation(code)
    try {
      localStorage.setItem('born.bibleTranslation', code)
    } catch {
      /* ignore */
    }
    if (passage) doLookup(passage.reference, code)
  }

  // keyword search (debounced)
  useEffect(() => {
    if (keywordTimer.current) clearTimeout(keywordTimer.current)
    if (mode !== 'keyword' || keyword.trim().length < 2) {
      setHits([])
      return
    }
    keywordTimer.current = setTimeout(() => {
      window.electronAPI
        .searchBible(keyword.trim(), translation, searchMode, rangeFor(rangeSel))
        .then(setHits)
    }, 250)
    return () => {
      if (keywordTimer.current) clearTimeout(keywordTimer.current)
    }
  }, [keyword, translation, mode, searchMode, rangeSel])

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
          <button className="btn-quiet btn-sm" onClick={() => setShowSearch(true)}>← Search</button>
          <button className="btn-secondary btn-sm" onClick={() => setBrowseOpen(true)} title="Jump to a different book or chapter">
            Books
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
              onProjectPassage(chapterView, chapterView.slideStarts[i] ?? 0)
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

  const searchView = (
    <>
      <div className="bible-controls">
        <div className="bible-mode">
          <button className={`filter-mode-btn${mode === 'reference' ? ' active' : ''}`} onClick={() => setMode('reference')}>Reference</button>
          <button className={`filter-mode-btn${mode === 'keyword' ? ' active' : ''}`} onClick={() => setMode('keyword')}>Keyword</button>
          <button className={`filter-mode-btn${browseOpen ? ' active' : ''}`} onClick={() => setBrowseOpen(true)}>Browse</button>
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

      {mode === 'reference' ? (
        <>
          <div className="bible-ref-row">
            <div className="search-input-wrap">
              <input
                className="search-input"
                placeholder="Reference — e.g. John 3:16, Psalm 23, 1 Cor 13:4-7"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') doLookup(refInput, translation)
                  else if (e.key === 'Escape' && refInput) { e.preventDefault(); setRefInput('') }
                }}
                autoFocus
              />
              {refInput && (
                <button className="search-clear" onClick={() => setRefInput('')} title="Clear (Esc)" aria-label="Clear reference">×</button>
              )}
            </div>
            <button className="btn-primary" onClick={() => doLookup(refInput, translation)} disabled={!refInput.trim()}>
              Look up
            </button>
          </div>
          {lookupError && <div className="bible-hint bible-hint--error">{lookupError}</div>}

          {passage && (
            <div className="bible-passage">
              <div className="bible-passage-head">
                <span className="bible-passage-ref">{passage.reference} · {passage.translation}</span>
                <div className="result-actions">
                  <button className="btn-secondary btn-sm" onClick={() => onAddPassage(passage)}>+ Queue</button>
                  <button className="btn-primary btn-sm" onClick={() => onProjectPassage(passage, 0)}>Project</button>
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
                          onProjectPassage(passage, passage.slideStarts[i] ?? 0)
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
      ) : (
        <>
          <div className="bible-ref-row">
            <div className="search-input-wrap">
              <input
                className="search-input"
                placeholder="Search the Bible for a word or phrase…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape' && keyword) { e.preventDefault(); setKeyword('') } }}
                autoFocus
              />
              {keyword && (
                <button className="search-clear" onClick={() => setKeyword('')} title="Clear (Esc)" aria-label="Clear search">×</button>
              )}
            </div>
          </div>
          <div className="bible-search-options">
            <div className="bible-mode bible-mode--sub" role="tablist" aria-label="Search mode">
              <button
                className={`filter-mode-btn filter-mode-btn--sm${searchMode === 'phrase' ? ' active' : ''}`}
                title="Match the words in this exact order"
                onClick={() => setSearchMode('phrase')}
              >
                Phrase
              </button>
              <button
                className={`filter-mode-btn filter-mode-btn--sm${searchMode === 'all' ? ' active' : ''}`}
                title="Match verses containing every word, in any order"
                onClick={() => setSearchMode('all')}
              >
                All words
              </button>
              <button
                className={`filter-mode-btn filter-mode-btn--sm${searchMode === 'any' ? ' active' : ''}`}
                title="Match verses containing any of the words"
                onClick={() => setSearchMode('any')}
              >
                Any word
              </button>
            </div>
            <select
              className="language-select"
              value={rangeSel}
              onChange={(e) => {
                const v = e.target.value
                setRangeSel(v === 'all' || v === 'ot' || v === 'nt' ? v : Number(v))
              }}
              title="Restrict the search to part of the Bible"
            >
              <option value="all">Whole Bible</option>
              <option value="ot">Old Testament</option>
              <option value="nt">New Testament</option>
              <optgroup label="Old Testament">
                {OT_BOOKS.map((b) => (
                  <option key={b.num} value={b.num}>{b.name}</option>
                ))}
              </optgroup>
              <optgroup label="New Testament">
                {NT_BOOKS.map((b) => (
                  <option key={b.num} value={b.num}>{b.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="bible-verses">
            {hits.length === 0 && keyword.trim().length >= 2 && (
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
                  <span className="bible-verse-text">{h.text}</span>
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
      )}
    </>
  )

  return (
    <div className="bible-panel">
      <div className="bible-panel-main">{readingView || searchView}</div>

      <div
        className={`bible-browse-scrim${browseOpen ? ' is-open' : ''}`}
        onClick={() => setBrowseOpen(false)}
        aria-hidden={!browseOpen}
      />
      <div className={`bible-browse-drawer${browseOpen ? ' is-open' : ''}`} aria-hidden={!browseOpen}>
        <div className="bible-browse-drawer-head">
          <span className="bible-browse-drawer-title">
            {browseBook === null ? 'Books' : bookByNum(browseBook)?.name}
          </span>
          <button className="btn-quiet btn-sm" onClick={() => setBrowseOpen(false)}>Cancel</button>
        </div>
        <div className="bible-browse-drawer-body">
          {browseBook === null ? (
            <>
              <div className="bible-browse-section">
                <div className="bible-browse-head">Old Testament</div>
                <div className="bible-browse-grid">
                  {OT_BOOKS.map((b) => (
                    <button key={b.num} className="bible-browse-book" onClick={() => setBrowseBook(b.num)} title={b.name}>
                      {b.abbrev}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bible-browse-section">
                <div className="bible-browse-head">New Testament</div>
                <div className="bible-browse-grid">
                  {NT_BOOKS.map((b) => (
                    <button key={b.num} className="bible-browse-book" onClick={() => setBrowseBook(b.num)} title={b.name}>
                      {b.abbrev}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bible-browse-section">
              <div className="bible-browse-head">
                <button className="btn-quiet btn-sm" onClick={() => setBrowseBook(null)}>← Books</button>
              </div>
              <div className="bible-browse-grid bible-browse-grid--chapters">
                {Array.from({ length: bookByNum(browseBook)?.chapters ?? 0 }, (_, i) => i + 1).map((c) => (
                  <button
                    key={c}
                    className="bible-browse-chapter"
                    onClick={() => openChapterAt(browseBook, c, 1)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
