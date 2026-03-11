import { app, BrowserWindow, ipcMain, screen, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { log } from './logger'
import { getDb, closeDb } from './db'
import { startIndexer, stopIndexer, getIndexerStatus } from './indexer'
import { startWebRemote, updateWebRemoteState, getLocalIP } from './webRemote'
import { buildSearchSQL, rowToQuote, type SearchFilters, type QuoteRow } from './search'
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

function createMainWindow(): void {
  log.info('createMainWindow')
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
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
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log.error('mainWindow renderer process gone', details)
  })

  mainWindow.webContents.on('unresponsive', () => {
    log.warn('mainWindow renderer unresponsive')
  })

  // When the operator window has focus relay Escape/unblank to projection.
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return
    if (!projectionWindow || projectionWindow.isDestroyed()) return
    if (input.key === 'Escape') {
      projectionWindow.webContents.send('projection:set-blank', true)
    } else {
      projectionWindow.webContents.send('projection:set-blank', false)
    }
  })

  mainWindow.on('closed', () => {
    log.info('mainWindow closed')
    mainWindow = null
  })
}

function createProjectionWindow(): void {
  log.info('createProjectionWindow')
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const external = displays.find((d) => d.id !== primary.id)
  const target = external ?? primary
  const { x, y, width, height } = target.bounds
  log.info(`projection target display: ${target.id} bounds=${JSON.stringify(target.bounds)}`)

  projectionWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: process.platform !== 'darwin',
    simpleFullscreen: process.platform === 'darwin',
    backgroundColor: '#000000',
    title: 'BORN — Output',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  projectionWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault()
      projectionWindow?.webContents.send('projection:set-blank', true)
    }
  })

  projectionWindow.webContents.on('render-process-gone', (_e, details) => {
    log.error('projectionWindow renderer process gone', details)
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    projectionWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/projection.html`)
  } else {
    projectionWindow.loadFile(join(__dirname, '../renderer/projection.html'))
  }

  projectionWindow.on('closed', () => {
    log.info('projectionWindow closed')
    projectionWindow = null
  })
}

function createStageWindow(): void {
  log.info('createStageWindow')
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
  })
}

// ── Projection IPC ────────────────────────────────────────────────────────────

ipcMain.handle('projection:open', () => {
  log.info('ipc projection:open')
  if (!projectionWindow || projectionWindow.isDestroyed()) {
    return new Promise<void>((resolve) => {
      createProjectionWindow()
      projectionWindow!.webContents.once('did-finish-load', () => resolve())
    })
  } else {
    projectionWindow.focus()
  }
})

ipcMain.handle('projection:close', () => {
  log.info('ipc projection:close')
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.close()
  }
})

ipcMain.on('projection:send-quote', (_event, quote) => {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.webContents.send('projection:display-quote', quote)
  }
})

ipcMain.on('projection:clear', () => {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.webContents.send('projection:clear')
  }
})

ipcMain.on('projection:alert', (_event, message: string) => {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.webContents.send('projection:alert', message)
  }
})

// ── Search IPC ────────────────────────────────────────────────────────────────

ipcMain.handle('search:query', async (_event, rawQuery: string, filters: SearchFilters = {}) => {
  const query = (rawQuery ?? '').trim()
  if (!query) return []
  log.debug(`search:query "${query}"`, filters)

  try {
    const db = getDb()

    const localCount = (db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM sermons').get()?.n ?? 0)
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
        const phraseQuery = '"' + query.replace(/"/g, '""') + '"'
        const rows = db.prepare(sql).all(phraseQuery, ...extraParams) as QuoteRow[]
        if (rows.length > 0) {
          log.debug(`search:query phrase match: ${rows.length} results`)
          return rows.map(rowToQuote)
        }
      } catch (e) {
        log.warn('search:query phrase match FTS error', e)
      }
    }

    try {
      const tokenQuery = query
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.replace(/["*()[\]^]/g, ''))
        .filter(Boolean)
        .join(' ')
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

// ── Projection controls (main window → projection window) ────────────────────

ipcMain.on('projection:set-blank', (_event, blank: boolean) => {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.webContents.send('projection:set-blank', blank)
  }
})

ipcMain.on('projection:set-font-size', (_event, size: number) => {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.webContents.send('projection:set-font-size', size)
  }
})

// ── Queue navigation relay (projection window → main window) ──────────────────

ipcMain.on('queue:navigate', (_event, dir: 'prev' | 'next') => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('queue:navigate', dir)
  }
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
  if (!stageWindow || stageWindow.isDestroyed()) {
    return new Promise<void>((resolve) => {
      createStageWindow()
      stageWindow!.webContents.once('did-finish-load', () => resolve())
    })
  } else {
    stageWindow.focus()
  }
})

ipcMain.handle('stage:close', () => {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.close()
  }
})

ipcMain.on('stage:update', (_event, data) => {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.webContents.send('stage:update', data)
  }
})

// ── Web Remote IPC ────────────────────────────────────────────────────────────

ipcMain.on('webremote:sync', (_event, state) => {
  updateWebRemoteState(state)
})

ipcMain.handle('webremote:ip', () => {
  return `http://${getLocalIP()}:4316`
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
  try { return await fetchAutocompleteSuggestions(wordPart) } catch { return [] }
})

