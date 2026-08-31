import { app, BrowserWindow, ipcMain, screen, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { log } from './logger'
import { getDb, closeDb } from './db'
import { closeLibraryDb } from './libraryDb'
import { getBibleTranslations, lookupPassage, searchBible, getAdjacentVerse } from './bible'
import { searchSongs, getSong, importSongs, deleteSong } from './songs'
import { startIndexer, stopIndexer, getIndexerStatus } from './indexer'
import {
  startWebRemote,
  updateWebRemoteState,
  getLocalIP,
  isWebRemoteAvailable
} from './webRemote'
import {
  buildSearchSQL,
  buildPhraseQuery,
  buildTokenQuery,
  rowToQuote,
  type SearchFilters,
  type QuoteRow
} from './search'
import { pickProjectionDisplay, describeDisplay, type DisplayLike } from './displays'
import {
  checkForUpdate,
  getCachedUpdate,
  openReleasePage,
  downloadUpdate,
  runInstaller
} from './updateCheck'
import { getLocalDateGroups, getLocalDurationGroups } from './browseLocal'
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

function getSettingsSafe(): { fontSize: number; projectionDisplayId: number | null } {
  try {
    return getSettings()
  } catch {
    return { fontSize: 3.0, projectionDisplayId: null }
  }
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
    backgroundColor: '#0d1117',
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
    sendToMain('projection:closed')
  })
}

function createStageWindow(): void {
  log.info('createStageWindow')
  stageReady = false
  stageWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    title: 'BORN — Stage View',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

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

function displayInfoPayload() {
  const primary = screen.getPrimaryDisplay()
  const displays = screen.getAllDisplays()
  const target = resolveProjectionTarget()
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
    hasExternal: displays.length > 1
  }
}

function broadcastDisplayInfo(): void {
  const payload = displayInfoPayload()
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

let displayChangeTimer: ReturnType<typeof setTimeout> | null = null
function onDisplayLayoutChanged(reason: string): void {
  if (repositioning) return // don't react to the metrics-changed events our own move fires
  log.info(`display layout changed: ${reason}`)
  if (displayChangeTimer) clearTimeout(displayChangeTimer)
  displayChangeTimer = setTimeout(() => {
    displayChangeTimer = null
    repositionProjectionWindow()
    broadcastDisplayInfo()
  }, 400)
}

// ── Projection control helpers ────────────────────────────────────────────────

function setProjectionBlank(blank: boolean): void {
  projectionState.blank = blank
  sendToProjection('projection:set-blank', blank)
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
})

ipcMain.on('projection:clear', () => {
  projectionState = { ...projectionState, slide: null, blank: false }
  sendToProjection('projection:clear')
})

ipcMain.on('projection:alert', (_event, message: string) => {
  sendToProjection('projection:alert', message)
})

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

// ── App / update IPC ──────────────────────────────────────────────────────────

ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:check-update', () => checkForUpdate())
ipcMain.handle('app:update-info', () => getCachedUpdate())
ipcMain.handle('app:open-release-page', () => openReleasePage())
ipcMain.handle('app:download-update', (e) =>
  downloadUpdate(BrowserWindow.fromWebContents(e.sender))
)
ipcMain.handle('app:run-installer', (_e, filePath: string) => runInstaller(filePath))
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
  broadcastDisplayInfo()
  return displayInfoPayload()
})

// ── Search IPC ────────────────────────────────────────────────────────────────

ipcMain.handle('search:query', async (_event, rawQuery: string, filters: SearchFilters = {}) => {
  const query = (rawQuery ?? '').trim()
  if (!query) return []
  log.debug(`search:query "${query}"`, filters)

  try {
    const db = getDb()

    const localCount = db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM sermons').get()?.n ?? 0
    log.debug(`search:query localCount=${localCount}`)

    if (localCount < 100) {
      log.info(`search:query falling back to server search (localCount=${localCount})`)
      const searchType = filters.forceTokens ? 'AllWords' : 'ExactPhrase'
      const serverResults = await serverSearch(query, searchType)
      if (serverResults.length === 0 && !filters.forceTokens) {
        return serverSearch(query, 'AllWords')
      }
      return serverResults
    }

    const { sql, extraParams } = buildSearchSQL(filters)

    if (!filters.forceTokens) {
      try {
        const rows = db.prepare(sql).all(buildPhraseQuery(query), ...extraParams) as QuoteRow[]
        if (rows.length > 0) {
          log.debug(`search:query phrase match: ${rows.length} results`)
          return rows.map(rowToQuote)
        }
      } catch (e) {
        log.warn('search:query phrase match FTS error', e)
      }
    }

    try {
      const tokenQuery = buildTokenQuery(query)
      if (!tokenQuery) return []
      const rows = db.prepare(sql).all(tokenQuery, ...extraParams) as QuoteRow[]
      log.debug(`search:query token match: ${rows.length} results`)
      return rows.map(rowToQuote)
    } catch (e) {
      log.error('search:query token match error', e)
      return []
    }
  } catch (e) {
    log.error('search:query fatal error', e)
    return []
  }
})

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
  return isWebRemoteAvailable() ? `http://${getLocalIP()}:4316` : ''
})

