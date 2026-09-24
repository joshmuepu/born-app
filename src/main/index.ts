import { app, BrowserWindow, ipcMain, screen, dialog, nativeTheme } from 'electron'
import { basename, join } from 'path'
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs'
import { log } from './logger'
import { getDb, closeDb } from './db'
import { closeLibraryDb } from './libraryDb'
import {
  getBibleTranslations,
  lookupPassage,
  searchBible,
  getAdjacentVerse,
  NO_PRACTICAL_LIMIT as BIBLE_SEARCH_LIMIT,
  type BibleSearchMode,
  type BibleSearchRange
} from './bible'
import {
  searchSongs,
  getSong,
  importSongs,
  deleteSong,
  updateSongKey,
  hymnarySearch,
  hymnaryPreview,
  hymnaryImport
} from './songs'
import { startIndexer, stopIndexer, getIndexerStatus } from './indexer'
import {
  startWebRemote,
  updateWebRemoteState,
  getLocalIP,
  isWebRemoteAvailable,
  getWebRemoteTranslation,
  REMOTE_PORT
} from './webRemote'
import { startMdns, stopMdns, getMdnsHostname } from './mdns'
import { BIBLE_BOOKS, bookByNum } from '../shared/bibleBooks'
import { highlightToHtml } from '../shared/searchHighlight'
import { MAX_REMOTE_RESULTS } from '../shared/searchLimits'
import { quoteToItem, type Quote } from '../shared/queueItem'
import {
  buildSearchSQL,
  buildPhraseQuery,
  buildTokenQuery,
  buildAnyWordQuery,
  rowToQuote,
  stableParagraphRef,
  NO_PRACTICAL_LIMIT as SERMON_SEARCH_LIMIT,
  type SearchFilters,
  type QuoteRow
} from './search'
import {
  pickProjectionDisplay,
  pickStageDisplay,
  describeDisplay,
  type DisplayLike
} from './displays'
import {
  checkForUpdate,
  getCachedUpdate,
  openReleasePage,
  downloadUpdate,
  runInstaller,
  applyUpdate
} from './updateCheck'
import {
  getLocalDateGroups,
  getLocalDateTree,
  getLocalDurationGroups,
  getLocalLocationTree,
  getOnThisDay
} from './browseLocal'
import { getSettings, updateSettings } from './settings'
import {
  serverSearch,
  fetchAutocompleteSuggestions,
  fetchHitsCountPreview,
  fetchAllSeries,
  fetchAllStates,
  fetchAllCities,
  fetchAllDateGroups,
  fetchAllDurationGroups,
  fetchSermonContent,
  fetchSubtitles,
  fetchLanguages
} from './tableApi'

/**
 * Single-instance lock — must run before anything else touches `app`. Without
 * this, launching BORN a second time (or a first instance left running with
 * its windows closed, forgotten about) starts a fully separate process. Both
 * copies work fine for local search/project, but only one can ever bind the
 * web remote's port — the second's remote silently fails, and nothing in the
 * UI says so (see RemotePanel.tsx). A real outage traced to exactly this: the
 * operator had no way to know a stale background copy was still holding the
 * port, and rebooting the computer was the only thing that occurred to them.
 * This closes the whole class of bug: a second launch attempt just quits
 * itself and brings the existing window forward instead.
 */
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let projectionWindow: BrowserWindow | null = null
let stageWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development'

// ── Projection state (replayed to the projection window when it (re)connects) ──

/** One slide on the projector: quote text, a Bible verse, or a song section. */
export interface SlidePayload {
  kind: 'quote' | 'bible' | 'song'
  text: string
  label?: string
  reference?: string
  marker?: string
}

interface ProjectionState {
  slide: SlidePayload | null
  blank: boolean
  fontSize: number
}
let projectionState: ProjectionState = {
  slide: null,
  blank: false,
  fontSize: getSettingsSafe().fontSize
}
let projectionReady = false

interface StageState {
  current: SlidePayload | null
  next: SlidePayload | null
}
let stageState: StageState = { current: null, next: null }
let stageReady = false

function getSettingsSafe(): {
  fontSize: number
  projectionDisplayId: number | null
  stageDisplayId: number | null
  recentServices: string[]
  theme: 'dark' | 'light'
  recentSongIds: number[]
  recentQuotes: Array<{
    sermonId: number
    sermonTitle: string
    dateCode: string
    paragraphIndex: number
    paragraphRef: string
    text: string
  }>
  recentBibleRefs: Array<{ reference: string; translation: string }>
  recentKeys: string[]
} {
  try {
    return getSettings()
  } catch {
    return {
      fontSize: 4.5,
      projectionDisplayId: null,
      stageDisplayId: null,
      recentServices: [],
      theme: 'dark',
      recentSongIds: [],
      recentQuotes: [],
      recentBibleRefs: [],
      recentKeys: []
    }
  }
}

/** The control window's background, matched to the saved theme so a cold start
 *  paints the right colour before the renderer's CSS loads. */
function themeBackground(): string {
  return getSettingsSafe().theme === 'light' ? '#ffffff' : '#0d1117'
}

function sendToMain(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args)
}
function sendToProjection(channel: string, ...args: unknown[]): void {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.webContents.send(channel, ...args)
  }
}
function sendToStage(channel: string, ...args: unknown[]): void {
  if (stageWindow && !stageWindow.isDestroyed()) stageWindow.webContents.send(channel, ...args)
}

// ── Windows ───────────────────────────────────────────────────────────────────

function createMainWindow(): void {
  log.info('createMainWindow')
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1040,
    minHeight: 640,
    title: 'BORN — Branham or Nothing',
    backgroundColor: themeBackground(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    log.info('mainWindow did-finish-load')
    broadcastDisplayInfo()
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log.error('mainWindow renderer process gone', details)
  })

  mainWindow.webContents.on('unresponsive', () => {
    log.warn('mainWindow renderer unresponsive')
  })

  // Esc from the operator window is handled in the renderer (App.tsx) so it can
  // respect focus / typing state; nothing to relay here.

  mainWindow.on('closed', () => {
    log.info('mainWindow closed')
    mainWindow = null
  })
}

