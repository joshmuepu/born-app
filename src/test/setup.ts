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
      showSlide: vi.fn(),
      clearProjection: vi.fn(),
      onShowSlide: noopUnsub,
      onClearQuote: noopUnsub,
      notifyProjectionReady: vi.fn(),
      onProjectionClosed: noopUnsub,
      listDisplays: vi.fn(() =>
        Promise.resolve({
          displays: [{ id: 1, label: 'Built-in display', isPrimary: true, isInternal: true }],
          targetId: 1,
          isFallback: true,
          isOverride: false,
          hasExternal: false
        })
      ),
      setProjectionDisplay: vi.fn(() =>
        Promise.resolve({
          displays: [],
          targetId: 1,
          isFallback: true,
          isOverride: false,
          hasExternal: false
        })
      ),
      onDisplaysInfo: noopUnsub,
      onProjectionDisplayInfo: noopUnsub,
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
      onOperatorBlankChanged: noopUnsub,
      saveQueue: vi.fn(),
      loadQueue: vi.fn(() => Promise.resolve([])),
      saveService: vi.fn(() => Promise.resolve(true)),
      openService: vi.fn(() => Promise.resolve(null)),
      openStage: noop,
      closeStage: noop,
      updateStage: vi.fn(),
      onStageUpdate: noopUnsub,
      notifyStageReady: vi.fn(),
      onStageClosed: noopUnsub,
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
      getSubtitles: vi.fn(() => Promise.resolve([])),
      getBibleTranslations: vi.fn(() => Promise.resolve([{ code: 'KJV', name: 'King James Version' }])),
      lookupPassage: vi.fn(() => Promise.resolve({ error: 'not found' })),
      searchBible: vi.fn(() => Promise.resolve([])),
      searchSongs: vi.fn(() => Promise.resolve([])),
      getSong: vi.fn(() => Promise.resolve(null)),
      importSongs: vi.fn(() => Promise.resolve(null)),
      deleteSong: vi.fn(() => Promise.resolve(false)),
      getLanguages: vi.fn(() => Promise.resolve({})),
      translateQuote: vi.fn(() => Promise.resolve(null))
    }
  })
}
