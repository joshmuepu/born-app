import type { SlideMedia, SlideBackground } from '../shared/media'
import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron'

/** Which phone/role added something, from the remote's "Who's this?" picker
 *  — undefined when that phone skipped picking one. */
export interface RemoteContributor {
  deviceId: string
  label: string
}

export interface Quote {
  text: string
  sermonTitle: string
  dateCode: string
  sermonId: number
  paragraphIndex: number
  paragraphRef: string
  language?: string
}

export interface ManualPage {
  id: string
  title: string
  file: string
}

export interface ManualSection {
  id: string
  title: string
  pages: ManualPage[]
}

export interface ManualManifest {
  version: string
  sections: ManualSection[]
}

export interface DisplayEntry {
  id: number
  /** Full description — custom name (if any) + raw model + resolution + tags. */
  label: string
  /** Same, but always the raw system label, ignoring any operator name —
   *  used as the seed text when renaming. */
  shortLabel: string
  /** Operator-given name ("Sanctuary Projector"), if this display has one. */
  name: string | null
  isPrimary: boolean
  isInternal: boolean
}

export interface NamedDisplayStatus {
  name: string
  /** Whether a currently-connected display matches this saved name right now. */
  connected: boolean
}

export interface DisplayInfo {
  displays: DisplayEntry[]
  /** Every operator-named display, connected or not. */
  namedDisplays: NamedDisplayStatus[]
  targetId: number
  targetName: string | null
  isFallback: boolean
  isOverride: boolean
  /** Set when the projection override names a display that isn't currently
   *  connected — the app fell back to auto-pick, but this says why/what. */
  missingOverrideName: string | null
  hasExternal: boolean
  /** Stage monitor: the display it's on, or null when it stays a normal window. */
  stageTargetId: number | null
  stageTargetName: string | null
  stageIsWindowed: boolean
  stageIsOverride: boolean
  stageMissingOverrideName: string | null
  stageClashesProjection: boolean
}

export interface IndexerProgress {
  status: 'idle' | 'running' | 'done'
  scanned: number
  total: number
  indexed: number
  errors: number
}

export type SlideSource =
  | { kind: 'bible'; bookNum: number; chapter: number; verse: number }
  | { kind: 'quote'; sermonId: number; paragraphRef: string }

export interface SlidePayload {
  kind: 'quote' | 'bible' | 'song' | 'media'
  /** Picture slides only. */
  media?: SlideMedia
  /** Still background behind text on this output (set per destination/channel). */
  background?: SlideBackground
  text: string
  label?: string
  reference?: string
  marker?: string
  /** Structured source identity, for a channel configured to 'follow' this
   *  one. Absent for a song slide, or anything built before this existed. */
  source?: SlideSource
  /** This channel follows another, had no translation for this content, and
   *  fell back to English. */
  translationFallback?: boolean
}

export type PresentationProfileId = 'fullscreen' | 'lower-third'

export interface OutputInfo {
  id: string
  channelId: string
  kind: 'window' | 'browser'
  url: string | null
  /** For OBS on the same computer: `http://127.0.0.1:<port>/…` (see main/index.ts). */
  localUrl?: string | null
  profileId: PresentationProfileId | null
  autoProfile: boolean
  suppressed: boolean
}

export type SyncMode = 'independent' | 'follow' | 'linked'

export interface ChannelSyncConfig {
  syncMode: SyncMode
  linkedTo?: string
}

export interface ChannelInfo {
  id: string
  label: string
  translation: string
  songbookId: string
  sync: ChannelSyncConfig
}

export interface ObservabilityDestination {
  id: string
  kind: 'window' | 'browser'
  label: string
  connected: boolean
  warning: string | null
}

export interface ObservabilityChannel {
  id: string
  label: string
  current: SlidePayload | null
  blanked: boolean
  destinations: ObservabilityDestination[]
}

/** One channel's authoritative output state (see main/index.ts liveSnapshot). */
export interface LiveChannel {
  id: string
  label: string
  current: SlidePayload | null
  next: SlidePayload | null
  blanked: boolean
}

export interface Songbook {
  id: string
  label: string
}

export interface RemoteAdapterInfo {
  name: string
  /** Operator-facing name, e.g. "Wi-Fi (CBCI-3170)". */
  label: string
  address: string
  virtual: boolean
  /** Shown by default (false = VPN / virtual switch / link-local). */
  usable: boolean
  hiddenReason: string | null
  /** This is the address the QR code is using. */
  chosen: boolean
  /** Self-connect result; null when the server isn't running. */
  reachable: boolean | null
  reachError: string | null
}

export interface RemotePhoneConnection {
  clientIp: string
  subnet: string
  viaAddress: string
  active: boolean
}

export interface RemoteNetworkInfo {
  id: string
  name: string
  label: string
  address: string
  kind: 'wifi' | 'ethernet' | 'vpn' | 'virtual' | 'other'
  ssid: string | null
  private: boolean
  usable: boolean
  hiddenReason: string | null
}

