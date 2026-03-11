import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

export interface Quote {
  text: string
  sermonTitle: string
  dateCode: string
  sermonId: number
  paragraphIndex: number
  paragraphRef: string
}

export interface IndexerProgress {
  status: 'idle' | 'running' | 'done'
  scanned: number
  total: number
  indexed: number
  errors: number
}

const api = {
  // Projection
  openProjection: (): Promise<void> => ipcRenderer.invoke('projection:open'),
  closeProjection: (): Promise<void> => ipcRenderer.invoke('projection:close'),
  sendQuote: (quote: Quote): void => ipcRenderer.send('projection:send-quote', quote),
  clearProjection: (): void => ipcRenderer.send('projection:clear'),

  onDisplayQuote: (callback: (quote: Quote) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, quote: Quote): void => callback(quote)
    ipcRenderer.on('projection:display-quote', handler)
    return () => ipcRenderer.removeListener('projection:display-quote', handler)
  },

  onClearQuote: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('projection:clear', handler)
    return () => ipcRenderer.removeListener('projection:clear', handler)
  },

  // Alert / Ticker
  sendAlert: (message: string): void => ipcRenderer.send('projection:alert', message),

  onAlert: (callback: (message: string) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, message: string): void => callback(message)
    ipcRenderer.on('projection:alert', handler)
    return () => ipcRenderer.removeListener('projection:alert', handler)
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
  updateStage: (current: Quote | null, next: Quote | null): void =>
    ipcRenderer.send('stage:update', { current, next }),

  onStageUpdate: (
    callback: (data: { current: Quote | null; next: Quote | null }) => void
  ): (() => void) => {
    const handler = (
      _evt: IpcRendererEvent,
      data: { current: Quote | null; next: Quote | null }
    ): void => callback(data)
    ipcRenderer.on('stage:update', handler)
    return () => ipcRenderer.removeListener('stage:update', handler)
  },

  // Web remote
  getWebRemoteURL: (): Promise<string> => ipcRenderer.invoke('webremote:ip'),
  syncWebRemote: (state: { queue: Quote[]; activeIndex: number | null; blanked: boolean }): void =>
    ipcRenderer.send('webremote:sync', state),

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
  getSermonsByIds: (ids: number[]): Promise<unknown[]> =>
    ipcRenderer.invoke('browse:sermons-by-ids', ids),
  getSermonParagraphs: (sermonId: number, language: string): Promise<Quote[]> =>
    ipcRenderer.invoke('browse:sermon-paragraphs', sermonId, language),

  // Subtitles
  getSubtitles: (sermonId: number, language: string): Promise<unknown[]> =>
    ipcRenderer.invoke('sermon:subtitles', sermonId, language),

}

contextBridge.exposeInMainWorld('electronAPI', api)