function createProjectionWindow(): void {
  log.info('createProjectionWindow')
  projectionReady = false

  const target = resolveProjectionTarget()
  const area = target.display.workArea ?? target.display.bounds
  log.info(
    `projection target: ${describeDisplay(target.display, screen.getPrimaryDisplay().id)} ` +
      `fallback=${target.isFallback} override=${target.isOverride}`
  )
  if (target.isFallback) log.warn('projection: no external display — using operator screen')

  const onMac = process.platform === 'darwin'
  projectionWindow = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    backgroundColor: '#000000',
    title: 'BORN — Output',
    show: false,
    fullscreen: !onMac,
    simpleFullscreen: onMac,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  if (onMac) projectionWindow.setSimpleFullScreen(true)
  projectionWindow.once('ready-to-show', () => projectionWindow?.show())

  projectionWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault()
      setProjectionBlank(!projectionState.blank) // Esc toggles the blackout
    }
  })

  projectionWindow.webContents.on('render-process-gone', (_e, details) => {
    log.error('projectionWindow renderer process gone', details)
  })

  projectionWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    log.error(`projectionWindow did-fail-load ${code} ${desc}`)
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    projectionWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/projection.html`)
  } else {
    projectionWindow.loadFile(join(__dirname, '../renderer/projection.html'))
  }

  projectionWindow.on('closed', () => {
    log.info('projectionWindow closed')
    projectionWindow = null
    projectionReady = false
    projectionState = { slide: null, blank: false, fontSize: projectionState.fontSize }
    // Nothing is being projected any more — the stage monitor falls back to the
    // clock rather than freezing on the last slide.
    stageState = { current: null, next: null }
    sendToStage('stage:update', stageState)
    sendToStage('stage:set-blank', false)
    sendToMain('projection:closed')
  })
}

function createStageWindow(): void {
  log.info('createStageWindow')
  stageReady = false

  const target = resolveStageTarget()
  const onMac = process.platform === 'darwin'
  log.info(
    `stage target: ${
      target.display
        ? describeDisplay(target.display, screen.getPrimaryDisplay().id)
        : 'windowed (no spare screen)'
    } fallback=${target.isFallback} override=${target.isOverride}`
  )

  if (target.display) {
    const area = target.display.workArea ?? target.display.bounds
    stageWindow = new BrowserWindow({
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      title: 'BORN — Stage View',
      backgroundColor: '#0a0a0a',
      show: false,
      fullscreen: !onMac,
      simpleFullscreen: onMac,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: false
      }
    })
    if (onMac) stageWindow.setSimpleFullScreen(true)
    stageWindow.once('ready-to-show', () => stageWindow?.show())
  } else {
    // No spare screen: a floating monitor that stays above the operator window
    // so it can't get lost behind it during a service.
    stageWindow = new BrowserWindow({
      width: 900,
      height: 600,
      minWidth: 520,
      minHeight: 360,
      title: 'BORN — Stage View',
      backgroundColor: '#0a0a0a',
      alwaysOnTop: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: false
      }
    })
  }

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    stageWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/stage.html`)
  } else {
    stageWindow.loadFile(join(__dirname, '../renderer/stage.html'))
  }

  stageWindow.on('closed', () => {
    log.info('stageWindow closed')
    stageWindow = null
    stageReady = false
    sendToMain('stage:closed')
  })
}

// ── Display detection ─────────────────────────────────────────────────────────

function toDisplayLike(d: Electron.Display): DisplayLike {
  return { id: d.id, label: d.label, internal: d.internal, bounds: d.bounds, workArea: d.workArea }
}

function resolveProjectionTarget() {
  const displays = screen.getAllDisplays().map(toDisplayLike)
  const primary = screen.getPrimaryDisplay()
  const overrideId = getSettingsSafe().projectionDisplayId
  return pickProjectionDisplay(displays, primary.id, overrideId)
}

function resolveStageTarget() {
  const displays = screen.getAllDisplays().map(toDisplayLike)
  const primary = screen.getPrimaryDisplay()
  const projectionId = resolveProjectionTarget().display.id
  const overrideId = getSettingsSafe().stageDisplayId
  return pickStageDisplay(displays, primary.id, projectionId, overrideId)
}

function displayInfoPayload() {
  const primary = screen.getPrimaryDisplay()
  const displays = screen.getAllDisplays()
  const target = resolveProjectionTarget()
  const stage = resolveStageTarget()
  return {
    displays: displays.map((d) => ({
      id: d.id,
      label: describeDisplay(toDisplayLike(d), primary.id),
      isPrimary: d.id === primary.id,
      isInternal: !!d.internal
    })),
    targetId: target.display.id,
    isFallback: target.isFallback,
    isOverride: target.isOverride,
    hasExternal: displays.length > 1,
    // Stage monitor
    stageTargetId: stage.display?.id ?? null,
    stageIsWindowed: stage.display === null,
    stageIsOverride: stage.isOverride,
    /** true when the stage would share a screen with the main projection. */
    stageClashesProjection: stage.display != null && stage.display.id === target.display.id
  }
}

function broadcastDisplayInfo(): void {
  const payload = displayInfoPayload()
  // Full raw dump — if a connected screen ever fails to show up in the
  // picker, this is the first thing to check: does the OS/Electron even
  // report it here? If not, it's not something this app's code controls.
  log.info(
    `displays: ${payload.displays.length} detected — ` +
      payload.displays.map((d) => `#${d.id} ${d.label}`).join(' | ')
  )
  sendToMain('displays:info', payload)
  sendToProjection('projection:display-info', payload)
}

// Toggling fullscreen + setBounds itself emits `display-metrics-changed`, so a
// naive "reposition on every display event" loops forever and the projection
// visibly shakes. Guard: skip when the window is already full-screen on the
// right display, and ignore the events our own move produces.
let repositioning = false

/** Re-place the projection window on the correct display after a hotplug. */
function repositionProjectionWindow(force = false): void {
  if (!projectionWindow || projectionWindow.isDestroyed()) return
  const onMac = process.platform === 'darwin'
  const target = resolveProjectionTarget()
  const area = target.display.workArea ?? target.display.bounds

  const winDisplay = screen.getDisplayMatching(projectionWindow.getBounds())
  const isFs = onMac ? projectionWindow.isSimpleFullScreen() : projectionWindow.isFullScreen()
  if (!force && winDisplay.id === target.display.id && isFs) return // already correct — leave it alone

  log.info(
    `repositioning projection → ${describeDisplay(target.display, screen.getPrimaryDisplay().id)}`
  )
  repositioning = true
  try {
    if (onMac) projectionWindow.setSimpleFullScreen(false)
    else projectionWindow.setFullScreen(false)
    projectionWindow.setBounds({ x: area.x, y: area.y, width: area.width, height: area.height })
    if (onMac) projectionWindow.setSimpleFullScreen(true)
    else projectionWindow.setFullScreen(true)
  } catch (e) {
    log.error('repositionProjectionWindow failed', e)
  }
  setTimeout(() => {
    repositioning = false
  }, 700)
}

/** Re-place the stage window on its chosen display (or back to a normal window
 *  when there's no spare screen). Shares the `repositioning` guard so the
 *  fullscreen toggle doesn't feed the display-metrics loop. */