// ── Service file IPC ──────────────────────────────────────────────────────────

ipcMain.handle('service:save', async (_event, items: unknown) => {
  log.info('ipc service:save')
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'BORN Service', extensions: ['bpservice'] }],
    defaultPath: 'service.bpservice'
  })
  if (result.canceled || !result.filePath) return false
  writeFileSync(result.filePath, JSON.stringify(items, null, 2))
  return true
})

ipcMain.handle('service:open', async () => {
  log.info('ipc service:open')
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'BORN Service', extensions: ['bpservice'] }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths[0]) return null
  return JSON.parse(readFileSync(result.filePaths[0], 'utf-8'))
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
ipcMain.handle('browse:duration-groups', () => {
  try {
    const groups = getLocalDurationGroups(getDb())
    if (groups.length > 0) return groups
  } catch (e) {
    log.warn('local duration groups failed, falling back to online', e)
  }
  return fetchAllDurationGroups()
})

ipcMain.handle('browse:sermons-by-ids', (_event, ids: number[]) => {
  log.debug(`ipc browse:sermons-by-ids count=${ids?.length ?? 0}`)
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
})

ipcMain.handle('browse:sermon-paragraphs', async (_event, sermonId: number, language: string) => {
  log.debug(`ipc browse:sermon-paragraphs sermonId=${sermonId} lang=${language}`)
  try {
    const db = getDb()
    const lang = language || 'en'

    if (lang === 'en') {
      const rows = db
        .prepare<
          [number],
          { paragraph_ref: string; paragraph_index: number; text: string; date_code: string; title: string }
        >(
          `SELECT p.paragraph_ref, p.paragraph_index, p.text, s.date_code, s.title
           FROM paragraphs p JOIN sermons s ON s.id = p.sermon_id
           WHERE p.sermon_id = ? ORDER BY p.paragraph_index`
        )
        .all(sermonId)
      if (rows.length > 0)
        return rows.map((r) => ({
          text: r.text,
          sermonTitle: r.title,
          dateCode: r.date_code,
          sermonId,
          paragraphIndex: r.paragraph_index,
          paragraphRef: r.paragraph_ref,
          language: 'en'
        }))
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
    if (!content) return []

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
    return []
  }
})

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

ipcMain.handle('bible:search', (_event, query: string, translation: string) =>
  searchBible(query, translation)
)

ipcMain.handle(
  'bible:adjacent-verse',
  (_event, translation: string, bookNum: number, chapter: number, verse: number, direction: 'next' | 'prev') =>
    getAdjacentVerse(translation, bookNum, chapter, verse, direction)
)

// ── Songs IPC ─────────────────────────────────────────────────────────────────

ipcMain.handle('songs:search', (_event, query: string) => searchSongs(query))
ipcMain.handle('songs:get', (_event, id: number) => getSong(id))
ipcMain.handle('songs:delete', (_event, id: number) => deleteSong(id))

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
  projectionState.fontSize = getSettingsSafe().fontSize
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

  startWebRemote((cmd) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (cmd.action === 'prev' || cmd.action === 'next') {
      mainWindow.webContents.send('queue:navigate', cmd.action)
    } else if (cmd.action === 'blank') {
      setProjectionBlank(true)
    } else if (cmd.action === 'unblank') {
      setProjectionBlank(false)
    } else if (cmd.action === 'project' && cmd.index !== undefined) {
      mainWindow.webContents.send('webremote:project', cmd.index)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

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
