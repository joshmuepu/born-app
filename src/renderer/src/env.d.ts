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
  SubtitleEntry,
  SlidePayload,
  BibleTranslation,
  ResolvedPassage,
  BibleSearchHit,
  SongSummary,
  SongDetail,
  SongImportResult
} from './types'

declare global {
  interface DisplayInfo {
    displays: Array<{ id: number; label: string; isPrimary: boolean; isInternal: boolean }>
    targetId: number
    isFallback: boolean
    isOverride: boolean
    hasExternal: boolean
  }

  interface UpdateInfo {
    current: string
    latest: string | null
    hasUpdate: boolean
    url: string
    notes?: string
    asset?: string
  }

  interface Window {
    electronAPI: {
      // App / updates
      getAppVersion: () => Promise<string>
      checkForUpdate: () => Promise<UpdateInfo>
      getUpdateInfo: () => Promise<UpdateInfo | null>
      openReleasePage: () => Promise<void>
      downloadUpdate: () => Promise<{ ok: boolean; path?: string; error?: string }>
      runInstaller: (filePath: string) => Promise<{ ok: boolean; error?: string }>
      applyUpdate: (
        filePath: string
      ) => Promise<{ ok: boolean; needsManual?: boolean; error?: string }>
      quitApp: () => Promise<void>
      onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void
      onDownloadProgress: (
        callback: (p: { received: number; total: number }) => void
      ) => () => void
      // Projection
      openProjection: () => Promise<void>
      closeProjection: () => Promise<void>
      showSlide: (slide: SlidePayload) => void
      clearProjection: () => void
      onShowSlide: (callback: (slide: SlidePayload) => void) => () => void
      onClearQuote: (callback: () => void) => () => void
      notifyProjectionReady: () => void
      onProjectionClosed: (callback: () => void) => () => void
      // Displays
      listDisplays: () => Promise<DisplayInfo>
      setProjectionDisplay: (displayId: number | null) => Promise<DisplayInfo>
      onDisplaysInfo: (callback: (info: DisplayInfo) => void) => () => void
      onProjectionDisplayInfo: (callback: (info: DisplayInfo) => void) => () => void
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
      onOperatorBlankChanged: (callback: (blank: boolean) => void) => () => void
      // Queue navigation
      navigateQueue: (dir: 'prev' | 'next') => void
      onQueueNavigate: (callback: (dir: 'prev' | 'next') => void) => () => void
      // Queue persistence  (persisted as unknown[]; migrated on load)
      saveQueue: (items: unknown[]) => void
      loadQueue: () => Promise<unknown[]>
      // Service files
      saveService: (items: unknown[]) => Promise<boolean>
      openService: () => Promise<unknown[] | null>
      // Stage view
      openStage: () => Promise<void>
      closeStage: () => Promise<void>
      updateStage: (current: SlidePayload | null, next: SlidePayload | null) => void
      onStageUpdate: (
        callback: (data: { current: SlidePayload | null; next: SlidePayload | null }) => void
      ) => () => void
      notifyStageReady: () => void
      onStageClosed: (callback: () => void) => () => void
      // Web remote
      getWebRemoteURL: () => Promise<string>
      syncWebRemote: (state: {
        queue: Array<{ title: string; kind: string; subtitle: string; slideCount: number }>
        activeIndex: number | null
        activeSlide: number
        blanked: boolean
      }) => void
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
      // Bible
      getBibleTranslations: () => Promise<BibleTranslation[]>
      lookupPassage: (
        reference: string,
        translation: string
      ) => Promise<ResolvedPassage | { error: string }>
      searchBible: (query: string, translation: string) => Promise<BibleSearchHit[]>
      getAdjacentVerse: (
        translation: string,
        bookNum: number,
        chapter: number,
        verse: number,
        direction: 'next' | 'prev'
      ) => Promise<AdjacentVerse | null>
      // Songs
      searchSongs: (query: string) => Promise<SongSummary[]>
      getSong: (id: number) => Promise<SongDetail | null>
      importSongs: () => Promise<SongImportResult | null>
      deleteSong: (id: number) => Promise<boolean>
      // Languages / translation
      getLanguages: () => Promise<Record<string, string>>
      translateQuote: (
        sermonId: number,
        paragraphRef: string,
        language: string
      ) => Promise<string | null>
    }
  }
}