ipcMain.handle('autocomplete:count', async (_event, text: string, searchType: 'AllWords' | 'ExactPhrase') => {
  try { return await fetchHitsCountPreview(text, searchType) } catch { return 0 }
})

// ── Server search (fallback) ──────────────────────────────────────────────────

ipcMain.handle('search:server', (_event, text: string, searchType: 'AllWords' | 'ExactPhrase') => {
  return serverSearch(text, searchType)
})

// ── Browse IPC ────────────────────────────────────────────────────────────────

ipcMain.handle('browse:series', () => {
  log.debug('ipc browse:series')
  return fetchAllSeries()
})
ipcMain.handle('browse:states', () => fetchAllStates())
ipcMain.handle('browse:cities', () => fetchAllCities())
ipcMain.handle('browse:date-groups', () => fetchAllDateGroups())
ipcMain.handle('browse:duration-groups', () => fetchAllDurationGroups())

ipcMain.handle('browse:sermons-by-ids', (_event, ids: number[]) => {
  log.debug(`ipc browse:sermons-by-ids count=${ids?.length ?? 0}`)
  try {
    const db = getDb()
    if (!ids || ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(',')
    return db
      .prepare(`SELECT id, date_code, title, para_count, duration_min, is_book FROM sermon_index WHERE id IN (${placeholders}) ORDER BY date_code`)
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
        .prepare<[number], { paragraph_ref: string; paragraph_index: number; text: string; date_code: string; title: string }>(
          `SELECT p.paragraph_ref, p.paragraph_index, p.text, s.date_code, s.title
           FROM paragraphs p JOIN sermons s ON s.id = p.sermon_id
           WHERE p.sermon_id = ? ORDER BY p.paragraph_index`
        )
        .all(sermonId)
      if (rows.length > 0) return rows.map((r) => ({
        text: r.text,
        sermonTitle: r.title,
        dateCode: r.date_code,
        sermonId,
        paragraphIndex: r.paragraph_index,
        paragraphRef: r.paragraph_ref
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
          .prepare<[number], { date_code: string; title: string }>('SELECT date_code, title FROM sermons WHERE id = ?')
          .get(sermonId)
        return cached.map((r) => ({
          text: r.text,
          sermonTitle: meta?.title ?? '',
          dateCode: meta?.date_code ?? '',
          sermonId,
          paragraphIndex: r.paragraph_index,
          paragraphRef: r.paragraph_ref
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
      paragraphRef: s.ref
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
  createMainWindow()

  // Auto-start indexer so sermons are available immediately on first launch
  mainWindow!.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      log.info('auto-starting indexer after window load')
      startIndexer(mainWindow)
    }
  })

  startWebRemote((cmd) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (cmd.action === 'prev' || cmd.action === 'next') {
      mainWindow.webContents.send('queue:navigate', cmd.action)
    } else if (cmd.action === 'blank') {
      if (projectionWindow && !projectionWindow.isDestroyed()) {
        projectionWindow.webContents.send('projection:set-blank', true)
      }
    } else if (cmd.action === 'unblank') {
      if (projectionWindow && !projectionWindow.isDestroyed()) {
        projectionWindow.webContents.send('projection:set-blank', false)
      }
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
