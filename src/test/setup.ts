import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Provide a minimal window.electronAPI mock for renderer tests
if (typeof window !== 'undefined') {
  // @testing-library/user-event v14 accesses navigator.clipboard at module-load time
  if (typeof navigator !== 'undefined' && !navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.resolve()), readText: vi.fn(() => Promise.resolve('')) },
      writable: true,
      configurable: true
    })
  }

  const noop = vi.fn(() => Promise.resolve())
  const noopUnsub = vi.fn(() => vi.fn())

  Object.defineProperty(window, 'electronAPI', {
    writable: true,
    value: {
      openProjection: noop,
      closeProjection: noop,
      sendQuote: vi.fn(),
      clearProjection: vi.fn(),
      onDisplayQuote: noopUnsub,
      onClearQuote: noopUnsub,
      sendAlert: vi.fn(),
      onAlert: noopUnsub,
      searchSermons: vi.fn(() => Promise.resolve([])),
      getAutocompleteSuggestions: vi.fn(() => Promise.resolve([])),
      getHitsCountPreview: vi.fn(() => Promise.resolve(0)),
      getIndexerStatus: vi.fn(() => Promise.resolve({ status: 'idle', scanned: 0, total: 1218, indexed: 0, errors: 0 })),
      startIndexer: noop,
      stopIndexer: noop,
      onIndexerProgress: noopUnsub,
      setBlankScreen: vi.fn(),
      setFontSize: vi.fn(),
      onSetBlankScreen: noopUnsub,
      onSetFontSize: noopUnsub,
      navigateQueue: vi.fn(),
      onQueueNavigate: noopUnsub,
      saveQueue: vi.fn(),
      loadQueue: vi.fn(() => Promise.resolve([])),
      saveService: vi.fn(() => Promise.resolve(true)),
      openService: vi.fn(() => Promise.resolve(null)),
      openStage: noop,
      closeStage: noop,
      updateStage: vi.fn(),
      onStageUpdate: noopUnsub,
      getWebRemoteURL: vi.fn(() => Promise.resolve('http://192.168.1.1:4316')),
      syncWebRemote: vi.fn(),
      onWebRemoteProject: noopUnsub,
      getBrowseSeries: vi.fn(() => Promise.resolve([])),
      getBrowseStates: vi.fn(() => Promise.resolve([])),
      getBrowseCities: vi.fn(() => Promise.resolve([])),
      getBrowseDateGroups: vi.fn(() => Promise.resolve([])),
      getBrowseDurationGroups: vi.fn(() => Promise.resolve([])),
      getSermonsByIds: vi.fn(() => Promise.resolve([])),
      getSermonParagraphs: vi.fn(() => Promise.resolve([])),
      getSubtitles: vi.fn(() => Promise.resolve([]))
    }
  })
}