function repositionStageWindow(force = false): void {
  if (!stageWindow || stageWindow.isDestroyed()) return
  const onMac = process.platform === 'darwin'
  const target = resolveStageTarget()
  const isFs = onMac ? stageWindow.isSimpleFullScreen() : stageWindow.isFullScreen()

  if (target.display) {
    const area = target.display.workArea ?? target.display.bounds
    const winDisplay = screen.getDisplayMatching(stageWindow.getBounds())
    if (!force && isFs && winDisplay.id === target.display.id) return
    log.info(
      `repositioning stage → ${describeDisplay(target.display, screen.getPrimaryDisplay().id)}`
    )
    repositioning = true
    try {
      stageWindow.setAlwaysOnTop(false)
      if (onMac) stageWindow.setSimpleFullScreen(false)
      else stageWindow.setFullScreen(false)
      stageWindow.setBounds({ x: area.x, y: area.y, width: area.width, height: area.height })
      if (onMac) stageWindow.setSimpleFullScreen(true)
      else stageWindow.setFullScreen(true)
    } catch (e) {
      log.error('repositionStageWindow failed', e)
    }
    setTimeout(() => {
      repositioning = false
    }, 700)
  } else if (isFs || force) {
    // No spare screen any more — drop back to a normal window.
    log.info('stage → windowed (no spare screen)')
    repositioning = true
    try {
      if (onMac) stageWindow.setSimpleFullScreen(false)
      else stageWindow.setFullScreen(false)
      stageWindow.setBounds({ width: 900, height: 600 })
      stageWindow.center()
      stageWindow.setAlwaysOnTop(true)
    } catch (e) {
      log.error('repositionStageWindow (windowed) failed', e)
    }
    setTimeout(() => {
      repositioning = false
    }, 700)
  }
}

let displayChangeTimer: ReturnType<typeof setTimeout> | null = null
function onDisplayLayoutChanged(reason: string): void {
  if (repositioning) return // don't react to the metrics-changed events our own move fires
  log.info(`display layout changed: ${reason}`)
  if (displayChangeTimer) clearTimeout(displayChangeTimer)
  displayChangeTimer = setTimeout(() => {
    displayChangeTimer = null
    repositionProjectionWindow()
    repositionStageWindow()
    broadcastDisplayInfo()
  }, 400)
}

// ── Projection control helpers ────────────────────────────────────────────────

function setProjectionBlank(blank: boolean): void {
  projectionState.blank = blank
  sendToProjection('projection:set-blank', blank)
  // The stage monitor's "Congregation" view mirrors the projector, blackout included.
  sendToStage('stage:set-blank', blank)
  // Keep the operator console's blank state in sync (e.g. when the command came
  // from the projection window's Esc key or the phone web remote).
  sendToMain('operator:blank-changed', blank)
}

// ── Projection IPC ────────────────────────────────────────────────────────────

ipcMain.handle('projection:open', () => {
  log.info('ipc projection:open')
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.focus()
    return
  }
  return new Promise<void>((resolve) => {
    let settled = false
    const done = (): void => {
      if (settled) return
      settled = true
      resolve()
    }
    createProjectionWindow()
    // Resolve as soon as the renderer signals it is listening, or after a
    // safety timeout so the operator UI is never stuck awaiting.
    const readyHandler = (): void => done()
    ipcMain.once('projection:ready', readyHandler)
    setTimeout(() => {
      ipcMain.removeListener('projection:ready', readyHandler)
      done()
    }, 4000)
  })
})

ipcMain.on('projection:ready', () => {
  log.info('ipc projection:ready — replaying state')
  projectionReady = true
  broadcastDisplayInfo()
  if (projectionState.slide) sendToProjection('projection:show-slide', projectionState.slide)
  sendToProjection('projection:set-font-size', projectionState.fontSize)
  sendToProjection('projection:set-blank', projectionState.blank)
})

ipcMain.handle('projection:close', () => {
  log.info('ipc projection:close')
  if (projectionWindow && !projectionWindow.isDestroyed()) projectionWindow.close()
})

ipcMain.on('projection:show-slide', (_event, slide: SlidePayload) => {
  projectionState = { ...projectionState, slide, blank: false }
  sendToProjection('projection:show-slide', slide)
  // A fresh slide always un-blanks — keep the stage screen in step so it doesn't
  // stay stuck on the clock after an Esc blackout.
  sendToStage('stage:set-blank', false)
})

ipcMain.on('projection:clear', () => {
  projectionState = { ...projectionState, slide: null, blank: false }
  sendToProjection('projection:clear')
  stageState = { current: null, next: null }
  sendToStage('stage:update', stageState)
  sendToStage('stage:set-blank', false)
})

ipcMain.on(
  'projection:alert',
  (_event, payload: string | { message: string; target?: 'congregation' | 'stage' | 'both' }) => {
    const message = typeof payload === 'string' ? payload : payload.message
    const target = typeof payload === 'string' ? 'congregation' : payload.target ?? 'congregation'
    if (!message?.trim()) return
    if (target === 'congregation' || target === 'both') sendToProjection('projection:alert', message)
    if (target === 'stage' || target === 'both') sendToStage('stage:alert', message)
  }
)

ipcMain.on('projection:set-blank', (_event, blank: boolean) => {
  setProjectionBlank(blank)
})

ipcMain.on('projection:set-font-size', (_event, size: number) => {
  projectionState.fontSize = size
  try {
    updateSettings({ fontSize: size })
  } catch (e) {
    log.error('persist fontSize failed', e)
  }
  sendToProjection('projection:set-font-size', size)
})

/** The persisted projection text size, so the operator console's Text control
 *  shows the real value (not a hard-coded 100%). */
ipcMain.handle('projection:get-font-size', () => projectionState.fontSize)

// ── Theme (control window only) ───────────────────────────────────────────────

ipcMain.handle('theme:get', () => getSettingsSafe().theme)

ipcMain.handle('theme:set', (_event, theme: 'dark' | 'light') => {
  const next = theme === 'light' ? 'light' : 'dark'
  try {
    updateSettings({ theme: next })
  } catch (e) {
    log.error('persist theme failed', e)
  }
  nativeTheme.themeSource = next
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(next === 'light' ? '#ffffff' : '#0d1117')
  }
  sendToMain('theme:changed', next)
  return next
})

// ── App / update IPC ──────────────────────────────────────────────────────────

ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:check-update', () => checkForUpdate())
ipcMain.handle('app:update-info', () => getCachedUpdate())
ipcMain.handle('app:open-release-page', () => openReleasePage())
ipcMain.handle('app:download-update', (e) =>
  downloadUpdate(BrowserWindow.fromWebContents(e.sender))
)
ipcMain.handle('app:run-installer', (_e, filePath: string) => runInstaller(filePath))
ipcMain.handle('app:apply-update', (_e, filePath: string) => applyUpdate(filePath))
ipcMain.handle('app:quit', () => app.quit())

// ── Display IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('displays:list', () => displayInfoPayload())