export interface WebRemoteInfo {
  available: boolean
  /** Address for the default network (kept for older callers). */
  url: string
  ipUrl: string
  hostnameUrl: string | null
  port: number
  networks: RemoteNetworkInfo[]
  selectedId: string | null
  /** One short line explaining why selectedId was chosen; null for a single network. */
  reason: string | null
}

export interface RemoteDiagnostics {
  available: boolean
  port: number
  /** The address the QR code is currently using. */
  chosenIp: string
  adapters: RemoteAdapterInfo[]
  mdnsHostname: string | null
  connectedPhones: number
  phones: RemotePhoneConnection[]
  hints: string[]
  firewallCommands: string[]
  recentLogLines: string[]
  platform: string
}

export interface UpdateInfo {
  current: string
  latest: string | null
  hasUpdate: boolean
  url: string
  notes?: string
  asset?: string
  checkFailed?: boolean
}

export interface DbRecoveryStatus {
  recovered: boolean
  quarantinedTo?: string
}

export interface DataRecoveryInfo {
  sermons: DbRecoveryStatus
  library: DbRecoveryStatus
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
  getDataRecoveryInfo: (): Promise<DataRecoveryInfo> => ipcRenderer.invoke('app:data-recovery-info'),
  openDataFolder: (): Promise<string> => ipcRenderer.invoke('app:open-data-folder'),

