import { useState, useCallback, useEffect, useRef } from 'react'
import SearchBar from './components/SearchBar'
import ResultsList from './components/ResultsList'
import ServiceQueue from './components/ServiceQueue'
import BrowsePanel from './components/BrowsePanel'
import BiblePanel from './components/BiblePanel'
import SongsPanel from './components/SongsPanel'
import type {
  Quote,
  IndexerProgress,
  QueueItem,
  SlidePayload,
  ResolvedPassage,
  SongDetail
} from './types'
import { quoteToItem, makeId, migrateQueue, itemTitle } from '../../shared/queueItem'
import { stepForward, stepBack, type Position } from '../../shared/queueNav'
import { reorder } from './queueUtils'

type TopTab = 'sermons' | 'bible' | 'songs'
type SermonsSubTab = 'search' | 'browse'

interface Projected {
  item: QueueItem
  slide: number
  /** Index into serviceQueue, or null when projecting a preview not in the queue. */
  queueIndex: number | null
}

function slidePayload(item: QueueItem, slide: number): SlidePayload | null {
  const s = item.slides[slide]
  if (!s) return null
  return { kind: item.kind, text: s.text, label: s.label, reference: s.reference, marker: s.marker }
}

export default function App() {
  const [searchResults, setSearchResults] = useState<Quote[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [serviceQueue, setServiceQueue] = useState<QueueItem[]>([])
  const [projectionOpen, setProjectionOpen] = useState(false)
  const [indexer, setIndexer] = useState<IndexerProgress | null>(null)
  const [projected, setProjected] = useState<Projected | null>(null)
  const [isScreenBlanked, setIsScreenBlanked] = useState(false)
  const [fontSize, setFontSize] = useState(3.6)
  const [showAlertDialog, setShowAlertDialog] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [webRemoteURL, setWebRemoteURL] = useState('')
  const [stageOpen, setStageOpen] = useState(false)
  const [topTab, setTopTab] = useState<TopTab>('sermons')
  const [sermonsTab, setSermonsTab] = useState<SermonsSubTab>('search')
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const queueRef = useRef<QueueItem[]>(serviceQueue)
  const projectedRef = useRef<Projected | null>(null)
  const queueLoaded = useRef(false)
  const projectionOpenRef = useRef(false)

  useEffect(() => { projectionOpenRef.current = projectionOpen }, [projectionOpen])
  useEffect(() => { queueRef.current = serviceQueue }, [serviceQueue])
  useEffect(() => { projectedRef.current = projected }, [projected])

  const activeQueueIndex = projected?.queueIndex ?? null

  // Load persisted queue on mount (migrating the old Quote[] format).
  useEffect(() => {
    window.electronAPI.loadQueue().then((loaded) => {
      queueLoaded.current = true
      const migrated = migrateQueue(loaded)
      if (migrated.length > 0) setServiceQueue(migrated)
    })
  }, [])

  useEffect(() => {
    if (queueLoaded.current) window.electronAPI.saveQueue(serviceQueue)
  }, [serviceQueue])

  // Web remote URL (retry once — the HTTP server may still be binding).
  useEffect(() => {
    let cancelled = false
    const fetchURL = (): void => {
      window.electronAPI.getWebRemoteURL().then((url) => {
        if (cancelled) return
        setWebRemoteURL(url)
        if (!url) setTimeout(fetchURL, 1500)
      })
    }
    fetchURL()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    window.electronAPI.listDisplays().then(setDisplayInfo)
    return window.electronAPI.onDisplaysInfo(setDisplayInfo)
  }, [])

  useEffect(() => {
    const unProj = window.electronAPI.onProjectionClosed(() => {
      setProjectionOpen(false)
      setIsScreenBlanked(false)
    })
    const unStage = window.electronAPI.onStageClosed(() => setStageOpen(false))
    const unBlank = window.electronAPI.onOperatorBlankChanged((blank) => setIsScreenBlanked(blank))
    return () => {
      unProj()
      unStage()
      unBlank()
    }
  }, [])

  useEffect(() => {
    window.electronAPI.getIndexerStatus().then(setIndexer)
    return window.electronAPI.onIndexerProgress(setIndexer)
  }, [])

  // ── Projection ─────────────────────────────────────────────────────────────

  const ensureProjectionOpen = useCallback(async () => {
    if (!projectionOpenRef.current) {
      await window.electronAPI.openProjection()
      setProjectionOpen(true)
    }
  }, [])

  const doProject = useCallback(
    async (item: QueueItem, slide: number, queueIndex: number | null) => {
      const payload = slidePayload(item, slide)
      if (!payload) return
      await ensureProjectionOpen()

      const next: Projected = { item, slide, queueIndex }
      projectedRef.current = next
      setProjected(next)
      setIsScreenBlanked(false)
      window.electronAPI.showSlide(payload)

      // Stage view: current slide + the slide that Next would show.
      const q = queueRef.current
      let nextPayload: SlidePayload | null = null
      if (queueIndex !== null && q[queueIndex]?.id === item.id) {
        const np = stepForward(q, { itemIndex: queueIndex, slideIndex: slide })
        if (np && !(np.itemIndex === queueIndex && np.slideIndex === slide)) {
          nextPayload = slidePayload(q[np.itemIndex], np.slideIndex)
        }
      } else if (slide + 1 < item.slides.length) {
        nextPayload = slidePayload(item, slide + 1)
      }
      window.electronAPI.updateStage(payload, nextPayload)
    },
    [ensureProjectionOpen]
  )

  const advance = useCallback(
    (dir: 'next' | 'prev') => {
      const p = projectedRef.current
      const q = queueRef.current
      if (!p) {
        if (q.length > 0) doProject(q[0], 0, 0)
        return
      }
      const inQueue = p.queueIndex !== null && q[p.queueIndex]?.id === p.item.id
      if (inQueue) {
        const pos: Position = { itemIndex: p.queueIndex as number, slideIndex: p.slide }
        const nextPos = dir === 'next' ? stepForward(q, pos) : stepBack(q, pos)
        if (nextPos) doProject(q[nextPos.itemIndex], nextPos.slideIndex, nextPos.itemIndex)
      } else {
        const n = dir === 'next' ? p.slide + 1 : p.slide - 1
        if (n >= 0 && n < p.item.slides.length) doProject(p.item, n, p.queueIndex)
      }
    },
    [doProject]
  )

  const handleNext = useCallback(() => advance('next'), [advance])
  const handlePrev = useCallback(() => advance('prev'), [advance])

  useEffect(() => window.electronAPI.onQueueNavigate((dir) => advance(dir)), [advance])

  // ── Queue ──────────────────────────────────────────────────────────────────

  const addToQueue = useCallback((items: QueueItem[]) => {
    const next = [...queueRef.current, ...items]
    queueRef.current = next
    setServiceQueue(next)
  }, [])

  const handleAddQuote = useCallback(
    (quote: Quote) => addToQueue([quoteToItem(quote)]),
    [addToQueue]
  )
  const handleProjectQuote = useCallback(
    (quote: Quote) => doProject(quoteToItem(quote), 0, null),
    [doProject]
  )

  const passageToItem = (p: ResolvedPassage): QueueItem => ({
    kind: 'bible',
    id: makeId('b'),
    translation: p.translation,
    reference: p.reference,
    bookNum: p.bookNum,
    chapter: p.chapter,
    verseStart: p.verseStart,
    verseEnd: p.verseEnd,
    slides: p.slides.map((s) => ({
      text: s.text,
      label: s.label,
      reference: s.reference,
      marker: s.marker
    }))
  })

  const handleAddPassage = useCallback(
    (p: ResolvedPassage) => addToQueue([passageToItem(p)]),
    [addToQueue]
  )
  const handleProjectPassage = useCallback(
    (p: ResolvedPassage, slide = 0) => doProject(passageToItem(p), slide, null),
    [doProject]
  )

  const songToItem = (s: SongDetail): QueueItem => {
    const ref = [s.title, s.author, s.songKey ? `Key of ${s.songKey}` : null]
      .filter(Boolean)
      .join(' · ')
    return {
      kind: 'song',
      id: makeId('s'),
      songId: s.id,
      title: s.title,
      author: s.author ?? undefined,
      slides: s.slides.map((sl) => ({
        text: sl.text,
        label: sl.label ?? undefined,
        reference: ref
      }))
    }
  }

  const handleAddSong = useCallback(
    (s: SongDetail) => addToQueue([songToItem(s)]),
    [addToQueue]
  )
  const handleProjectSong = useCallback(
    (s: SongDetail, slide = 0) => doProject(songToItem(s), slide, null),
    [doProject]
  )

  const handleProjectFromQueue = useCallback(
    (index: number) => {
      const item = queueRef.current[index]
      if (item) doProject(item, 0, index)
    },
    [doProject]
  )

  /** After the queue changes, keep `projected.queueIndex` pointing at the same item. */
  const repointProjected = useCallback((nextQueue: QueueItem[]) => {
    const p = projectedRef.current
    if (!p) return
    const newIndex = nextQueue.findIndex((it) => it.id === p.item.id)
    const updated: Projected = { ...p, queueIndex: newIndex === -1 ? null : newIndex }
    projectedRef.current = updated
    setProjected(updated)
  }, [])

  const mutateQueue = useCallback(
    (fn: (q: QueueItem[]) => QueueItem[]) => {
      const next = fn(queueRef.current)
      queueRef.current = next
      setServiceQueue(next)
      repointProjected(next)
    },
    [repointProjected]
  )

  const handleRemoveFromQueue = useCallback(
    (index: number) => mutateQueue((q) => q.filter((_, i) => i !== index)),
    [mutateQueue]
  )
  const handleClearQueue = useCallback(() => mutateQueue(() => []), [mutateQueue])
  const handleReorder = useCallback(
    (from: number, to: number) => mutateQueue((q) => reorder(q, from, to)),
    [mutateQueue]
  )

  // ── Projection window / stage / blank ──────────────────────────────────────

  const handleToggleProjection = useCallback(async () => {
    if (projectionOpen) {
      await window.electronAPI.closeProjection()
      setProjectionOpen(false)
      setIsScreenBlanked(false)
    } else {
      await window.electronAPI.openProjection()
      setProjectionOpen(true)
    }
  }, [projectionOpen])

  const handleToggleStage = useCallback(async () => {
    if (stageOpen) {
      await window.electronAPI.closeStage()
      setStageOpen(false)
    } else {
      await window.electronAPI.openStage()
      setStageOpen(true)
    }
  }, [stageOpen])

  const handleToggleBlank = useCallback(() => {
    const b = !isScreenBlanked
    setIsScreenBlanked(b)
    window.electronAPI.setBlankScreen(b)
  }, [isScreenBlanked])

  const handleBlank = useCallback((blank: boolean) => {
    setIsScreenBlanked(blank)
    window.electronAPI.setBlankScreen(blank)
  }, [])

  const handleFontSizeChange = useCallback((delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(8, Math.max(1.5, parseFloat((prev + delta).toFixed(2))))
      window.electronAPI.setFontSize(next)
      return next
    })
  }, [])

  // ── Web remote ─────────────────────────────────────────────────────────────

  useEffect(() => {
    window.electronAPI.syncWebRemote({
      queue: serviceQueue.map((it) => ({
        title: itemTitle(it),
        kind: it.kind,
        subtitle: it.slides[0]?.reference ?? '',
        slideCount: it.slides.length
      })),
      activeIndex: activeQueueIndex,
      activeSlide: projected?.slide ?? 0,
      blanked: isScreenBlanked
    })
  }, [serviceQueue, activeQueueIndex, projected, isScreenBlanked])

  useEffect(
    () => window.electronAPI.onWebRemoteProject((index) => handleProjectFromQueue(index)),
    [handleProjectFromQueue]
  )

  // ── Operator keyboard shortcuts ────────────────────────────────────────────

  useEffect(() => {
    const isTyping = (el: EventTarget | null): boolean => {
      const n = el as HTMLElement | null
      if (!n) return false
      return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable
    }

    const onKey = (e: KeyboardEvent): void => {
      if (showAlertDialog) return
      if (e.key === '?') { setShowShortcuts((v) => !v); return }
      if (showShortcuts && e.key === 'Escape') { setShowShortcuts(false); return }

      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'Enter') {
        if (searchResults[0]) { e.preventDefault(); handleProjectQuote(searchResults[0]) }
        return
      }
      if ((e.key === '/' || (mod && e.key.toLowerCase() === 'f')) && !isTyping(e.target)) {
        e.preventDefault()
        setTopTab('sermons')
        setSermonsTab('search')
        document.getElementById('born-search-input')?.focus()
        return
      }

      if (isTyping(e.target)) return
      const t = e.target as HTMLElement | null
      const onControl =
        t && typeof t.closest === 'function' ? t.closest('button, a, [role="button"]') : null
      if (onControl && (e.key === ' ' || e.key === 'Enter')) return

      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && activeQueueIndex !== null) {
        e.preventDefault()
        const to = e.key === 'ArrowUp' ? activeQueueIndex - 1 : activeQueueIndex + 1
        if (to >= 0 && to < queueRef.current.length) handleReorder(activeQueueIndex, to)
        return
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          e.shiftKey && e.key === ' ' ? handlePrev() : handleNext()
          break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          handlePrev()
          break
        case 'Escape':
          e.preventDefault()
          handleBlank(true)
          break
        case 'b':
        case 'B':
          e.preventDefault()
          handleToggleBlank()
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    showAlertDialog,
    showShortcuts,
    searchResults,
    activeQueueIndex,
    handleProjectQuote,
    handleReorder,
    handlePrev,
    handleNext,
    handleBlank,
    handleToggleBlank
  ])

  // ── Alert / service files ──────────────────────────────────────────────────

  const handleSearch = useCallback((results: Quote[], query: string) => {
    setSearchResults(results)
    setSearchQuery(query)
    setSearched(true)
  }, [])

  const handleSendAlert = useCallback(() => {
    if (!alertMessage.trim()) return
    window.electronAPI.sendAlert(alertMessage.trim())
    setAlertMessage('')
    setShowAlertDialog(false)
  }, [alertMessage])

  const handleNewService = useCallback(() => {
    if (serviceQueue.length === 0) return
    if (window.confirm('Clear the current queue and start a new service?')) {
      setServiceQueue([])
      projectedRef.current = null
      setProjected(null)
    }
  }, [serviceQueue.length])

  const handleSaveService = useCallback(async () => {
    await window.electronAPI.saveService(serviceQueue)
  }, [serviceQueue])

  const handleOpenService = useCallback(async () => {
    const loaded = await window.electronAPI.openService()
    if (loaded) {
      setServiceQueue(migrateQueue(loaded))
      projectedRef.current = null
      setProjected(null)
    }
  }, [])

  const isRunning = indexer?.status === 'running'
  const pct = indexer ? Math.round((indexer.scanned / indexer.total) * 100) : 0
  const targetDisplay = displayInfo?.displays.find((d) => d.id === displayInfo.targetId)
  const showFallbackBanner = projectionOpen && displayInfo?.isFallback

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="app-logo-born">BORN</span>
          <div className="file-actions">
            <button className="btn-quiet btn-sm" onClick={handleNewService} title="Start a new, empty service">New</button>
            <button className="btn-quiet btn-sm" onClick={handleOpenService} title="Open a saved service file">Open</button>
            <button className="btn-quiet btn-sm" onClick={handleSaveService} title="Save this service to a file">Save</button>
          </div>
        </div>

        <div className="header-actions">
          {projectionOpen && (
            <div className="screen-controls">
              <button
                className={`btn-secondary${isScreenBlanked ? ' btn-toggle-on' : ''}`}
                onClick={handleToggleBlank}
                title="Black out the projector screen (nothing is shown to the congregation)"
              >
                {isScreenBlanked ? 'Show screen' : 'Hide screen'}
              </button>
              <button className="btn-secondary" onClick={() => setShowAlertDialog(true)} title="Show a short message across the bottom of the screen">
                Message
              </button>
              <div className="text-size-control" title="Change the size of the projected text">
                <span className="text-size-label">Text</span>
                <button className="btn-secondary btn-sm" onClick={() => handleFontSizeChange(-0.25)} disabled={fontSize <= 1.5} aria-label="Smaller text">−</button>
                <button className="btn-secondary btn-sm" onClick={() => handleFontSizeChange(0.25)} disabled={fontSize >= 8} aria-label="Larger text">+</button>
              </div>
            </div>
          )}

          {displayInfo && displayInfo.displays.length > 1 && (
            <label className="display-picker" title="Choose which screen the projection appears on">
              <span className="display-picker-label">Show on</span>
              <select
                className="language-select"
                value={displayInfo.isOverride ? displayInfo.targetId : ''}
                onChange={(e) =>
                  window.electronAPI
                    .setProjectionDisplay(e.target.value ? Number(e.target.value) : null)
                    .then(setDisplayInfo)
                }
              >
                <option value="">Projector (auto)</option>
                {displayInfo.displays.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </label>
          )}

          <button className="btn-quiet btn-sm" onClick={() => setShowShortcuts(true)} title="See keyboard shortcuts">Shortcuts</button>
          <button className="btn-quiet btn-sm" onClick={handleToggleStage} title="Open a second window showing the current and next slide (for musicians)">
            {stageOpen ? 'Close monitor' : 'Stage monitor'}
          </button>
          <button
            className={projectionOpen ? 'btn-danger' : 'btn-primary btn-lg'}
            onClick={handleToggleProjection}
          >
            {projectionOpen ? 'Close projection' : 'Open projection'}
          </button>
        </div>
      </header>

      {showFallbackBanner && (
        <div className="fallback-banner">
          {displayInfo?.isOverride
            ? 'Projection is set to this screen. '
            : 'No external display detected — projecting to this screen. '}
          Press <kbd>Esc</kbd> to blank{displayInfo && displayInfo.displays.length > 1 ? ', or pick a screen above' : ''}.
        </div>
      )}

      <main className="app-main">
        <div className="search-panel">
          <div className="panel-tab-bar">
            <button className={`panel-tab${topTab === 'sermons' ? ' active' : ''}`} onClick={() => setTopTab('sermons')}>Sermons</button>
            <button className={`panel-tab${topTab === 'bible' ? ' active' : ''}`} onClick={() => setTopTab('bible')}>Bible</button>
            <button className={`panel-tab${topTab === 'songs' ? ' active' : ''}`} onClick={() => setTopTab('songs')}>Songs</button>
          </div>

          <div className="panel-view" hidden={topTab !== 'sermons'}>
            <div className="panel-subtab-bar">
              <button className={`panel-subtab${sermonsTab === 'search' ? ' active' : ''}`} onClick={() => setSermonsTab('search')}>Search</button>
              <button className={`panel-subtab${sermonsTab === 'browse' ? ' active' : ''}`} onClick={() => setSermonsTab('browse')}>Browse</button>
            </div>
            <div className="panel-view" hidden={sermonsTab !== 'search'}>
              <SearchBar onResults={handleSearch} onSearchingChange={setSearching} />
              <ResultsList
                results={searchResults}
                query={searchQuery}
                loading={searching}
                searched={searched}
                onAddToQueue={handleAddQuote}
                onSendToProjection={handleProjectQuote}
              />
            </div>
            <div className="panel-view" hidden={sermonsTab !== 'browse'}>
              <BrowsePanel
                visible={topTab === 'sermons' && sermonsTab === 'browse'}
                onAddToQueue={handleAddQuote}
                onSendToProjection={handleProjectQuote}
              />
            </div>
          </div>

          <div className="panel-view" hidden={topTab !== 'bible'}>
            <BiblePanel
              visible={topTab === 'bible'}
              onAddPassage={handleAddPassage}
              onProjectPassage={handleProjectPassage}
            />
          </div>

          <div className="panel-view" hidden={topTab !== 'songs'}>
            <SongsPanel
              visible={topTab === 'songs'}
              onAddSong={handleAddSong}
              onProjectSong={handleProjectSong}
            />
          </div>
        </div>

        <div className="queue-panel">
          <ServiceQueue
            queue={serviceQueue}
            activeIndex={activeQueueIndex}
            activeSlide={projected?.slide ?? 0}
            projectionOpen={projectionOpen}
            blanked={isScreenBlanked}
            onProject={handleProjectFromQueue}
            onRemove={handleRemoveFromQueue}
            onClear={handleClearQueue}
            onPrev={handlePrev}
            onNext={handleNext}
            onReorder={handleReorder}
          />
        </div>
      </main>

      {showAlertDialog && (
        <div className="modal-overlay" onClick={() => setShowAlertDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Show a message on screen</h3>
            <p className="modal-hint">It appears across the bottom of the projection for about 10 seconds.</p>
            <input
              type="text"
              className="modal-input"
              placeholder="e.g. Please silence your phones"
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendAlert() }}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAlertDialog(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSendAlert} disabled={!alertMessage.trim()}>Show message</button>
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Keyboard shortcuts</h3>
            <dl className="shortcuts-list">
              <div><dt><kbd>→</kbd> <kbd>Space</kbd></dt><dd>Next slide</dd></div>
              <div><dt><kbd>←</kbd> <kbd>Shift</kbd>+<kbd>Space</kbd></dt><dd>Previous slide</dd></div>
              <div><dt><kbd>B</kbd></dt><dd>Hide / show the screen</dd></div>
              <div><dt><kbd>Esc</kbd></dt><dd>Hide the screen</dd></div>
              <div><dt><kbd>/</kbd></dt><dd>Jump to the search box</dd></div>
              <div><dt><kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd></dt><dd>Project the top search result</dd></div>
              <div><dt><kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd></dt><dd>Move the on-screen item up / down the queue</dd></div>
              <div><dt><kbd>?</kbd></dt><dd>Show / hide this list</dd></div>
            </dl>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowShortcuts(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <footer className="status-bar">
        {webRemoteURL && (
          <span className="status-remote" title="Open this address on a phone to control the service">
            📱 {webRemoteURL}
            <button className="status-copy" title="Copy remote URL" onClick={() => navigator.clipboard?.writeText(webRemoteURL)}>Copy</button>
          </span>
        )}
        {indexer === null ? (
          <span className="status-text">Starting…</span>
        ) : isRunning ? (
          <>
            <span className="status-text">
              Updating sermons — {indexer.indexed.toLocaleString()} / {indexer.total.toLocaleString()} ({pct}%)
            </span>
            <div className="status-progress"><div className="status-progress-fill" style={{ width: `${pct}%` }} /></div>
            <button className="btn-secondary btn-sm" onClick={() => window.electronAPI.stopIndexer()}>Stop</button>
          </>
        ) : indexer.indexed === 0 ? (
          <>
            <span className="status-text status-warn">Preparing sermon database — search needs an internet connection the first time</span>
            <button className="btn-primary btn-sm" onClick={() => window.electronAPI.startIndexer()}>Retry</button>
          </>
        ) : indexer.status === 'done' ? (
          <>
            <span className="status-text status-ready">● {indexer.indexed.toLocaleString()} sermons ready</span>
            <button className="btn-secondary btn-sm" title="Fetch any sermons added since this database was built" onClick={() => window.electronAPI.startIndexer()}>Check for updates</button>
          </>
        ) : (
          <>
            <span className="status-text">{indexer.indexed.toLocaleString()} of {indexer.total.toLocaleString()} sermons — some still downloading</span>
            <button className="btn-secondary btn-sm" onClick={() => window.electronAPI.startIndexer()}>Resume</button>
          </>
        )}
      </footer>
    </div>
  )
}