ipcMain.handle('projection:set-display', (_event, displayId: number | null) => {
  log.info(`ipc projection:set-display ${displayId}`)
  try {
    updateSettings({ projectionDisplayId: displayId })
  } catch (e) {
    log.error('persist projectionDisplayId failed', e)
  }
  repositionProjectionWindow(true)
  repositionStageWindow() // the stage auto-pick depends on where the projection is
  broadcastDisplayInfo()
  return displayInfoPayload()
})

ipcMain.handle('stage:set-display', (_event, displayId: number | null) => {
  log.info(`ipc stage:set-display ${displayId}`)
  try {
    updateSettings({ stageDisplayId: displayId })
  } catch (e) {
    log.error('persist stageDisplayId failed', e)
  }
  repositionStageWindow(true)
  broadcastDisplayInfo()
  return displayInfoPayload()
})

// ── Search IPC ────────────────────────────────────────────────────────────────

/** The one place sermon search actually runs — used by the desktop app's IPC
 *  handler and the web remote alike, so results never drift between them. */
async function searchSermons(rawQuery: string, filters: SearchFilters = {}) {
  const query = (rawQuery ?? '').trim()
  if (!query) return []
  const matchMode = filters.matchMode ?? 'phrase'
  log.debug(`search:query "${query}"`, filters)

  try {
    const db = getDb()

    const localCount = db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM sermons').get()?.n ?? 0
    log.debug(`search:query localCount=${localCount}`)

    if (localCount < 100) {
      log.info(`search:query falling back to server search (localCount=${localCount})`)
      const searchType = matchMode === 'phrase' ? 'ExactPhrase' : 'AllWords'
      const serverResults = await serverSearch(query, searchType)
      if (serverResults.length === 0 && matchMode === 'phrase') {
        return serverSearch(query, 'AllWords')
      }
      return serverResults
    }

    const { sql, extraParams } = buildSearchSQL(filters)

    if (matchMode === 'phrase') {
      try {
        const rows = db
          .prepare(sql)
          .all(buildPhraseQuery(query), ...extraParams, SERMON_SEARCH_LIMIT) as QuoteRow[]
        if (rows.length > 0) {
          log.debug(`search:query phrase match: ${rows.length} results`)
          return rows.map((r) => rowToQuote(r, 'phrase'))
        }
      } catch (e) {
        log.warn('search:query phrase match FTS error', e)
      }
      // No exact phrase hit — fall back to requiring all the words instead
      // of returning nothing.
      try {
        const tokenQuery = buildTokenQuery(query)
        if (!tokenQuery) return []
        const rows = db.prepare(sql).all(tokenQuery, ...extraParams, SERMON_SEARCH_LIMIT) as QuoteRow[]
        log.debug(`search:query phrase-fallback all-words match: ${rows.length} results`)
        return rows.map((r) => rowToQuote(r, 'all'))
      } catch (e) {
        log.error('search:query token match error', e)
        return []
      }
    }

    try {
      const tokenQuery = matchMode === 'any' ? buildAnyWordQuery(query) : buildTokenQuery(query)
      if (!tokenQuery) return []
      const rows = db.prepare(sql).all(tokenQuery, ...extraParams, SERMON_SEARCH_LIMIT) as QuoteRow[]
      log.debug(`search:query ${matchMode} match: ${rows.length} results`)
      return rows.map((r) => rowToQuote(r, matchMode))
    } catch (e) {
      log.error('search:query token match error', e)
      return []
    }
  } catch (e) {
    log.error('search:query fatal error', e)
    return []
  }
}

ipcMain.handle('search:query', (_event, rawQuery: string, filters: SearchFilters = {}) =>
  searchSermons(rawQuery, filters)
)

/** Called whenever a sermon quote is queued or projected, from the desktop
 *  app or the web remote alike — feeds "Recently Played" on both. */
ipcMain.on(
  'sermons:note-used',
  (
    _event,
    quote: { sermonId: number; sermonTitle: string; dateCode: string; paragraphIndex: number; paragraphRef: string; text: string }
  ) => {
    try {
      const prev = getSettingsSafe().recentQuotes ?? []
      const next = [
        quote,
        ...prev.filter((q) => !(q.sermonId === quote.sermonId && q.paragraphRef === quote.paragraphRef))
      ].slice(0, 8)
      updateSettings({ recentQuotes: next })
    } catch (e) {
      log.error('sermons:note-used failed', e)
    }
  }
)

ipcMain.handle('sermons:recent', () => getSettingsSafe().recentQuotes ?? [])
ipcMain.handle('sermons:clear-recent', () => updateSettings({ recentQuotes: [] }))

/** Sermons preached on today's calendar date, any year — backs the Browse
 *  hub's "On This Day" card and the search empty state's same pull. */
ipcMain.handle('browse:on-this-day', () => {
  try {
    const now = new Date()
    return getOnThisDay(getDb(), now.getMonth() + 1, now.getDate())
  } catch (e) {
    log.error('browse:on-this-day error', e)
    return []
  }
})

/** The remote's sermon search: same searchSermons the desktop uses (plus the
 *  optional date-code filter it doesn't expose), with the matched term
 *  wrapped in <mark> server-side so the remote never re-implements — and
 *  can't drift from — the app's own highlighting rules. Also ships the same
 *  one-paragraph-per-slide split quoteToItem() computes for every other
 *  surface — a source row can legitimately span several numbered
 *  paragraphs ("156-157"), and without this the remote's preview had no
 *  slide list to show at all, just that whole span as one undivided block,
 *  even though projecting it already correctly split by paragraph. */
async function searchSermonsForRemote(query: string, dateCode?: string): Promise<unknown[]> {
  const rows = (await searchSermons(query, dateCode ? { dateCode } : {})) as Quote[]
  // The desktop's own cap (MAX_SEARCH_RESULTS, 25000) is sized for a virtual
  // scrolled desktop list — sent to a phone browser as-is, a common-word
  // search built a ~75MB DOM and put the whole remote session at risk.
  // Cut down hard before it ever reaches the wire.
  return rows.slice(0, MAX_REMOTE_RESULTS).map((r) => ({
    ...r,
    highlightedText: highlightToHtml(r.text, query, r.matchType ?? 'all'),
    slides: quoteToItem(r).slides
  }))
}

/** The web remote's one Bible search box, unlike the desktop app's separate
 *  Reference/Keyword modes — tries it as a reference first (reusing the exact
 *  same lookupPassage the app itself uses), then falls back to a phrase
 *  search, then an "any word" search, same fallback order SearchBar already
 *  uses for sermons. */
/** 'all' | 'ot' | 'nt' | a book number, as a string over the wire. */
function rangeForRemoteScope(scope?: string): BibleSearchRange | undefined {
  if (!scope || scope === 'all') return undefined
  if (scope === 'ot') return { bookFrom: 1, bookTo: 39 }
  if (scope === 'nt') return { bookFrom: 40, bookTo: 66 }
  const n = Number(scope)
  return Number.isFinite(n) && n > 0 ? { bookFrom: n, bookTo: n } : undefined
}

