import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

export interface Quote {
  text: string
  sermonTitle: string
  dateCode: string
  sermonId: number
  paragraphIndex: number
  paragraphRef: string
  language?: string
}

export interface DisplayInfo {
  displays: Array<{ id: number; label: string; isPrimary: boolean; isInternal: boolean }>
  targetId: number
  isFallback: boolean
  isOverride: boolean
  hasExternal: boolean
  /** Stage monitor: the display it's on, or null when it stays a normal window. */
  stageTargetId: number | null
  stageIsWindowed: boolean
  stageIsOverride: boolean
  stageClashesProjection: boolean
}

export interface IndexerProgress {
  status: 'idle' | 'running' | 'done'
  scanned: number
  total: number
  indexed: number
  errors: number
}

export interface SlidePayload {
  kind: 'quote' | 'bible' | 'song'
  text: string
  label?: string
  reference?: string
  marker?: string
}

export interface UpdateInfo {
  current: string
  latest: string | null
  hasUpdate: boolean
  url: string
  notes?: string
  asset?: string
}

const api = {
  // App / updates
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  checkForUpdate: (): Promise<UpdateInfo> => ipcRenderer.invoke('app:check-update'),
  getUpdateInfo: (): Promise<UpdateInfo | null> => ipcRenderer.invoke('app:update-info'),
  openReleasePage: (): Promise<void> => ipcRenderer.invoke('app:open-release-page'),
  downloadUpdate: (): Promise<{ ok: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('app:download-update'),
  runInstaller: (filePath: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('app:run-installer', filePath),
  applyUpdate: (
    filePath: string
  ): Promise<{ ok: boolean; needsManual?: boolean; error?: string }> =>
    ipcRenderer.invoke('app:apply-update', filePath),
  quitApp: (): Promise<void> => ipcRenderer.invoke('app:quit'),
  onUpdateAvailable: (callback: (info: UpdateInfo) => void): (() => void) => {
    const handler = (_e: IpcRendererEvent, info: UpdateInfo): void => callback(info)
    ipcRenderer.on('app:update-available', handler)
    return () => ipcRenderer.removeListener('app:update-available', handler)
  },
  onDownloadProgress: (
    callback: (p: { received: number; total: number }) => void
  ): (() => void) => {
    const handler = (_e: IpcRendererEvent, p: { received: number; total: number }): void => callback(p)
    ipcRenderer.on('app:download-progress', handler)
    return () => ipcRenderer.removeListener('app:download-progress', handler)
  },

  // Projection
  openProjection: (): Promise<void> => ipcRenderer.invoke('projection:open'),
  closeProjection: (): Promise<void> => ipcRenderer.invoke('projection:close'),
  showSlide: (slide: SlidePayload): void => ipcRenderer.send('projection:show-slide', slide),
  clearProjection: (): void => ipcRenderer.send('projection:clear'),

  /** Called by the projection renderer once its IPC listeners are attached. */
  notifyProjectionReady: (): void => ipcRenderer.send('projection:ready'),

  onProjectionClosed: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('projection:closed', handler)
    return () => ipcRenderer.removeListener('projection:closed', handler)
  },

  // Displays
  listDisplays: (): Promise<DisplayInfo> => ipcRenderer.invoke('displays:list'),
  setProjectionDisplay: (displayId: number | null): Promise<DisplayInfo> =>
    ipcRenderer.invoke('projection:set-display', displayId),
  setStageDisplay: (displayId: number | null): Promise<DisplayInfo> =>
    ipcRenderer.invoke('stage:set-display', displayId),

  onDisplaysInfo: (callback: (info: DisplayInfo) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, info: DisplayInfo): void => callback(info)
    ipcRenderer.on('displays:info', handler)
    return () => ipcRenderer.removeListener('displays:info', handler)
  },

  onProjectionDisplayInfo: (callback: (info: DisplayInfo) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, info: DisplayInfo): void => callback(info)
    ipcRenderer.on('projection:display-info', handler)
    return () => ipcRenderer.removeListener('projection:display-info', handler)
  },

  onShowSlide: (callback: (slide: SlidePayload) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, slide: SlidePayload): void => callback(slide)
    ipcRenderer.on('projection:show-slide', handler)
    return () => ipcRenderer.removeListener('projection:show-slide', handler)
  },

  onClearQuote: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('projection:clear', handler)
    return () => ipcRenderer.removeListener('projection:clear', handler)
  },

  // Alert / Ticker
  sendAlert: (
    message: string,
    target: 'congregation' | 'stage' | 'both' = 'congregation'
  ): void => ipcRenderer.send('projection:alert', { message, target }),

  onAlert: (callback: (message: string) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, message: string): void => callback(message)
    ipcRenderer.on('projection:alert', handler)
    return () => ipcRenderer.removeListener('projection:alert', handler)
  },

  onStageAlert: (callback: (message: string) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, message: string): void => callback(message)
    ipcRenderer.on('stage:alert', handler)
    return () => ipcRenderer.removeListener('stage:alert', handler)
  },

  onStageSetBlank: (callback: (blank: boolean) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, blank: boolean): void => callback(blank)
    ipcRenderer.on('stage:set-blank', handler)
    return () => ipcRenderer.removeListener('stage:set-blank', handler)
  },

  onStageDisplayInfo: (callback: (info: DisplayInfo) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, info: DisplayInfo): void => callback(info)
    ipcRenderer.on('stage:display-info', handler)
    return () => ipcRenderer.removeListener('stage:display-info', handler)
  },

  // Search (local index, with automatic server fallback in main process)
  searchSermons: (
    query: string,
    filters?: { yearFrom?: string; yearTo?: string; titleFilter?: string; forceTokens?: boolean }
  ): Promise<Quote[]> => ipcRenderer.invoke('search:query', query, filters),

  // Autocomplete
  getAutocompleteSuggestions: (wordPart: string): Promise<string[]> =>
    ipcRenderer.invoke('autocomplete:suggestions', wordPart),

  getHitsCountPreview: (text: string, searchType: 'AllWords' | 'ExactPhrase'): Promise<number> =>
    ipcRenderer.invoke('autocomplete:count', text, searchType),

  // Indexer
  getIndexerStatus: (): Promise<IndexerProgress> => ipcRenderer.invoke('indexer:status'),
  startIndexer: (): Promise<void> => ipcRenderer.invoke('indexer:start'),
  stopIndexer: (): Promise<void> => ipcRenderer.invoke('indexer:stop'),

  onIndexerProgress: (callback: (progress: IndexerProgress) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, progress: IndexerProgress): void =>
      callback(progress)
    ipcRenderer.on('indexer:progress', handler)
    return () => ipcRenderer.removeListener('indexer:progress', handler)
  },

  // Projection controls (sent from main window, received by projection window)
  setBlankScreen: (blank: boolean): void => ipcRenderer.send('projection:set-blank', blank),
  setFontSize: (size: number): void => ipcRenderer.send('projection:set-font-size', size),

  onSetBlankScreen: (callback: (blank: boolean) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, blank: boolean): void => callback(blank)
    ipcRenderer.on('projection:set-blank', handler)
    return () => ipcRenderer.removeListener('projection:set-blank', handler)
  },

  onSetFontSize: (callback: (size: number) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, size: number): void => callback(size)
    ipcRenderer.on('projection:set-font-size', handler)
    return () => ipcRenderer.removeListener('projection:set-font-size', handler)
  },

  // Operator blank-state sync (main → operator, when blank is toggled from the
  // projection window Esc key or the phone web remote)
  onOperatorBlankChanged: (callback: (blank: boolean) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, blank: boolean): void => callback(blank)
    ipcRenderer.on('operator:blank-changed', handler)
    return () => ipcRenderer.removeListener('operator:blank-changed', handler)
  },

  // Queue navigation (sent from projection window, received by main window)
  navigateQueue: (dir: 'prev' | 'next'): void => ipcRenderer.send('queue:navigate', dir),

  onQueueNavigate: (callback: (dir: 'prev' | 'next') => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, dir: 'prev' | 'next'): void => callback(dir)
    ipcRenderer.on('queue:navigate', handler)
    return () => ipcRenderer.removeListener('queue:navigate', handler)
  },

  // Queue persistence
  saveQueue: (items: Quote[]): void => ipcRenderer.send('queue:save', items),
  loadQueue: (): Promise<Quote[]> => ipcRenderer.invoke('queue:load'),

  // Service files
  saveService: (items: Quote[]): Promise<boolean> => ipcRenderer.invoke('service:save', items),
  openService: (): Promise<Quote[] | null> => ipcRenderer.invoke('service:open'),

  // Stage view
  openStage: (): Promise<void> => ipcRenderer.invoke('stage:open'),
  closeStage: (): Promise<void> => ipcRenderer.invoke('stage:close'),
  updateStage: (current: SlidePayload | null, next: SlidePayload | null): void =>
    ipcRenderer.send('stage:update', { current, next }),

  /** Called by the stage renderer once its IPC listeners are attached. */
  notifyStageReady: (): void => ipcRenderer.send('stage:ready'),

  onStageClosed: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('stage:closed', handler)
    return () => ipcRenderer.removeListener('stage:closed', handler)
  },

  onStageUpdate: (
    callback: (data: { current: SlidePayload | null; next: SlidePayload | null }) => void
  ): (() => void) => {
    const handler = (
      _evt: IpcRendererEvent,
      data: { current: SlidePayload | null; next: SlidePayload | null }
    ): void => callback(data)
    ipcRenderer.on('stage:update', handler)
    return () => ipcRenderer.removeListener('stage:update', handler)
  },

  // Web remote
  getWebRemoteURL: (): Promise<string> => ipcRenderer.invoke('webremote:ip'),
  syncWebRemote: (state: {
    queue: Array<{ title: string; kind: string; subtitle: string; slideCount: number }>
    activeIndex: number | null
    activeSlide: number
    blanked: boolean
  }): void => ipcRenderer.send('webremote:sync', state),

  onWebRemoteProject: (callback: (index: number) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, index: number): void => callback(index)
    ipcRenderer.on('webremote:project', handler)
    return () => ipcRenderer.removeListener('webremote:project', handler)
  },

  // Browse
  getBrowseSeries: (): Promise<unknown[]> => ipcRenderer.invoke('browse:series'),
  getBrowseStates: (): Promise<unknown[]> => ipcRenderer.invoke('browse:states'),
  getBrowseCities: (): Promise<unknown[]> => ipcRenderer.invoke('browse:cities'),
  getBrowseDateGroups: (): Promise<unknown[]> => ipcRenderer.invoke('browse:date-groups'),
  getBrowseDurationGroups: (): Promise<unknown[]> => ipcRenderer.invoke('browse:duration-groups'),
  getBrowseLocation: (): Promise<unknown[]> => ipcRenderer.invoke('browse:location'),
  getSermonsByIds: (ids: number[]): Promise<unknown[]> =>
    ipcRenderer.invoke('browse:sermons-by-ids', ids),
  getSermonParagraphs: (sermonId: number, language: string): Promise<Quote[]> =>
    ipcRenderer.invoke('browse:sermon-paragraphs', sermonId, language),

  // Subtitles
  getSubtitles: (sermonId: number, language: string): Promise<unknown[]> =>
    ipcRenderer.invoke('sermon:subtitles', sermonId, language),

  // Bible
  getBibleTranslations: (): Promise<Array<{ code: string; name: string }>> =>
    ipcRenderer.invoke('bible:translations'),
  lookupPassage: (reference: string, translation: string): Promise<unknown> =>
    ipcRenderer.invoke('bible:lookup', reference, translation),
  searchBible: (query: string, translation: string): Promise<unknown[]> =>
    ipcRenderer.invoke('bible:search', query, translation),
  getAdjacentVerse: (
    translation: string,
    bookNum: number,
    chapter: number,
    verse: number,
    direction: 'next' | 'prev'
  ): Promise<unknown> =>
    ipcRenderer.invoke('bible:adjacent-verse', translation, bookNum, chapter, verse, direction),

  // Songs
  searchSongs: (query: string): Promise<unknown[]> => ipcRenderer.invoke('songs:search', query),
  getSong: (id: number): Promise<unknown> => ipcRenderer.invoke('songs:get', id),
  importSongs: (): Promise<unknown> => ipcRenderer.invoke('songs:import'),
  deleteSong: (id: number): Promise<boolean> => ipcRenderer.invoke('songs:delete', id),

  // Languages / translation
  getLanguages: (): Promise<Record<string, string>> => ipcRenderer.invoke('languages:list'),
  translateQuote: (
    sermonId: number,
    paragraphRef: string,
    language: string
  ): Promise<string | null> =>
    ipcRenderer.invoke('languages:translate-quote', sermonId, paragraphRef, language)
}

contextBridge.exposeInMainWorld('electronAPI', api)
