import { useState, useCallback, useEffect, useRef } from 'react'
import SearchBar from './components/SearchBar'
import ResultsList from './components/ResultsList'
import ServiceQueue from './components/ServiceQueue'
import BrowsePanel from './components/BrowsePanel'
import type { Quote, IndexerProgress } from './types'

export default function App() {
  const [searchResults, setSearchResults] = useState<Quote[]>([])
  const [serviceQueue, setServiceQueue] = useState<Quote[]>([])
  const [projectionOpen, setProjectionOpen] = useState(false)
  const [indexer, setIndexer] = useState<IndexerProgress | null>(null)
  const [activeQueueIndex, setActiveQueueIndex] = useState<number | null>(null)
  const [isScreenBlanked, setIsScreenBlanked] = useState(false)
  const [fontSize, setFontSize] = useState(3.0)
  const [showAlertDialog, setShowAlertDialog] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [webRemoteURL, setWebRemoteURL] = useState('')
  const [stageOpen, setStageOpen] = useState(false)
  const [leftTab, setLeftTab] = useState<'search' | 'browse'>('search')

  // Refs so IPC callbacks always see current values without re-subscribing
  const queueRef = useRef<Quote[]>(serviceQueue)
  const activeIndexRef = useRef<number | null>(null)
  const queueLoaded = useRef(false)

  useEffect(() => { queueRef.current = serviceQueue }, [serviceQueue])
  useEffect(() => { activeIndexRef.current = activeQueueIndex }, [activeQueueIndex])

  // Load persisted queue on mount
  useEffect(() => {
    window.electronAPI.loadQueue().then((loaded) => {
      queueLoaded.current = true
      if (loaded.length > 0) setServiceQueue(loaded)
    })
  }, [])

  // Save queue on every change (skip until initial load completes)
  useEffect(() => {
    if (queueLoaded.current) {
      window.electronAPI.saveQueue(serviceQueue)
    }
  }, [serviceQueue])

  // Fetch web remote URL once on mount
  useEffect(() => {
    window.electronAPI.getWebRemoteURL().then(setWebRemoteURL)
  }, [])

  // Indexer status
  useEffect(() => {
    window.electronAPI.getIndexerStatus().then(setIndexer)
    const unsub = window.electronAPI.onIndexerProgress(setIndexer)
    return unsub
  }, [])

  // Arrow-key navigation relayed from the projection window
  useEffect(() => {
    const unsub = window.electronAPI.onQueueNavigate((dir) => {
      const queue = queueRef.current
      const current = activeIndexRef.current
      const nextIndex =
        dir === 'next'
          ? current === null ? 0 : Math.min(current + 1, queue.length - 1)
          : current === null ? 0 : Math.max(current - 1, 0)
      const quote = queue[nextIndex]
      if (!quote) return
      window.electronAPI.sendQuote(quote)
      setActiveQueueIndex(nextIndex)
      setIsScreenBlanked(false)
    })
    return unsub
  }, [])

  // Sync state to web remote whenever queue, activeIndex, or blank status changes
  useEffect(() => {
    window.electronAPI.syncWebRemote({
      queue: serviceQueue,
      activeIndex: activeQueueIndex,
      blanked: isScreenBlanked
    })
  }, [serviceQueue, activeQueueIndex, isScreenBlanked])

  const handleSearch = useCallback((results: Quote[]) => {
    setSearchResults(results)
  }, [])

  const handleAddToQueue = useCallback((quote: Quote) => {
    setServiceQueue((prev) => [...prev, quote])
  }, [])

  // Project from search results (no queue index tracking)
  const handleSendToProjection = useCallback(
    async (quote: Quote) => {
      if (!projectionOpen) {
        await window.electronAPI.openProjection()
        setProjectionOpen(true)
      }
      window.electronAPI.sendQuote(quote)
      window.electronAPI.updateStage(quote, null)
    },
    [projectionOpen]
  )

  // Project a specific queue item by index
  const handleProjectFromQueue = useCallback(
    async (index: number) => {
      const quote = serviceQueue[index]
      if (!quote) return
      if (!projectionOpen) {
        await window.electronAPI.openProjection()
        setProjectionOpen(true)
      }
      window.electronAPI.sendQuote(quote)
      window.electronAPI.updateStage(quote, serviceQueue[index + 1] ?? null)
      setActiveQueueIndex(index)
      setIsScreenBlanked(false)
    },
    [serviceQueue, projectionOpen]
  )

  // Web remote "project" command — must be after handleProjectFromQueue is declared
  useEffect(() => {
    const unsub = window.electronAPI.onWebRemoteProject((index) => {
      handleProjectFromQueue(index)
    })
    return unsub
  }, [handleProjectFromQueue])

  const handlePrev = useCallback(() => {
    const newIndex = activeQueueIndex === null ? 0 : Math.max(activeQueueIndex - 1, 0)
    handleProjectFromQueue(newIndex)
  }, [activeQueueIndex, handleProjectFromQueue])

  const handleNext = useCallback(() => {
    const newIndex =
      activeQueueIndex === null ? 0 : Math.min(activeQueueIndex + 1, serviceQueue.length - 1)
    handleProjectFromQueue(newIndex)
  }, [activeQueueIndex, serviceQueue.length, handleProjectFromQueue])

  const handleRemoveFromQueue = useCallback((index: number) => {
    setServiceQueue((prev) => prev.filter((_, i) => i !== index))
    setActiveQueueIndex((prev) => {
      if (prev === null) return null
      if (prev === index) return null
      return prev > index ? prev - 1 : prev
    })
  }, [])

  const handleClearQueue = useCallback(() => {
    setServiceQueue([])
    setActiveQueueIndex(null)
  }, [])

  const handleReorder = useCallback((from: number, to: number) => {
    setServiceQueue((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    setActiveQueueIndex((prev) => {
      if (prev === null) return null
      if (prev === from) return to
      if (from < to && prev > from && prev <= to) return prev - 1
      if (from > to && prev >= to && prev < from) return prev + 1
      return prev
    })
  }, [])

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

  const handleClearProjection = useCallback(() => {
    window.electronAPI.clearProjection()
  }, [])

  const handleToggleStage = useCallback(async () => {
    if (stageOpen) {
      await window.electronAPI.closeStage()
      setStageOpen(false)
    } else {
      await window.electronAPI.openStage()
      setStageOpen(true)
      // Push current projection state to the newly opened stage window
      if (activeQueueIndex !== null) {
        const cur = serviceQueue[activeQueueIndex] ?? null
        const nxt = serviceQueue[activeQueueIndex + 1] ?? null
        if (cur) window.electronAPI.updateStage(cur, nxt)
      }
    }
  }, [stageOpen, activeQueueIndex, serviceQueue])

  const handleToggleBlank = useCallback(() => {
    const newBlank = !isScreenBlanked
    setIsScreenBlanked(newBlank)
    window.electronAPI.setBlankScreen(newBlank)
  }, [isScreenBlanked])

  const handleFontSizeChange = useCallback((delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(6, Math.max(1.5, parseFloat((prev + delta).toFixed(2))))
      window.electronAPI.setFontSize(next)
      return next
    })
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
      setActiveQueueIndex(null)
    }
  }, [serviceQueue.length])

  const handleSaveService = useCallback(async () => {
    await window.electronAPI.saveService(serviceQueue)
  }, [serviceQueue])

  const handleOpenService = useCallback(async () => {
    const loaded = await window.electronAPI.openService()
    if (loaded) {
      setServiceQueue(loaded)
      setActiveQueueIndex(null)
    }
  }, [])

  const isRunning = indexer?.status === 'running'
  const pct = indexer ? Math.round((indexer.scanned / indexer.total) * 100) : 0

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1><span className="app-logo-born">BORN</span><span className="app-logo-full">Branham or Nothing</span></h1>
          <div className="file-actions">
            <button className="btn-secondary btn-sm" onClick={handleNewService} title="New service">
              New
            </button>
            <button className="btn-secondary btn-sm" onClick={handleOpenService} title="Open service file">
              Open
            </button>
            <button className="btn-secondary btn-sm" onClick={handleSaveService} title="Save service file">
              Save
            </button>
          </div>
        </div>
        <div className="header-actions">
          {projectionOpen && (
            <>
              <button className="btn-secondary" onClick={handleClearProjection}>
                Clear Screen
              </button>
              <button className="btn-alert" onClick={() => setShowAlertDialog(true)}>
                Alert
              </button>
              <button
                className={isScreenBlanked ? 'btn-primary' : 'btn-secondary'}
                onClick={handleToggleBlank}
              >
                {isScreenBlanked ? 'Restore' : 'Blank Screen'}
              </button>
              <div className="font-size-control">
                <button
                  className="btn-secondary btn-sm font-btn"
                  onClick={() => handleFontSizeChange(-0.25)}
                  disabled={fontSize <= 1.5}
                  title="Decrease font size"
                >
                  A−
                </button>
                <button
                  className="btn-secondary btn-sm font-btn"
                  onClick={() => handleFontSizeChange(0.25)}
                  disabled={fontSize >= 6}
                  title="Increase font size"
                >
                  A+
                </button>
              </div>
            </>
          )}
          <button className="btn-secondary" onClick={handleToggleStage}>
            {stageOpen ? 'Close Stage' : 'Stage View'}
          </button>
          <button
            className={projectionOpen ? 'btn-danger' : 'btn-primary'}
            onClick={handleToggleProjection}
          >
            {projectionOpen ? 'Close Projection' : 'Open Projection'}
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="search-panel">
          <div className="panel-tab-bar">
            <button
              className={`panel-tab${leftTab === 'search' ? ' active' : ''}`}
              onClick={() => setLeftTab('search')}
            >
              Search
            </button>
            <button
              className={`panel-tab${leftTab === 'browse' ? ' active' : ''}`}
              onClick={() => setLeftTab('browse')}
            >
              Browse
            </button>
          </div>
          {leftTab === 'search' ? (
            <>
              <SearchBar onResults={handleSearch} />
              <ResultsList
                results={searchResults}
                onAddToQueue={handleAddToQueue}
                onSendToProjection={handleSendToProjection}
                fontSize={fontSize}
              />
            </>
          ) : (
            <BrowsePanel
              onAddToQueue={handleAddToQueue}
              onSendToProjection={handleSendToProjection}
            />
          )}
        </div>
        <div className="queue-panel">
          <ServiceQueue
            queue={serviceQueue}
            activeIndex={activeQueueIndex}
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
            <h3 className="modal-title">Send Alert</h3>
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
              <button className="btn-secondary" onClick={() => setShowAlertDialog(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSendAlert}
                disabled={!alertMessage.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="status-bar">
        {webRemoteURL && (
          <span className="status-remote" title="Web remote URL">
            📱 {webRemoteURL}
          </span>
        )}
        {indexer === null ? (
          <span className="status-text">Initializing…</span>
        ) : indexer.status === 'done' ? (
          <span className="status-text status-ready">
            Ready — {indexer.indexed.toLocaleString()} sermons indexed
          </span>
        ) : isRunning ? (
          <>
            <span className="status-text">
              Indexing {indexer.indexed.toLocaleString()} / {indexer.total.toLocaleString()} ({pct}%)
            </span>
            <div className="status-progress">
              <div className="status-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <button className="btn-secondary btn-sm" onClick={() => window.electronAPI.stopIndexer()}>
              Stop
            </button>
          </>
        ) : indexer.indexed === 0 ? (
          <>
            <span className="status-text status-warn">Database not built — search won't work until indexed</span>
            <button className="btn-primary btn-sm" onClick={() => window.electronAPI.startIndexer()}>
              Build Index
            </button>
          </>
        ) : (
          <>
            <span className="status-text">
              {indexer.indexed.toLocaleString()} of {indexer.total.toLocaleString()} sermons indexed
            </span>
            <button className="btn-secondary btn-sm" onClick={() => window.electronAPI.startIndexer()}>
              Resume
            </button>
          </>
        )}
      </footer>
    </div>
  )
}