async function searchBibleForRemote(query: string, scope?: string): Promise<unknown> {
  const q = (query ?? '').trim()
  if (!q) return { kind: 'hits', hits: [] }
  const translation = getWebRemoteTranslation()
  const range = rangeForRemoteScope(scope)

  // A reference always means exactly that reference, regardless of scope —
  // scope only narrows a keyword search.
  const passage = lookupPassage(q, translation)
  if (!('error' in passage)) return { kind: 'passage', passage }

  const phraseHits = searchBible(q, translation, BIBLE_SEARCH_LIMIT, 'phrase', range)
  if (phraseHits.length > 0) return { kind: 'hits', hits: phraseHits.slice(0, MAX_REMOTE_RESULTS) }

  const anyHits = searchBible(q, translation, BIBLE_SEARCH_LIMIT, 'any', range)
  if (anyHits.length > 0) return { kind: 'hits', hits: anyHits.slice(0, MAX_REMOTE_RESULTS) }

  return { kind: 'error', message: `No matches for "${q}".` }
}

/** Book grid for the remote's Bible tab — the same 66-book list the desktop
 *  Books drawer uses, so abbreviations and chapter counts never disagree. */
function bibleBooksForRemote(): unknown {
  return BIBLE_BOOKS
}

/** One chapter's verses, for the remote's tap-a-book → tap-a-chapter drill.
 *  Always the desktop's current translation — the remote has no picker of
 *  its own, so it never shows different wording than what's on screen. */
async function bibleChapterForRemote(bookNum: number, chapter: number): Promise<unknown> {
  const translation = getWebRemoteTranslation()
  const book = bookByNum(bookNum)
  if (!book) return { error: 'Unknown book.' }
  return lookupPassage(`${book.name} ${chapter}`, translation)
}

// ── Queue navigation relay (projection window → main window) ──────────────────

ipcMain.on('queue:navigate', (_event, dir: 'prev' | 'next') => {
  sendToMain('queue:navigate', dir)
})

// ── Queue persistence ─────────────────────────────────────────────────────────

ipcMain.handle('queue:load', () => {
  try {
    const queuePath = join(app.getPath('userData'), 'queue.json')
    return JSON.parse(readFileSync(queuePath, 'utf-8'))
  } catch {
    return []
  }
})

ipcMain.on('queue:save', (_event, items: unknown) => {
  try {
    const queuePath = join(app.getPath('userData'), 'queue.json')
    writeFileSync(queuePath, JSON.stringify(items))
  } catch (e) {
    log.error('queue:save error', e)
  }
})

// ── Stage View IPC ────────────────────────────────────────────────────────────

ipcMain.handle('stage:open', () => {
  log.info('ipc stage:open')
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.focus()
    return
  }
  return new Promise<void>((resolve) => {
    let settled = false
    const done = (): void => {
      if (settled) return
      settled = true
      resolve()
    }
    createStageWindow()
    const readyHandler = (): void => done()
    ipcMain.once('stage:ready', readyHandler)
    setTimeout(() => {
      ipcMain.removeListener('stage:ready', readyHandler)
      done()
    }, 4000)
  })
})

ipcMain.on('stage:ready', () => {
  stageReady = true
  sendToStage('stage:update', stageState)
  sendToStage('stage:set-blank', projectionState.blank)
  sendToStage('stage:display-info', displayInfoPayload())
})

ipcMain.handle('stage:close', () => {
  if (stageWindow && !stageWindow.isDestroyed()) stageWindow.close()
})

ipcMain.on('stage:update', (_event, data: StageState) => {
  stageState = data ?? { current: null, next: null }
  sendToStage('stage:update', stageState)
})

// ── Web Remote IPC ────────────────────────────────────────────────────────────

ipcMain.on('webremote:sync', (_event, state) => {
  updateWebRemoteState(state)
})

ipcMain.handle('webremote:ip', () => {
  if (!isWebRemoteAvailable()) {
    return { available: false, url: '', ipUrl: '', hostnameUrl: null }
  }
  const ipUrl = `http://${getLocalIP()}:${REMOTE_PORT}`
  const host = getMdnsHostname()
  const hostnameUrl = host ? `http://${host}:${REMOTE_PORT}` : null
  // Prefer the name — it survives a DHCP lease change; the IP is the fallback
  // shown only until (or unless) mDNS finishes probing.
  return { available: true, url: hostnameUrl ?? ipUrl, ipUrl, hostnameUrl }
})

// ── Service file IPC ──────────────────────────────────────────────────────────

/** Record a service file at the top of the recents list (deduped, capped). */
function rememberService(path: string): void {
  try {
    const prev = getSettingsSafe().recentServices ?? []
    const next = [path, ...prev.filter((p) => p !== path)].slice(0, 8)
    updateSettings({ recentServices: next })
  } catch (e) {
    log.error('rememberService failed', e)
  }
}

// BORN service files are plain JSON with a `.born` extension. Older files used
// `.bpservice`; the open dialog still accepts them.
ipcMain.handle('service:save', async (_event, items: unknown) => {
  log.info('ipc service:save')
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'BORN Service', extensions: ['born'] }],
    defaultPath: 'Sunday service.born'
  })
  if (result.canceled || !result.filePath) return false
  writeFileSync(result.filePath, JSON.stringify(items, null, 2))
  rememberService(result.filePath)
  return true
})

ipcMain.handle('service:open', async () => {
  log.info('ipc service:open')
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'BORN Service', extensions: ['born', 'bpservice'] }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths[0]) return null
  const path = result.filePaths[0]
  const data = JSON.parse(readFileSync(path, 'utf-8'))
  rememberService(path)
  return data
})

ipcMain.handle('service:recents', () => {
  const paths = getSettingsSafe().recentServices ?? []
  return paths
    .filter((p) => existsSync(p))
    .map((p) => ({
      path: p,
      name: basename(p).replace(/\.(born|bpservice)$/, ''),
      mtimeMs: statSync(p).mtimeMs
    }))
})

/** Shared by the `service:open-path` IPC handler and the web remote's
 *  "Open a saved service" — reads a service file straight off disk, no
 *  native dialog, so it works the same whether the desktop or a phone asked. */
function openServiceFile(path: string): unknown | null {
  try {
    if (!existsSync(path)) return null
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    rememberService(path)
    return data
  } catch (e) {
    log.error('openServiceFile failed', e)
    return null
  }
}

ipcMain.handle('service:open-path', (_event, path: string) => openServiceFile(path))

// Church WiFi's remote has no native file dialog to hand off to — a save
// initiated there writes straight to a fixed folder under a name the
// operator typed, and joins the exact same recents list the desktop's own
// Save (with its OS picker) already uses, so there's one unified history.
const REMOTE_SAVE_DIR = (): string => {
  const dir = join(app.getPath('userData'), 'saved-services')
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    /* already exists */
  }
  return dir
}