  // Help / manual
  getManualManifest: (): Promise<ManualManifest | null> => ipcRenderer.invoke('manual:manifest'),
  getManualPage: (relPath: string): Promise<string | null> => ipcRenderer.invoke('manual:page', relPath),
  getManualImage: (relPath: string): Promise<string | null> => ipcRenderer.invoke('manual:image', relPath),
  printManualPdf: (html: string, suggestedName: string): Promise<{ saved: boolean; path?: string }> =>
    ipcRenderer.invoke('manual:print-pdf', html, suggestedName),
  openManualExternalLink: (url: string): Promise<void> => ipcRenderer.invoke('manual:open-external', url),
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
  renameDisplay: (displayId: number, name: string): Promise<DisplayInfo> =>
    ipcRenderer.invoke('displays:rename', displayId, name),
  clearDisplayName: (name: string): Promise<DisplayInfo> => ipcRenderer.invoke('displays:clear-name', name),
  identifyDisplay: (displayId: number): Promise<boolean> => ipcRenderer.invoke('displays:identify', displayId),
  testPatternDisplay: (displayId: number): Promise<boolean> =>
    ipcRenderer.invoke('displays:test-pattern', displayId),
  getDisplayDiagnostics: (): Promise<string> => ipcRenderer.invoke('displays:diagnostics'),

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
    filters?: {
      yearFrom?: string
      yearTo?: string
      titleFilter?: string
      matchMode?: 'phrase' | 'all' | 'any'
      dateCode?: string
    }
  ): Promise<Quote[]> => ipcRenderer.invoke('search:query', query, filters),

  // Media library (Phase 1a)
  mediaInfo: (): Promise<unknown> => ipcRenderer.invoke('media:info'),
  mediaList: (q?: unknown): Promise<unknown[]> => ipcRenderer.invoke('media:list', q),
  mediaGet: (id: string): Promise<unknown> => ipcRenderer.invoke('media:get', id),
  mediaTags: (): Promise<Array<{ tag: string; count: number }>> => ipcRenderer.invoke('media:tags'),
  mediaFolders: (): Promise<unknown[]> => ipcRenderer.invoke('media:folders'),
  mediaCheckAll: (): Promise<Array<{ id: string; status: string }>> => ipcRenderer.invoke('media:check-all'),
  mediaCheck: (id: string): Promise<string> => ipcRenderer.invoke('media:check', id),
  mediaThumbPath: (id: string, width?: number): Promise<string | null> => ipcRenderer.invoke('media:thumb-path', id, width),
  mediaImportPaths: (paths: string[], opts?: unknown): Promise<unknown> => ipcRenderer.invoke('media:import-paths', paths, opts),
  mediaPickAndImport: (opts?: unknown): Promise<unknown> => ipcRenderer.invoke('media:pick-and-import', opts),
  mediaRename: (id: string, name: string): Promise<boolean> => ipcRenderer.invoke('media:rename', id, name),
  mediaFavorite: (id: string, fav: boolean): Promise<boolean> => ipcRenderer.invoke('media:favorite', id, fav),
  mediaSetTags: (id: string, tags: string[]): Promise<boolean> => ipcRenderer.invoke('media:set-tags', id, tags),
  mediaMove: (ids: string[], folderId: string | null): Promise<boolean> => ipcRenderer.invoke('media:move', ids, folderId),
  mediaMarkUsed: (id: string): Promise<boolean> => ipcRenderer.invoke('media:mark-used', id),
  mediaRemove: (ids: string[]): Promise<boolean> => ipcRenderer.invoke('media:remove', ids),
  mediaRestore: (ids: string[]): Promise<unknown[]> => ipcRenderer.invoke('media:restore', ids),
  mediaPurgeNow: (): Promise<{ purged: number; filesDeleted: number }> => ipcRenderer.invoke('media:purge-now'),
  mediaFolderCreate: (name: string, parentId?: string | null): Promise<unknown> => ipcRenderer.invoke('media:folder-create', name, parentId),
  mediaFolderRename: (id: string, name: string): Promise<boolean> => ipcRenderer.invoke('media:folder-rename', id, name),
  mediaFolderDelete: (id: string): Promise<boolean> => ipcRenderer.invoke('media:folder-delete', id),
  mediaRelinkPick: (id: string): Promise<unknown> => ipcRenderer.invoke('media:relink-pick', id),
  mediaImportBuffer: (name: string, bytes: ArrayBuffer, opts?: unknown): Promise<unknown> => ipcRenderer.invoke('media:import-buffer', name, bytes, opts),
  mediaBackgroundsGet: (): Promise<{ settings: { destinations: Record<string, { mediaId: string | null; dim: number }>; channels: Record<string, { mediaId: string | null; dim: number }> }; congregationMain: { mediaId: string; dim: number } | null }> =>
    ipcRenderer.invoke('media:backgrounds-get'),
  mediaBackgroundSet: (scope: 'destination' | 'channel', id: string, bg: { mediaId: string | null; dim?: number } | null): Promise<boolean> =>
    ipcRenderer.invoke('media:background-set', scope, id, bg),
  onMediaBackgroundsChanged: (cb: () => void): (() => void) => {
    const h = (): void => cb()
    ipcRenderer.on('media:backgrounds-changed', h)
    return () => ipcRenderer.removeListener('media:backgrounds-changed', h)
  },
  mediaPickPdf: (): Promise<{ canceled: boolean; name?: string; bytes?: ArrayBuffer; error?: string }> => ipcRenderer.invoke('media:pick-pdf'),
  /** Test-only: honoured only when BORN_TEST_ALLOW_SET_PDF or BORN_TEST_PICK_PDF is set in the environment. */
  mediaTestSetPdf: (path: string): Promise<boolean> => ipcRenderer.invoke('media:test-set-pdf', path),
  mediaLogoGet: (): Promise<string | null> => ipcRenderer.invoke('media:logo-get'),
  mediaLogoSet: (id: string | null): Promise<boolean> => ipcRenderer.invoke('media:logo-set', id),
  onLogoShortcut: (cb: () => void): (() => void) => {
    const h = (): void => cb()
    ipcRenderer.on('shortcut:logo', h)
    return () => ipcRenderer.removeListener('shortcut:logo', h)
  },
  mediaReveal: (id: string): Promise<boolean> => ipcRenderer.invoke('media:reveal', id),
  mediaResolveHashes: (hashes: string[]): Promise<Record<string, string>> => ipcRenderer.invoke('media:resolve-hashes', hashes),
  mediaLocateFolder: (wanted: Array<{ hash: string; bytes: number }>): Promise<{ canceled: boolean; found: Record<string, string>; scanned: number }> => ipcRenderer.invoke('media:locate-folder', wanted),
  mediaPreflight: (ids: string[]): Promise<unknown[]> => ipcRenderer.invoke('media:preflight', ids),
  mediaPrepareDisplay: (id: string): Promise<{ ok: boolean; status: string }> => ipcRenderer.invoke('media:prepare-display', id),
  /** Real file-system paths of dropped File objects (Electron 33: File.path is gone). */
  mediaPlaybackCommand: (channelId: string, action: unknown): Promise<unknown> => ipcRenderer.invoke('media:playback-command', channelId, action),
  mediaPlaybackGet: (channelId: string): Promise<unknown> => ipcRenderer.invoke('media:playback-get', channelId),
  mediaPlaybackReport: (r: { position: number; playing: boolean; duration?: number | null; ended?: boolean; stalled?: boolean; error?: string | null }): void => ipcRenderer.send('media:playback-report', r),
  onMediaPlayback: (cb: (m: import('../shared/videoPlayback').PlaybackWire) => void): (() => void) => {
    const h = (_e: unknown, m: import('../shared/videoPlayback').PlaybackWire): void => cb(m)
    ipcRenderer.on('media:playback', h)
    return () => ipcRenderer.removeListener('media:playback', h)
  },
  onMediaPlaybackStop: (cb: (channelId: string) => void): (() => void) => {
    const h = (_e: unknown, c: string): void => cb(c)
    ipcRenderer.on('media:playback-stop', h)
    return () => ipcRenderer.removeListener('media:playback-stop', h)
  },
  // Tape service (sermon audio + follow-along) — docs/design/sermon-audio
  tapeInfo: (): Promise<{ available: boolean; message: string | null; folder: string | null; audioPage: string }> => ipcRenderer.invoke('tape:info'),
  tapeRecordings: (sermonId: number): Promise<unknown[]> => ipcRenderer.invoke('tape:recordings', sermonId),
  tapeSermonsWithTapes: (): Promise<number[]> => ipcRenderer.invoke('tape:sermons-with-tapes'),
  tapeImportPaths: (paths: string[], opts?: { sermonId?: number; language?: string; link?: boolean }): Promise<unknown[]> => ipcRenderer.invoke('tape:import-paths', paths, opts),
  tapePickAndImport: (opts?: { sermonId?: number; language?: string; link?: boolean }): Promise<{ canceled: boolean; results: unknown[] }> => ipcRenderer.invoke('tape:pick-and-import', opts),
  tapeRemove: (recordingId: string): Promise<boolean> => ipcRenderer.invoke('tape:remove', recordingId),
  tapeMatchName: (fileName: string): Promise<unknown> => ipcRenderer.invoke('tape:match-name', fileName),
  tapePickFolder: (): Promise<string | null> => ipcRenderer.invoke('tape:pick-folder'),
  tapeClearFolder: (): Promise<boolean> => ipcRenderer.invoke('tape:clear-folder'),
  tapeScanFolder: (): Promise<unknown[]> => ipcRenderer.invoke('tape:scan-folder'),
  tapeImportConfirmed: (items: Array<{ path: string; sermonId: number }>): Promise<unknown[]> => ipcRenderer.invoke('tape:import-confirmed', items),
  tapePreflight: (recordingId: string, extra?: unknown): Promise<unknown> => ipcRenderer.invoke('tape:preflight', recordingId, extra),
  tapeMapGet: (recordingId: string, textLanguage: string | null): Promise<unknown> => ipcRenderer.invoke('tape:map-get', recordingId, textLanguage),
  tapeMapLanguages: (recordingId: string): Promise<Array<string | null>> => ipcRenderer.invoke('tape:map-languages', recordingId),
  tapeMapSave: (recordingId: string, textLanguage: string | null, source: string, marks: unknown, regions: unknown): Promise<unknown> => ipcRenderer.invoke('tape:map-save', recordingId, textLanguage, source, marks, regions),
  tapePickTool: (which: 'whisper' | 'model' | 'ffmpeg'): Promise<string | null> => ipcRenderer.invoke('tape:pick-tool', which),
  tapeAlignRun: (recordingId: string, paragraphs: Array<{ n: number; text: string }>): Promise<unknown> => ipcRenderer.invoke('tape:align-run', recordingId, paragraphs),
  tapeAlignCancel: (): Promise<boolean> => ipcRenderer.invoke('tape:align-cancel'),
  onTapeAlignProgress: (cb: (p: { phase: 'prepare' | 'listen' | 'match'; pct: number }) => void): (() => void) => {
    const h = (_e: unknown, p: { phase: 'prepare' | 'listen' | 'match'; pct: number }): void => cb(p)
    ipcRenderer.on('tape:align-progress', h)
    return () => ipcRenderer.removeListener('tape:align-progress', h)
  },
  tapeMapDelete: (recordingId: string, textLanguage: string | null): Promise<boolean> => ipcRenderer.invoke('tape:map-delete', recordingId, textLanguage),
  tapeMapExport: (recordingId: string, textLanguage: string | null): Promise<unknown> => ipcRenderer.invoke('tape:map-export', recordingId, textLanguage),
  tapeMapImport: (recordingId: string): Promise<unknown> => ipcRenderer.invoke('tape:map-import', recordingId),
  tapeActivity: (recordingId: string, bins: number): Promise<{ values: number[]; durationSec: number } | null> => ipcRenderer.invoke('tape:activity', recordingId, bins),
  tapeOpenAudioPage: (): Promise<boolean> => ipcRenderer.invoke('tape:open-audio-page'),
  tapePathsForFiles: (files: File[]): string[] => files.map((f) => webUtils.getPathForFile(f)).filter(Boolean),
  // the Tape audio engine's own channel (the hidden audio window) and the operator's tape controls
  onTapeEngine: (cb: (m: unknown) => void): (() => void) => {
    const h = (_e: unknown, m: unknown): void => cb(m)
    ipcRenderer.on('tape:engine', h)
    return () => ipcRenderer.removeListener('tape:engine', h)
  },
  tapeEngineReport: (r: unknown): void => ipcRenderer.send('tape:engine-report', r),
  tapeEngineDevices: (list: unknown): void => ipcRenderer.send('tape:engine-devices', list),
  tapeEngineDeviceLost: (): void => ipcRenderer.send('tape:engine-device-lost'),
  tapeEngineReady: (): void => ipcRenderer.send('tape:engine-ready'),
  tapeLoad: (recordingId: string, opts?: { play?: boolean; position?: number }): Promise<unknown> => ipcRenderer.invoke('tape:load', recordingId, opts),
  tapeCommand: (action: unknown): Promise<unknown> => ipcRenderer.invoke('tape:command', action),
  tapeGet: (): Promise<unknown> => ipcRenderer.invoke('tape:get'),
  tapeUnload: (): Promise<boolean> => ipcRenderer.invoke('tape:unload'),
  tapeDevices: (): Promise<Array<{ id: string; label: string }>> => ipcRenderer.invoke('tape:devices'),
  tapeSetDevice: (id: string, label: string): Promise<boolean> => ipcRenderer.invoke('tape:set-device', id, label),
  tapeSettingsGet: (): Promise<unknown> => ipcRenderer.invoke('tape:settings-get'),
  tapeSettingsSet: (patch: unknown): Promise<unknown> => ipcRenderer.invoke('tape:settings-set', patch),
  onTapeState: (cb: (w: unknown) => void): (() => void) => {
    const h = (_e: unknown, w: unknown): void => cb(w)
    ipcRenderer.on('tape:state', h)
    return () => ipcRenderer.removeListener('tape:state', h)
  },
  youtubeHostUrl: (videoId: string, start?: number): Promise<string | null> => ipcRenderer.invoke('youtube:host-url', videoId, start),
  youtubeLookup: (videoId: string): Promise<{ title: string; author: string } | null> => ipcRenderer.invoke('youtube:lookup', videoId),
  youtubePreflight: (items: Array<{ videoId: string; hasFallback: boolean }>): Promise<unknown[]> => ipcRenderer.invoke('youtube:preflight', items),
  youtubeTestPlay: (videoId: string): Promise<unknown> => ipcRenderer.invoke('youtube:test-play', videoId),
  youtubeRecentsGet: (): Promise<unknown[]> => ipcRenderer.invoke('youtube:recents-get'),
  youtubeRecentsAdd: (r: { videoId: string; title?: string; label?: string }): Promise<unknown[]> => ipcRenderer.invoke('youtube:recents-add', r),
  youtubeRecentsRemove: (videoId: string): Promise<unknown[]> => ipcRenderer.invoke('youtube:recents-remove', videoId),
  onOperatorNotice: (cb: (message: string) => void): (() => void) => {
    const h = (_e: unknown, m: string): void => cb(m)
    ipcRenderer.on('operator:notice', h)
    return () => ipcRenderer.removeListener('operator:notice', h)
  },
  packEstimate: (queue: unknown): Promise<unknown> => ipcRenderer.invoke('pack:estimate', queue),
  packExport: (queue: unknown, title: string): Promise<unknown> => ipcRenderer.invoke('pack:export', queue, title),
  packPickAndInspect: (): Promise<unknown> => ipcRenderer.invoke('pack:pick-and-inspect'),
  packInspectPath: (path: string): Promise<unknown> => ipcRenderer.invoke('pack:inspect-path', path),
  packImport: (path: string): Promise<unknown> => ipcRenderer.invoke('pack:import', path),
  packCancel: (): void => ipcRenderer.send('pack:cancel'),
  onPackProgress: (cb: (p: { kind: 'export' | 'check' | 'import'; done: number; total: number; doneBytes?: number; totalBytes?: number; current?: string }) => void): (() => void) => {
    const h = (_e: unknown, p: Parameters<typeof cb>[0]): void => cb(p)
    ipcRenderer.on('pack:progress', h)
    return () => ipcRenderer.removeListener('pack:progress', h)
  },
  mediaReconnectLinked: (): Promise<{ canceled: boolean; relinked: number; stillMissing: number; scanned: number }> => ipcRenderer.invoke('media:reconnect-linked'),
  mediaCopyIntoLibrary: (ids: string[]): Promise<{ copied: number; failed: number; message: string | null }> => ipcRenderer.invoke('media:copy-into-library', ids),
  mediaPathsForFiles: (files: File[]): string[] => files.map((f) => webUtils.getPathForFile(f)).filter(Boolean),
  onMediaImportProgress: (cb: (p: { done: number; total: number; current: string }) => void): (() => void) => {
    const h = (_e: IpcRendererEvent, p: { done: number; total: number; current: string }): void => cb(p)
    ipcRenderer.on('media:import-progress', h)
    return () => ipcRenderer.removeListener('media:import-progress', h)
  },

  // Autocomplete
  getAutocompleteSuggestions: (wordPart: string): Promise<string[]> =>
    ipcRenderer.invoke('autocomplete:suggestions', wordPart),

  getHitsCountPreview: (text: string, searchType: 'AllWords' | 'ExactPhrase'): Promise<number> =>
    ipcRenderer.invoke('autocomplete:count', text, searchType),

  // Indexer
  getIndexerStatus: (): Promise<IndexerProgress> => ipcRenderer.invoke('indexer:status'),
  startIndexer: (opts?: { forceRefresh?: boolean }): Promise<void> =>
    ipcRenderer.invoke('indexer:start', opts),
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
  getFontSize: (): Promise<number> => ipcRenderer.invoke('projection:get-font-size'),

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

  // Theme (control window only — projection + stage stay dark)
  getTheme: (): Promise<'dark' | 'light'> => ipcRenderer.invoke('theme:get'),
  setTheme: (theme: 'dark' | 'light'): Promise<'dark' | 'light'> =>
    ipcRenderer.invoke('theme:set', theme),
  onThemeChanged: (callback: (theme: 'dark' | 'light') => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, theme: 'dark' | 'light'): void => callback(theme)
    ipcRenderer.on('theme:changed', handler)
    return () => ipcRenderer.removeListener('theme:changed', handler)
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
  getRecentServices: (): Promise<Array<{ path: string; name: string; mtimeMs: number }>> =>
    ipcRenderer.invoke('service:recents'),
  openServicePath: (path: string): Promise<Quote[] | null> =>
    ipcRenderer.invoke('service:open-path', path),
  importService: (): Promise<{ files: Array<{ name: string; items: unknown[] }>; failed: string[] }> =>
    ipcRenderer.invoke('service:import'),

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

  // Automation API (Stream Deck/Companion)
  getAutomationInfo: (): Promise<{ token: string | null; baseUrl: string | null }> =>
    ipcRenderer.invoke('automation:get-info'),
  setAutomationToken: (token: string | null): Promise<{ token: string | null; baseUrl: string | null }> =>
    ipcRenderer.invoke('automation:set-token', token),
  generateAutomationToken: (): Promise<{ token: string | null; baseUrl: string | null }> =>
    ipcRenderer.invoke('automation:generate-token'),

  // Outputs (Phase 2: the Graphics destination)
  listOutputs: (): Promise<OutputInfo[]> => ipcRenderer.invoke('outputs:list'),
  addGraphicsOutput: (channelId: string): Promise<OutputInfo[]> =>
    ipcRenderer.invoke('outputs:add-graphics', channelId),
  removeOutput: (id: string): Promise<OutputInfo[]> => ipcRenderer.invoke('outputs:remove', id),
  setOutputProfile: (id: string, profileId: PresentationProfileId): Promise<OutputInfo[]> =>
    ipcRenderer.invoke('outputs:set-profile', id, profileId),
  setOutputAutoProfile: (id: string, autoProfile: boolean): Promise<OutputInfo[]> =>
    ipcRenderer.invoke('outputs:set-auto-profile', id, autoProfile),
  setDestinationSuppressed: (id: string, suppressed: boolean): Promise<OutputInfo[]> =>
    ipcRenderer.invoke('destination:set-suppressed', id, suppressed),
  onOutputsChanged: (callback: (outputs: OutputInfo[]) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, outputs: OutputInfo[]): void => callback(outputs)
    ipcRenderer.on('outputs:changed', handler)
    return () => ipcRenderer.removeListener('outputs:changed', handler)
  },

  // Channels (Phase 5: a second independent channel)
  listChannels: (): Promise<ChannelInfo[]> => ipcRenderer.invoke('channels:list'),
  addChannel: (label: string, inheritTranslation?: string): Promise<ChannelInfo[]> =>
    ipcRenderer.invoke('channels:add', label, inheritTranslation),
  removeChannel: (id: string): Promise<ChannelInfo[]> => ipcRenderer.invoke('channels:remove', id),
  setChannelTranslation: (id: string, translation: string): Promise<ChannelInfo[]> =>
    ipcRenderer.invoke('channels:set-translation', id, translation),
  setChannelSongbook: (id: string, songbookId: string): Promise<ChannelInfo[]> =>
    ipcRenderer.invoke('channels:set-songbook', id, songbookId),
  setChannelSync: (id: string, sync: ChannelSyncConfig): Promise<ChannelInfo[]> =>
    ipcRenderer.invoke('channels:set-sync', id, sync),
  onChannelsChanged: (callback: (channels: ChannelInfo[]) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, channels: ChannelInfo[]): void => callback(channels)
    ipcRenderer.on('channels:changed', handler)
    return () => ipcRenderer.removeListener('channels:changed', handler)
  },
  showSlideOnChannel: (channelId: string, slide: SlidePayload): void =>
    ipcRenderer.send('channel:show-slide', channelId, slide),
  clearChannel: (channelId: string): void => ipcRenderer.send('channel:clear', channelId),

  // Observability — pull-only (the view polls while open; see its own
  // component for why this isn't a push subscription).
  getObservability: (): Promise<ObservabilityChannel[]> => ipcRenderer.invoke('observability:snapshot'),
  // Live output state — the Preview/Live pair's source of truth.
  getLiveState: (): Promise<LiveChannel[]> => ipcRenderer.invoke('live:snapshot'),
  onLiveChanged: (callback: (live: LiveChannel[]) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, live: LiveChannel[]): void => callback(live)
    ipcRenderer.on('live:changed', handler)
    return () => ipcRenderer.removeListener('live:changed', handler)
  },
  getWebRemoteURL: (): Promise<WebRemoteInfo> => ipcRenderer.invoke('webremote:ip'),
  getWebRemoteDiagnostics: (selectedId?: string): Promise<RemoteDiagnostics> =>
    ipcRenderer.invoke('webremote:diagnostics', selectedId),
  syncWebRemote: (state: {
    queue: Array<{
      id: string
      title: string
      kind: string
      subtitle: string
      slideCount: number
      played: boolean
      source?: { label: string }
      slides: Array<{ text: string; label?: string; marker?: string; reference?: string }>
    }>
    activeIndex: number | null
    activeSlide: number
    blanked: boolean
    bibleTranslation: string
    onScreen: {
      kind: string
      text: string
      reference?: string
      label?: string
      marker?: string
      nextText?: string
      readingAhead?: boolean
    } | null
  }): void => ipcRenderer.send('webremote:sync', state),

  onWebRemoteProject: (callback: (id: string) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, id: string): void => callback(id)
    ipcRenderer.on('webremote:project', handler)
    return () => ipcRenderer.removeListener('webremote:project', handler)
  },
  onWebRemoteProjectAt: (
    callback: (data: { id: string; slide: number }) => void
  ): (() => void) => {
    const handler = (_evt: IpcRendererEvent, data: { id: string; slide: number }): void =>
      callback(data)
    ipcRenderer.on('webremote:project-at', handler)
    return () => ipcRenderer.removeListener('webremote:project-at', handler)
  },

  onWebRemoteReorder: (callback: (data: { id: string; toId: string }) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, data: { id: string; toId: string }): void => callback(data)
    ipcRenderer.on('webremote:reorder', handler)
    return () => ipcRenderer.removeListener('webremote:reorder', handler)
  },
  onWebRemoteRemove: (callback: (id: string) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, id: string): void => callback(id)
    ipcRenderer.on('webremote:remove', handler)
    return () => ipcRenderer.removeListener('webremote:remove', handler)
  },

  onWebRemoteQueueSermon: (
    callback: (data: { quote: Quote; contributor?: RemoteContributor }) => void
  ): (() => void) => {
    const handler = (
      _evt: IpcRendererEvent,
      data: { quote: Quote; contributor?: RemoteContributor }
    ): void => callback(data)
    ipcRenderer.on('webremote:queue-sermon', handler)
    return () => ipcRenderer.removeListener('webremote:queue-sermon', handler)
  },
  onWebRemoteProjectSermon: (
    callback: (data: { quote: Quote; query: string; slideIndex?: number }) => void
  ): (() => void) => {
    const handler = (
      _evt: IpcRendererEvent,
      data: { quote: Quote; query: string; slideIndex?: number }
    ): void => callback(data)
    ipcRenderer.on('webremote:project-sermon', handler)
    return () => ipcRenderer.removeListener('webremote:project-sermon', handler)
  },
  onWebRemoteQueueBible: (
    callback: (data: { reference: string; translation: string; contributor?: RemoteContributor }) => void
  ): (() => void) => {
    const handler = (
      _evt: IpcRendererEvent,
      data: { reference: string; translation: string; contributor?: RemoteContributor }
    ): void => callback(data)
    ipcRenderer.on('webremote:queue-bible', handler)
    return () => ipcRenderer.removeListener('webremote:queue-bible', handler)
  },
  onWebRemoteProjectBible: (
    callback: (data: { reference: string; translation: string }) => void
  ): (() => void) => {
    const handler = (
      _evt: IpcRendererEvent,
      data: { reference: string; translation: string }
    ): void => callback(data)
    ipcRenderer.on('webremote:project-bible', handler)
    return () => ipcRenderer.removeListener('webremote:project-bible', handler)
  },
  onWebRemoteQueueSong: (
    callback: (data: { songId: number; contributor?: RemoteContributor }) => void
  ): (() => void) => {
    const handler = (
      _evt: IpcRendererEvent,
      data: { songId: number; contributor?: RemoteContributor }
    ): void => callback(data)
    ipcRenderer.on('webremote:queue-song', handler)
    return () => ipcRenderer.removeListener('webremote:queue-song', handler)
  },
  onWebRemoteProjectSong: (callback: (songId: number, slide: number) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, data: { songId: number; slide: number }): void =>
      callback(data.songId, data.slide)
    ipcRenderer.on('webremote:project-song', handler)
    return () => ipcRenderer.removeListener('webremote:project-song', handler)
  },
  onWebRemoteNewService: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('webremote:new-service', handler)
    return () => ipcRenderer.removeListener('webremote:new-service', handler)
  },
  onWebRemoteSaveQueue: (callback: (name: string) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, name: string): void => callback(name)
    ipcRenderer.on('webremote:save-queue', handler)
    return () => ipcRenderer.removeListener('webremote:save-queue', handler)
  },
  onWebRemoteOpenService: (callback: (items: unknown[]) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, items: unknown[]): void => callback(items)
    ipcRenderer.on('webremote:open-service', handler)
    return () => ipcRenderer.removeListener('webremote:open-service', handler)
  },
  onWebRemoteImportService: (
    callback: (data: { items: unknown[]; label: string }) => void
  ): (() => void) => {
    const handler = (_evt: IpcRendererEvent, data: { items: unknown[]; label: string }): void =>
      callback(data)
    ipcRenderer.on('webremote:import-service', handler)
    return () => ipcRenderer.removeListener('webremote:import-service', handler)
  },
  onWebRemoteQueueBatch: (
    callback: (data: {
      items: unknown[]
      contributor: { deviceId: string; label: string }
    }) => void
  ): (() => void) => {
    const handler = (
      _evt: IpcRendererEvent,
      data: { items: unknown[]; contributor: { deviceId: string; label: string } }
    ): void => callback(data)
    ipcRenderer.on('webremote:queue-batch', handler)
    return () => ipcRenderer.removeListener('webremote:queue-batch', handler)
  },
  saveServiceNamed: (name: string, items: unknown): Promise<boolean> =>
    ipcRenderer.invoke('service:save-named', name, items),
  noteSongUsed: (id: number): void => ipcRenderer.send('songs:note-used', id),
  noteSermonUsed: (quote: Quote): void => ipcRenderer.send('sermons:note-used', quote),
  getRecentSermons: (): Promise<Quote[]> => ipcRenderer.invoke('sermons:recent'),
  clearRecentSermons: (): Promise<void> => ipcRenderer.invoke('sermons:clear-recent'),
  getOnThisDay: (): Promise<unknown[]> => ipcRenderer.invoke('browse:on-this-day'),

  // Browse
  getBrowseSeries: (): Promise<unknown[]> => ipcRenderer.invoke('browse:series'),
  getBrowseStates: (): Promise<unknown[]> => ipcRenderer.invoke('browse:states'),
  getBrowseCities: (): Promise<unknown[]> => ipcRenderer.invoke('browse:cities'),
  getBrowseDateGroups: (): Promise<unknown[]> => ipcRenderer.invoke('browse:date-groups'),
  getBrowseDateTree: (): Promise<unknown> => ipcRenderer.invoke('browse:date-tree'),
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
  searchBible: (
    query: string,
    translation: string,
    mode?: 'phrase' | 'all' | 'any',
    range?: { bookFrom: number; bookTo: number }
  ): Promise<unknown[]> => ipcRenderer.invoke('bible:search', query, translation, mode, range),
  getAdjacentVerse: (
    translation: string,
    bookNum: number,
    chapter: number,
    verse: number,
    direction: 'next' | 'prev'
  ): Promise<unknown> =>
    ipcRenderer.invoke('bible:adjacent-verse', translation, bookNum, chapter, verse, direction),
  noteBibleUsed: (reference: string, translation: string): void =>
    ipcRenderer.send('bible:note-used', reference, translation),
  getRecentBibleRefs: (): Promise<Array<{ reference: string; translation: string }>> =>
    ipcRenderer.invoke('bible:recent'),
  clearRecentBibleRefs: (): Promise<void> => ipcRenderer.invoke('bible:clear-recent'),

  // Songs
  searchSongs: (query: string, songbookId?: string): Promise<unknown[]> =>
    ipcRenderer.invoke('songs:search', query, songbookId),
  getSong: (id: number): Promise<unknown> => ipcRenderer.invoke('songs:get', id),
  importSongs: (songbookId?: string): Promise<unknown> => ipcRenderer.invoke('songs:import', songbookId),
  parsePastedText: (text: string, titleHint?: string): Promise<unknown> =>
    ipcRenderer.invoke('songs:parse-pasted-text', text, titleHint),
  commitReviewedSong: (song: unknown, originPath?: string, songbookId?: string): Promise<unknown> =>
    ipcRenderer.invoke('songs:commit-reviewed', song, originPath, songbookId),
  deleteSong: (id: number): Promise<boolean> => ipcRenderer.invoke('songs:delete', id),
  getRecentSongs: (): Promise<unknown[]> => ipcRenderer.invoke('songs:recent'),
  clearRecentSongs: (): Promise<void> => ipcRenderer.invoke('songs:clear-recent'),
  updateSongKey: (id: number, key: string | null): Promise<boolean> =>
    ipcRenderer.invoke('songs:update-key', id, key),
  getRecentKeys: (): Promise<string[]> => ipcRenderer.invoke('songs:recent-keys'),
  onlineSongSearch: (query: string): Promise<unknown[]> => ipcRenderer.invoke('songs:online-search', query),
  onlineSongPreview: (url: string, source: 'hymnary' | 'cyberhymnal'): Promise<unknown> =>
    ipcRenderer.invoke('songs:online-preview', url, source),
  onlineSongImport: (
    url: string,
    source: 'hymnary' | 'cyberhymnal',
    edited: unknown,
    songbookId?: string
  ): Promise<unknown> => ipcRenderer.invoke('songs:online-import', url, source, edited, songbookId),

  // Songbooks
  listSongbooks: (): Promise<Songbook[]> => ipcRenderer.invoke('songbooks:list'),
  addSongbook: (label: string): Promise<Songbook[]> => ipcRenderer.invoke('songbooks:add', label),
  removeSongbook: (id: string): Promise<Songbook[]> => ipcRenderer.invoke('songbooks:remove', id),

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
