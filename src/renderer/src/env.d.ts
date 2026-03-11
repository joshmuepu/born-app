/// <reference types="vite/client" />

import type {
  Quote,
  IndexerProgress,
  SermonIndexItem,
  SeriesEntry,
  StateEntry,
  CityEntry,
  DateGroup,
  DurationGroup,
  SubtitleEntry
} from './types'

declare global {
  interface Window {
    electronAPI: {
      // Projection
      openProjection: () => Promise<void>
      closeProjection: () => Promise<void>
      sendQuote: (quote: Quote) => void
      clearProjection: () => void
      onDisplayQuote: (callback: (quote: Quote) => void) => () => void
      onClearQuote: (callback: () => void) => () => void
      // Alert / Ticker
      sendAlert: (message: string) => void
      onAlert: (callback: (message: string) => void) => () => void
      // Search (local, with server fallback)
      searchSermons: (
        query: string,
        filters?: { yearFrom?: string; yearTo?: string; titleFilter?: string; forceTokens?: boolean }
      ) => Promise<Quote[]>
      // Autocomplete
      getAutocompleteSuggestions: (wordPart: string) => Promise<string[]>
      getHitsCountPreview: (text: string, searchType: 'AllWords' | 'ExactPhrase') => Promise<number>
      // Indexer
      getIndexerStatus: () => Promise<IndexerProgress>
      startIndexer: () => Promise<void>
      stopIndexer: () => Promise<void>
      onIndexerProgress: (callback: (progress: IndexerProgress) => void) => () => void
      // Projection controls
      setBlankScreen: (blank: boolean) => void
      setFontSize: (size: number) => void
      onSetBlankScreen: (callback: (blank: boolean) => void) => () => void
      onSetFontSize: (callback: (size: number) => void) => () => void
      // Queue navigation
      navigateQueue: (dir: 'prev' | 'next') => void
      onQueueNavigate: (callback: (dir: 'prev' | 'next') => void) => () => void
      // Queue persistence
      saveQueue: (items: Quote[]) => void
      loadQueue: () => Promise<Quote[]>
      // Service files
      saveService: (items: Quote[]) => Promise<boolean>
      openService: () => Promise<Quote[] | null>
      // Stage view
      openStage: () => Promise<void>
      closeStage: () => Promise<void>
      updateStage: (current: Quote | null, next: Quote | null) => void
      onStageUpdate: (callback: (data: { current: Quote | null; next: Quote | null }) => void) => () => void
      // Web remote
      getWebRemoteURL: () => Promise<string>
      syncWebRemote: (state: { queue: Quote[]; activeIndex: number | null; blanked: boolean }) => void
      onWebRemoteProject: (callback: (index: number) => void) => () => void
      // Browse
      getBrowseSeries: () => Promise<SeriesEntry[]>
      getBrowseStates: () => Promise<StateEntry[]>
      getBrowseCities: () => Promise<CityEntry[]>
      getBrowseDateGroups: () => Promise<DateGroup[]>
      getBrowseDurationGroups: () => Promise<DurationGroup[]>
      getSermonsByIds: (ids: number[]) => Promise<SermonIndexItem[]>
      getSermonParagraphs: (sermonId: number, language: string) => Promise<Quote[]>
      // Subtitles
      getSubtitles: (sermonId: number, language: string) => Promise<SubtitleEntry[]>
    }
  }
}