ipcMain.handle('service:save-named', (_event, name: string, items: unknown) => {
  const safeName = (name ?? '').trim().replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80) || 'Untitled service'
  const path = join(REMOTE_SAVE_DIR(), `${safeName}.born`)
  try {
    writeFileSync(path, JSON.stringify(items, null, 2))
    rememberService(path)
    return true
  } catch (e) {
    log.error('service:save-named failed', e)
    return false
  }
})

// ── Autocomplete IPC ──────────────────────────────────────────────────────────

ipcMain.handle('autocomplete:suggestions', async (_event, wordPart: string) => {
  try {
    return await fetchAutocompleteSuggestions(wordPart)
  } catch {
    return []
  }
})

ipcMain.handle(
  'autocomplete:count',
  async (_event, text: string, searchType: 'AllWords' | 'ExactPhrase') => {
    try {
      return await fetchHitsCountPreview(text, searchType)
    } catch {
      return 0
    }
  }
)

// ── Server search (fallback) ──────────────────────────────────────────────────

ipcMain.handle('search:server', (_event, text: string, searchType: 'AllWords' | 'ExactPhrase') => {
  return serverSearch(text, searchType)
})

// ── Browse IPC ────────────────────────────────────────────────────────────────

ipcMain.handle('browse:series', () => fetchAllSeries())
ipcMain.handle('browse:states', () => fetchAllStates())
ipcMain.handle('browse:cities', () => fetchAllCities())
ipcMain.handle('browse:date-groups', () => {
  try {
    const groups = getLocalDateGroups(getDb())
    if (groups.length > 0) return groups
  } catch (e) {
    log.warn('local date groups failed, falling back to online', e)
  }
  return fetchAllDateGroups()
})
ipcMain.handle('browse:date-tree', () => {
  try {
    return getLocalDateTree(getDb())
  } catch (e) {
    log.error('browse:date-tree error', e)
    return { years: [], undatedIds: [] }
  }
})
ipcMain.handle('browse:duration-groups', () => {
  try {
    const groups = getLocalDurationGroups(getDb())
    if (groups.length > 0) return groups
  } catch (e) {
    log.warn('local duration groups failed, falling back to online', e)
  }
  return fetchAllDurationGroups()
})
ipcMain.handle('browse:location', () => {
  try {
    return getLocalLocationTree(getDb())
  } catch (e) {
    log.error('browse:location error', e)
    return []
  }
})

function getSermonsByIdsFor(ids: number[]): unknown[] {
  log.debug(`browse:sermons-by-ids count=${ids?.length ?? 0}`)
  try {
    const db = getDb()
    if (!ids || ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(',')
    return db
      .prepare(
        `SELECT id, date_code, title, para_count, duration_min, is_book FROM sermon_index WHERE id IN (${placeholders}) ORDER BY date_code`
      )
      .all(...ids)
  } catch (e) {
    log.error('browse:sermons-by-ids error', e)
    return []
  }
}

ipcMain.handle('browse:sermons-by-ids', (_event, ids: number[]) => getSermonsByIdsFor(ids))

/** Every paragraph of one sermon, bundled-English first, translating and
 *  caching on demand — used by the desktop's own Browse/follow views and the
 *  remote's sermon detail view alike. */
async function getSermonParagraphsFor(sermonId: number, language: string): Promise<unknown[]> {
  log.debug(`browse:sermon-paragraphs sermonId=${sermonId} lang=${language}`)

  /** The bundled English paragraphs for this sermon — always available offline. */
  const englishLocal = (): Array<Record<string, unknown>> => {
    try {
      const db = getDb()
      const rows = db
        .prepare<
          [number],
          { id: number; paragraph_ref: string; text: string; date_code: string; title: string }
        >(
          `SELECT p.id, p.paragraph_ref, p.text, s.date_code, s.title
           FROM paragraphs p
           JOIN sermons s ON s.id = p.sermon_id
           WHERE p.sermon_id = ? ORDER BY p.paragraph_index, p.id`
        )
        .all(Number(sermonId))
      return rows.map((r, i) => ({
        text: r.text,
        sermonTitle: r.title,
        dateCode: r.date_code,
        sermonId: Number(sermonId),
        paragraphIndex: i,
        paragraphRef: stableParagraphRef(r.paragraph_ref, r.id),
        language: 'en'
      }))
    } catch (e) {
      log.error('englishLocal paragraphs error', e)
      return []
    }
  }

  try {
    const db = getDb()
    const lang = language || 'en'

    if (lang === 'en') {
      const rows = englishLocal()
      if (rows.length > 0) return rows
    } else {
      const cached = db
        .prepare<[number, string], { paragraph_ref: string; paragraph_index: number; text: string }>(
          `SELECT paragraph_ref, paragraph_index, text FROM translated_paragraphs
           WHERE sermon_id = ? AND language = ? ORDER BY paragraph_index`
        )
        .all(sermonId, lang)
      if (cached.length > 0) {
        const meta = db
          .prepare<[number], { date_code: string; title: string }>(
            'SELECT date_code, title FROM sermons WHERE id = ?'
          )
          .get(sermonId)
        return cached.map((r) => ({
          text: r.text,
          sermonTitle: meta?.title ?? '',
          dateCode: meta?.date_code ?? '',
          sermonId,
          paragraphIndex: r.paragraph_index,
          paragraphRef: r.paragraph_ref,
          language: lang
        }))
      }
    }

    const content = await fetchSermonContent(sermonId, lang)
    if (!content) return englishLocal() // never leave the operator with an empty sermon

    if (lang !== 'en') {
      const insertSermon = db.prepare(
        'INSERT OR IGNORE INTO translated_sermons (sermon_id, language, title) VALUES (?, ?, ?)'
      )
      const insertPara = db.prepare(
        'INSERT OR IGNORE INTO translated_paragraphs (sermon_id, language, paragraph_ref, paragraph_index, text) VALUES (?, ?, ?, ?, ?)'
      )
      db.transaction(() => {
        insertSermon.run(sermonId, lang, content.title)
        for (const s of content.sections) {
          insertPara.run(sermonId, lang, s.ref, s.index, s.text)
        }
      })()
    }

    return content.sections.map((s) => ({
      text: s.text,
      sermonTitle: content.title,
      dateCode: content.dateCode,
      sermonId,
      paragraphIndex: s.index,
      paragraphRef: s.ref,
      language: lang
    }))
  } catch (e) {
    log.error('browse:sermon-paragraphs error', e)
    return englishLocal()
  }
}

ipcMain.handle('browse:sermon-paragraphs', (_event, sermonId: number, language: string) =>
  getSermonParagraphsFor(sermonId, language)
)

// ── Subtitles IPC ─────────────────────────────────────────────────────────────

ipcMain.handle('sermon:subtitles', (_event, sermonId: number, language: string) => {
  return fetchSubtitles(sermonId, language || 'en')
})

// ── Bible IPC ─────────────────────────────────────────────────────────────────

ipcMain.handle('bible:translations', () => {
  try {
    return getBibleTranslations()
  } catch (e) {
    log.error('bible:translations error', e)
    return []
  }
})

ipcMain.handle('bible:lookup', (_event, reference: string, translation: string) =>
  lookupPassage(reference, translation)
)

ipcMain.handle(
  'bible:search',
  (
    _event,
    query: string,
    translation: string,
    mode?: BibleSearchMode,
    range?: BibleSearchRange
  ) => searchBible(query, translation, BIBLE_SEARCH_LIMIT, mode, range)
)

ipcMain.handle(
  'bible:adjacent-verse',
  (_event, translation: string, bookNum: number, chapter: number, verse: number, direction: 'next' | 'prev') =>
    getAdjacentVerse(translation, bookNum, chapter, verse, direction)
)

/** Called whenever a reference is looked up or projected on the desktop —
 *  feeds the "Recently Looked Up" shortlist on the Bible tab's Search empty
 *  state, mirroring songs:note-used above. Desktop-only for now: the remote's
 *  Bible tab has no equivalent surface yet. */
ipcMain.on('bible:note-used', (_event, reference: string, translation: string) => {
  try {
    const prev = getSettingsSafe().recentBibleRefs ?? []
    const next = [{ reference, translation }, ...prev.filter((r) => r.reference !== reference)].slice(0, 8)
    updateSettings({ recentBibleRefs: next })
  } catch (e) {
    log.error('bible:note-used failed', e)
  }
})

ipcMain.handle('bible:recent', () => getSettingsSafe().recentBibleRefs ?? [])
ipcMain.handle('bible:clear-recent', () => updateSettings({ recentBibleRefs: [] }))

// ── Songs IPC ─────────────────────────────────────────────────────────────────

ipcMain.handle('songs:search', (_event, query: string) => searchSongs(query))
ipcMain.handle('songs:get', (_event, id: number) => getSong(id))
ipcMain.handle('songs:delete', (_event, id: number) => deleteSong(id))

/** Sets or clears a song's key (null = explicitly unknown, not an error).
 *  On success, remembers it in recentKeys so the picker can surface it —
 *  clearing a key isn't "used," so only a real key value is remembered.
 *  Shared by the desktop IPC handler and the web remote's /command action
 *  below — both are a pure data write, neither needs a round-trip through
 *  the renderer the way project/queue actions do. */
function applyUpdateSongKey(id: number, key: string | null): boolean {
  const ok = updateSongKey(id, key)
  if (ok && key !== null) {
    try {
      const prev = getSettingsSafe().recentKeys ?? []
      const next = [key, ...prev.filter((x) => x !== key)].slice(0, 4)
      updateSettings({ recentKeys: next })
    } catch (e) {
      log.error('songs:update-key recentKeys failed', e)
    }
  }
  return ok
}
ipcMain.handle('songs:update-key', (_event, id: number, key: string | null) => applyUpdateSongKey(id, key))
ipcMain.handle('songs:recent-keys', () => getSettingsSafe().recentKeys ?? [])

// Hymnary.org import — desktop-only (never offered on the remote): a
// deliberate, occasional lookup, not something to build a live-service
// dependency on. See songs.ts / hymnary.ts for the actual fetch and the
// hard Public-Domain gate.
ipcMain.handle('songs:hymnary-search', (_event, query: string) => hymnarySearch(query))
ipcMain.handle('songs:hymnary-preview', (_event, url: string) => hymnaryPreview(url))
ipcMain.handle('songs:hymnary-import', (_event, url: string) => hymnaryImport(url))

/** Called whenever a song is queued or projected, from the desktop app or
 *  the web remote alike — feeds the "Recently Played" shortlist both surfaces
 *  show under Browse. */
ipcMain.on('songs:note-used', (_event, id: number) => {
  try {
    const prev = getSettingsSafe().recentSongIds ?? []
    const next = [id, ...prev.filter((x) => x !== id)].slice(0, 8)
    updateSettings({ recentSongIds: next })
  } catch (e) {
    log.error('songs:note-used failed', e)
  }
})

function recentSongSummaries(): unknown[] {
  const ids = getSettingsSafe().recentSongIds ?? []
  return ids.map((id) => getSong(id)).filter((s): s is NonNullable<typeof s> => !!s).map((s) => ({
    id: s.id,
    title: s.title,
    author: s.author,
    songKey: s.songKey,
    slideCount: s.slides.length,
    source: s.source
  }))
}

function clearRecentSongs(): void {
  updateSettings({ recentSongIds: [] })
}

ipcMain.handle('songs:recent', () => recentSongSummaries())
ipcMain.handle('songs:clear-recent', () => clearRecentSongs())

ipcMain.handle('songs:import', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import songs',
    properties: ['openFile', 'multiSelections', 'openDirectory'],
    filters: [
      {
        name: 'Song files',
        extensions: ['pro', 'pro7', 'xml', 'cho', 'crd', 'chordpro', 'chopro', 'txt']
      }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return importSongs(result.filePaths)
})

// ── Languages IPC ─────────────────────────────────────────────────────────────

ipcMain.handle('languages:list', () => fetchLanguages())

ipcMain.handle(
  'languages:translate-quote',
  async (_event, sermonId: number, paragraphRef: string, language: string) => {
    try {
      const db = getDb()
      const cached = db
        .prepare<[number, string, string], { text: string }>(
          'SELECT text FROM translated_paragraphs WHERE sermon_id = ? AND language = ? AND paragraph_ref = ?'
        )
        .get(sermonId, language, paragraphRef)
      if (cached) return cached.text

      const content = await fetchSermonContent(sermonId, language)
      if (!content) return null

      const insertSermon = db.prepare(
        'INSERT OR IGNORE INTO translated_sermons (sermon_id, language, title) VALUES (?, ?, ?)'
      )
      const insertPara = db.prepare(
        'INSERT OR IGNORE INTO translated_paragraphs (sermon_id, language, paragraph_ref, paragraph_index, text) VALUES (?, ?, ?, ?, ?)'
      )
      db.transaction(() => {
        insertSermon.run(sermonId, language, content.title)
        for (const s of content.sections) {
          insertPara.run(sermonId, language, s.ref, s.index, s.text)
        }
      })()

      const match = content.sections.find((s) => s.ref === paragraphRef)
      return match?.text ?? null
    } catch (e) {
      log.error('languages:translate-quote error', e)
      return null
    }
  }
)

// ── Indexer IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('indexer:status', () => {
  try {
    return getIndexerStatus()
  } catch (e) {
    log.error('indexer:status error', e)
    return { status: 'idle', scanned: 0, total: 1218, indexed: 0, errors: 0 }
  }
})

ipcMain.handle('indexer:start', () => {
  log.info('ipc indexer:start (manual)')
  if (mainWindow && !mainWindow.isDestroyed()) {
    startIndexer(mainWindow)
  }
})

ipcMain.handle('indexer:stop', () => {
  log.info('ipc indexer:stop')
  stopIndexer()
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  log.boot()
  app.setName('Branham or Nothing')
  // electron-builder applies build/icons/* only when packaging — set the
  // Dock icon explicitly in dev so `npm run dev` previews the real icon too.
  if (!app.isPackaged && process.platform === 'darwin') {
    const devIconPath = join(app.getAppPath(), 'build/icons/icon.png')
    if (existsSync(devIconPath)) app.dock?.setIcon(devIconPath)
  }
  projectionState.fontSize = getSettingsSafe().fontSize
  nativeTheme.themeSource = getSettingsSafe().theme
  createMainWindow()

  // Auto-start indexer so sermons are available immediately on first launch
  mainWindow!.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      log.info('auto-starting indexer after window load')
      startIndexer(mainWindow)
    }
    // Quietly check whether a newer BORN build is out.
    setTimeout(() => {
      checkForUpdate().then((info) => {
        if (info.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:update-available', info)
        }
      })
    }, 4000)
  })

  // React to monitors being plugged / unplugged / rearranged mid-session.
  screen.on('display-added', () => onDisplayLayoutChanged('display-added'))
  screen.on('display-removed', () => onDisplayLayoutChanged('display-removed'))
  screen.on('display-metrics-changed', () => onDisplayLayoutChanged('display-metrics-changed'))

  startWebRemote(
    (cmd) => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      if (cmd.action === 'prev' || cmd.action === 'next') {
        mainWindow.webContents.send('queue:navigate', cmd.action)
      } else if (cmd.action === 'blank') {
        setProjectionBlank(true)
      } else if (cmd.action === 'unblank') {
        setProjectionBlank(false)
      } else if (cmd.action === 'project' && cmd.index !== undefined) {
        mainWindow.webContents.send('webremote:project', cmd.index)
      } else if (cmd.action === 'project-at' && cmd.index !== undefined) {
        mainWindow.webContents.send('webremote:project-at', { index: cmd.index, slide: cmd.slide ?? 0 })
      } else if (cmd.action === 'clear-recent-songs') {
        clearRecentSongs()
      } else if (cmd.action === 'update-song-key' && cmd.songId !== undefined) {
        applyUpdateSongKey(cmd.songId, cmd.key ?? null)
      } else if (cmd.action === 'clear-recent-sermons') {
        updateSettings({ recentQuotes: [] })
      } else if (cmd.action === 'queue-sermon' && cmd.quote) {
        mainWindow.webContents.send('webremote:queue-sermon', cmd.quote)
      } else if (cmd.action === 'project-sermon' && cmd.quote) {
        mainWindow.webContents.send('webremote:project-sermon', {
          quote: cmd.quote,
          query: cmd.query ?? '',
          slideIndex: cmd.slide
        })
      } else if (cmd.action === 'queue-bible' && cmd.reference) {
        mainWindow.webContents.send('webremote:queue-bible', {
          reference: cmd.reference,
          translation: cmd.translation ?? 'KJV'
        })
      } else if (cmd.action === 'project-bible' && cmd.reference) {
        mainWindow.webContents.send('webremote:project-bible', {
          reference: cmd.reference,
          translation: cmd.translation ?? 'KJV'
        })
      } else if (cmd.action === 'queue-song' && cmd.songId !== undefined) {
        mainWindow.webContents.send('webremote:queue-song', cmd.songId)
      } else if (cmd.action === 'project-song' && cmd.songId !== undefined) {
        mainWindow.webContents.send('webremote:project-song', { songId: cmd.songId, slide: cmd.slide ?? 0 })
      } else if (cmd.action === 'new-service') {
        mainWindow.webContents.send('webremote:new-service')
      } else if (cmd.action === 'save-queue' && cmd.name) {
        mainWindow.webContents.send('webremote:save-queue', cmd.name)
      } else if (cmd.action === 'open-service' && cmd.path) {
        const data = openServiceFile(cmd.path)
        if (data) mainWindow.webContents.send('webremote:open-service', data)
      }
    },
    {
      sermons: (query, dateCode) => searchSermonsForRemote(query, dateCode),
      bible: (query, scope) => searchBibleForRemote(query, scope),
      songs: (query) => Promise.resolve(searchSongs(query)),
      song: (id) => Promise.resolve(getSong(id)),
      bibleBooks: () => Promise.resolve(bibleBooksForRemote()),
      bibleChapter: (bookNum, chapter) => bibleChapterForRemote(bookNum, chapter),
      recentSongs: () => Promise.resolve(recentSongSummaries()),
      recentKeys: () => Promise.resolve(getSettingsSafe().recentKeys ?? []),
      recentServices: () =>
        Promise.resolve(
          (getSettingsSafe().recentServices ?? [])
            .filter((p) => existsSync(p))
            .map((p) => ({ path: p, name: basename(p).replace(/\.(born|bpservice)$/, ''), mtimeMs: statSync(p).mtimeMs }))
        ),
      sermonSeries: () => fetchAllSeries(),
      sermonsByIds: (ids) => Promise.resolve(getSermonsByIdsFor(ids)),
      // Same one-paragraph-per-slide split as the search results above — a
      // browsed or recently-used quote can span several numbered paragraphs
      // just as easily as a search hit can.
      sermonParagraphs: (sermonId) =>
        getSermonParagraphsFor(sermonId, 'en').then((rows) =>
          (rows as Quote[]).map((r) => ({ ...r, slides: quoteToItem(r).slides }))
        ),
      recentSermons: () =>
        Promise.resolve(
          (getSettingsSafe().recentQuotes ?? []).map((r) => ({ ...r, slides: quoteToItem(r).slides }))
        ),
      onThisDay: () => {
        try {
          const now = new Date()
          return Promise.resolve(getOnThisDay(getDb(), now.getMonth() + 1, now.getDate()))
        } catch {
          return Promise.resolve([])
        }
      }
    }
  )
  startMdns(REMOTE_PORT)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

// A second launch attempt quits itself (see the single-instance-lock guard
// up top) and this fires on the ORIGINAL instance instead — bring its window
// forward, exactly like clicking the Dock icon, rather than leaving the
// operator staring at a launch that appeared to do nothing.
app.on('second-instance', () => {
  log.info('second-instance — focusing the existing window instead of starting a new copy')
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  } else {
    createMainWindow()
  }
})

app.on('before-quit', () => stopMdns())

app.on('window-all-closed', () => {
  log.info('all windows closed — shutting down')
  closeDb()
  closeLibraryDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Catch unhandled promise rejections in the main process
process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection in main process', reason)
})

process.on('uncaughtException', (err) => {
  log.error('uncaughtException in main process', err)
})
