/**
 * tapeService.ts — the Tape service's glue to Electron: where tape.db and the audio copies live (<userData>/tape.db, <userData>/tapes),
 * the `born-tape://` protocol the audio engine reads files through (with Range, so seeking works), and the IPC the operator's screens use.
 * The rules live in tapeLibrary.ts / tapeDb.ts / shared/tape*.ts (Electron-free, tested directly).
 */
import { app, dialog, ipcMain, BrowserWindow, protocol, shell, powerMonitor } from 'electron'
import Database from 'better-sqlite3'
import { Readable } from 'stream'
import { createReadStream, existsSync, statSync, statfsSync } from 'fs'
import { join } from 'path'
import { log } from './logger'
import { testHook } from './testHooks'
import { getDb } from './db'
import { getSettings, updateSettings, TAPE_DEFAULTS, type TapeSettings } from './settings'
import { TapeDb } from './tapeDb'
import { TapeLibrary } from './tapeLibrary'
import { TapeHub } from './tapeHub'
import { AUDIO_EXTENSIONS, audioActivity } from './audioProbe'
import { readFileSync, writeFileSync } from 'fs'
import { parseRange } from '../shared/httpRange'
import { TAPE_AUDIO_PAGE, type TapeFile, type TapeFolderHit, type TapeImportResult, type TapePreflight, type TapeRecording } from '../shared/tape'
import { matchSermon, parseTapeName, type SermonRef, type TapeMatch } from '../shared/tapeMatch'
import type { TapeAction, TapeWire } from '../shared/tapePlayback'
import { cleanOverrides } from '../shared/tapeLanguage'
import { cleanSyncMarks, cleanSyncRegions, cleanTextLanguage, cleanTapeSettingsPatch } from '../shared/tapeClean'
import { alignRecording, cancelAlign, alignBusy } from './tapeAligner'
import { parseTimingFile, toTimingFile, validateMap, type MapIssue } from '../shared/tapeSync'
import type { SyncMark, SyncMap, SyncRegion, SyncSource } from '../shared/tape'

// `born-tape://file/<t_id>` — how the hidden audio engine reads a tape without ever being given a path. Must be declared before the app is ready.
protocol.registerSchemesAsPrivileged([{ scheme: 'born-tape', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])

let tdb: TapeDb | null = null
let lib: TapeLibrary | null = null
let raw: Database.Database | null = null
let unavailable: string | null = null

export function tapeDir(): string {
  return join(app.getPath('userData'), 'tapes')
}

export function getTapeDb(): TapeDb | null {
  if (tdb || unavailable) return tdb
  try {
    raw = new Database(join(app.getPath('userData'), 'tape.db'))
    raw.pragma('journal_mode = WAL')
    tdb = new TapeDb(raw)
    lib = new TapeLibrary({ dir: tapeDir(), db: tdb, freeBytes: freeBytes })
  } catch (e) {
    unavailable = (e as Error).message
    log.error('tape: cannot open tape.db', e)
  }
  return tdb
}
export function getTapeLibrary(): TapeLibrary | null {
  getTapeDb()
  return lib
}
export function closeTape(): void {
  try { raw?.close() } catch { /* already closed */ }
  raw = null; tdb = null; lib = null
}

function freeBytes(dir: string): number | null {
  try {
    const s = statfsSync(dir)
    return Number(s.bavail) * Number(s.bsize)
  } catch {
    return null
  }
}

/** The sermon list used for matching names and for the "does the length fit?" check (read-only). */
export function sermonRefs(): SermonRef[] {
  try {
    return getDb().prepare('SELECT id, date_code, title, duration_min FROM sermon_index ORDER BY date_code').all() as SermonRef[]
  } catch (e) {
    log.warn('tape: sermon list unavailable', e)
    return []
  }
}
export function sermonDurationMin(sermonId: number): number | undefined {
  try {
    const r = getDb().prepare('SELECT duration_min FROM sermon_index WHERE id = ?').get(sermonId) as { duration_min: number } | undefined
    return r && r.duration_min > 0 ? r.duration_min : undefined
  } catch {
    return undefined
  }
}

const CONTENT_TYPE: Record<string, string> = { m4a: 'audio/mp4', mp4: 'audio/mp4', mp3: 'audio/mpeg', flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav' }

function registerTapeProtocol(): void {
  protocol.handle('born-tape', async (req) => {
    const notFound = new Response('not found', { status: 404 })
    try {
      const u = new URL(req.url)
      const id = u.pathname.split('/').filter(Boolean)[0] ?? ''
      if (u.hostname !== 'file' || !/^t_[0-9a-f]{12}$/.test(id)) return notFound
      const l = getTapeLibrary()
      const f = l && getTapeDb()?.getFile(id)
      const p = f && l ? l.resolvePath(f) : null
      if (!f || !p || !existsSync(p)) return notFound
      const size = statSync(p).size
      const range = parseRange(req.headers.get('range'), size)
      if (range === 'invalid') return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
      const part = range ?? { start: 0, end: Math.max(0, size - 1) }
      const body = size === 0 ? null : (Readable.toWeb(createReadStream(p, { start: part.start, end: part.end })) as unknown as ReadableStream)
      return new Response(body, {
        status: range ? 206 : 200,
        headers: {
          'content-type': CONTENT_TYPE[f.ext] ?? 'application/octet-stream',
          'cache-control': 'no-store',
          'accept-ranges': 'bytes',
          'content-length': String(size === 0 ? 0 : part.end - part.start + 1),
          ...(range ? { 'content-range': `bytes ${part.start}-${part.end}/${size}` } : {})
        }
      })
    } catch (e) {
      log.warn('born-tape protocol error', e)
      return notFound
    }
  })
}

export interface RecordingInfo extends TapeRecording {
  status: ReturnType<TapeLibrary['status']>
}

export function recordingsFor(sermonId: number): RecordingInfo[] {
  const db = getTapeDb()
  const l = getTapeLibrary()
  if (!db || !l) return []
  return db.listRecordings(sermonId).map((r) => ({ ...r, status: l.status(r.file) }))
}

// ── the audio engine (hidden window) and the one tape record ─────────────────────────────────────────────
let engineWin: BrowserWindow | null = null
let engineReady = false
let engineQueue: unknown[] = []
let outputDevices: Array<{ id: string; label: string }> = []

export interface TapeFanout {
  /** the record (or null = no tape) goes to every window that follows it */
  state: (w: TapeWire | null) => void
  /** a plain-words message for the operator ("The video was paused so the tape can play…") */
  notice: (m: string) => void
  /** one sound at a time: is a video / YouTube item playing, and pause it */
  videoPlaying: () => boolean
  pauseVideo: () => void
}
let fan: TapeFanout = { state: () => {}, notice: () => {}, videoPlaying: () => false, pauseVideo: () => {} }
export function setTapeFanout(f: TapeFanout): void { fan = f }

const tapeSettings = (): TapeSettings => ({ ...TAPE_DEFAULTS, ...getSettings().tape })

function toEngine(m: unknown): void {
  if (engineWin && !engineWin.isDestroyed() && engineReady) engineWin.webContents.send('tape:engine', m)
  else engineQueue.push(m)
}

function ensureEngine(): void {
  if (engineWin && !engineWin.isDestroyed()) return
  engineReady = false
  engineWin = new BrowserWindow({
    show: false,
    width: 200,
    height: 100,
    title: 'BORN tape audio',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }
  })
  engineWin.webContents.on('render-process-gone', (_e, d) => {
    log.error('tape engine gone', d)
    engineReady = false
    // the record says where it was: the engine is re-created and resumes PAUSED at that position, and the operator is told
    const r = hub.record
    if (r) {
      hub.pauseFor('device')
      fan.notice('The tape audio restarted. It is paused where it was — press Play to continue.')
    }
  })
  const dev = process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']
  if (dev) void engineWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/audio.html`)
  else void engineWin.loadFile(join(__dirname, '../renderer/audio.html'))
}

export const hub: TapeHub = new TapeHub({
  now: () => Date.now(),
  emit: (w) => fan.state(w),
  engine: (m) => { ensureEngine(); toEngine(m) },
  savePosition: (id, sec) => { try { getTapeDb()?.setPosition(id, sec) } catch (e) { log.warn('tape: could not save position', e) } },
  loadRecording: (id) => {
    const db = getTapeDb()
    const rec = db?.getRecording(id)
    return db && rec ? { recording: rec, resume: db.getPosition(id) } : null
  },
  settings: () => ({ outputDeviceId: tapeSettings().outputDeviceId, outputDeviceLabel: tapeSettings().outputDeviceLabel }),
  videoPlaying: () => fan.videoPlaying(),
  pauseVideo: () => fan.pauseVideo(),
  notice: (m) => fan.notice(m)
})
setInterval(() => hub.tick(), 1000).unref()

export function registerTapeIpc(getMain: () => BrowserWindow | null): void {
  registerTapeProtocol()

  // the engine speaks only on these channels, and only the engine window may use them
  const fromEngine = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean => !!engineWin && !engineWin.isDestroyed() && e.sender === engineWin.webContents
  ipcMain.on('tape:engine-ready', (e) => {
    if (!fromEngine(e)) return
    engineReady = true
    const q = engineQueue
    engineQueue = []
    for (const m of q) engineWin?.webContents.send('tape:engine', m)
    // a re-created engine is told the record again (it will report ready, then resume where the record says)
    if (hub.record && q.length === 0) hub.resend()
  })
  ipcMain.on('tape:engine-report', (e, r) => {
    if (!fromEngine(e) || !r || typeof r.position !== 'number' || !Number.isFinite(r.position)) return
    hub.report({
      position: Math.max(0, r.position), playing: !!r.playing, duration: typeof r.duration === 'number' && Number.isFinite(r.duration) ? r.duration : undefined,
      ended: !!r.ended, stalled: !!r.stalled, error: typeof r.error === 'string' ? r.error.slice(0, 300) : null,
      errorKind: r.errorKind === 'file' || r.errorKind === 'device' || r.errorKind === 'decode' ? r.errorKind : null, ready: !!r.ready
    })
  })
  ipcMain.on('tape:engine-devices', (e, list) => {
    if (!fromEngine(e) || !Array.isArray(list)) return
    outputDevices = list.filter((d) => d && typeof d.id === 'string').map((d) => ({ id: String(d.id), label: String(d.label ?? '') }))
  })
  ipcMain.on('tape:engine-device-lost', (e) => { if (fromEngine(e)) hub.deviceLost() })

  // the operator's controls
  ipcMain.handle('tape:load', (_e, recordingId: string, opts: { play?: boolean; position?: number } = {}) => {
    ensureEngine()
    hub.load(String(recordingId), { play: !!opts?.play, position: typeof opts?.position === 'number' ? opts.position : undefined })
    return hub.get()
  })
  const VALID: TapeAction['type'][] = ['play', 'pause', 'toggle', 'seek', 'skip', 'speed', 'volume', 'muted']
  ipcMain.handle('tape:command', (_e, a: TapeAction) => {
    if (!a || typeof a !== 'object' || !VALID.includes(a.type)) return hub.get()
    const x = a as { type: TapeAction['type']; to?: number; by?: number; value?: number | boolean }
    // only plain values from the window: never trust shapes (a `report` is reserved for the engine)
    const safe: TapeAction =
      x.type === 'seek' ? { type: 'seek', to: Number(x.to) || 0 }
      : x.type === 'skip' ? { type: 'skip', by: Number(x.by) || 0 }
      : x.type === 'speed' ? { type: 'speed', value: Number(x.value) }
      : x.type === 'volume' ? { type: 'volume', value: Number(x.value) }
      : x.type === 'muted' ? { type: 'muted', value: !!x.value }
      : ({ type: x.type } as TapeAction)
    hub.command(safe)
    return hub.get()
  })
  ipcMain.handle('tape:get', () => hub.get())
  ipcMain.handle('tape:unload', () => { hub.unload(); return true })
  ipcMain.handle('tape:devices', () => outputDevices)
  ipcMain.handle('tape:set-device', (_e, id: string, label: string) => {
    updateSettings({ tape: { ...tapeSettings(), outputDeviceId: String(id ?? ''), outputDeviceLabel: String(label ?? '') } })
    hub.setDevice(String(id ?? ''), String(label ?? ''))
    return true
  })
  ipcMain.handle('tape:settings-get', () => tapeSettings())
  ipcMain.handle('tape:settings-set', (_e, patch: Partial<TapeSettings>) => {
    const next = { ...tapeSettings(), ...cleanTapeSettingsPatch(patch) }
    updateSettings({ tape: next })
    return next
  })

  // sleep: the tape pauses and stays paused; the screens are re-told where it is on wake
  try {
    powerMonitor.on('suspend', () => hub.pauseFor('sleep'))
    powerMonitor.on('resume', () => hub.resend())
  } catch (e) {
    log.warn('tape: power events unavailable', e)
  }

  ipcMain.handle('tape:info', () => ({ available: !!getTapeDb(), message: unavailable, folder: getSettings().tapeFolder, audioPage: TAPE_AUDIO_PAGE }))
  ipcMain.handle('tape:recordings', (_e, sermonId: number) => (Number.isFinite(sermonId) ? recordingsFor(Number(sermonId)) : []))
  ipcMain.handle('tape:sermons-with-tapes', () => getTapeDb()?.sermonsWithTapes() ?? [])

  const importPaths = async (paths: string[], opts: { sermonId?: number; language?: string; link?: boolean }): Promise<TapeImportResult[]> => {
    const l = getTapeLibrary()
    if (!l) return paths.map((p) => ({ ok: false as const, path: p, reason: 'unreadable' as const, message: 'The tape library is not available on this computer.' }))
    return l.importPaths(paths.filter((p) => typeof p === 'string'), { sermonId: opts.sermonId, language: opts.language, link: !!opts.link })
  }
  ipcMain.handle('tape:import-paths', (_e, paths: string[], opts: { sermonId?: number; language?: string; link?: boolean } = {}) => importPaths(paths ?? [], opts ?? {}))
  ipcMain.handle('tape:pick-and-import', async (_e, opts: { sermonId?: number; language?: string; link?: boolean } = {}) => {
    const test = testHook('BORN_TEST_PICK_TAPE', app.isPackaged)
    let paths: string[]
    if (test) paths = test.split('|')
    else {
      const win = getMain()
      const r = await dialog.showOpenDialog(win ?? undefined!, { title: 'Choose the recording', properties: ['openFile'], filters: [{ name: 'Audio', extensions: AUDIO_EXTENSIONS }] })
      if (r.canceled || r.filePaths.length === 0) return { canceled: true, results: [] as TapeImportResult[] }
      paths = r.filePaths
    }
    return { canceled: false, results: await importPaths(paths, opts ?? {}) }
  })
  ipcMain.handle('tape:remove', (_e, recordingId: string) => {
    getTapeDb()?.removeRecording(String(recordingId))
    return true
  })
  ipcMain.handle('tape:match-name', (_e, fileName: string): TapeMatch & { parsedCode: string | null } => {
    const parsed = parseTapeName(String(fileName ?? ''))
    return { ...matchSermon(parsed, sermonRefs()), parsedCode: parsed.dateCode }
  })

  // the "Tape audio" folder
  ipcMain.handle('tape:pick-folder', async () => {
    const test = testHook('BORN_TEST_TAPE_FOLDER', app.isPackaged)
    let folder = test
    if (!folder) {
      const win = getMain()
      const r = await dialog.showOpenDialog(win ?? undefined!, { title: 'Choose the folder where your tape audio is kept', properties: ['openDirectory'] })
      if (r.canceled || r.filePaths.length === 0) return null
      folder = r.filePaths[0]
    }
    updateSettings({ tapeFolder: folder })
    return folder
  })
  ipcMain.handle('tape:clear-folder', () => { updateSettings({ tapeFolder: null }); return true })
  ipcMain.handle('tape:scan-folder', (): TapeFolderHit[] => {
    const folder = getSettings().tapeFolder
    const l = getTapeLibrary()
    return folder && l ? l.scanFolder(folder, sermonRefs()) : []
  })
  /** Import files the operator confirmed, each against the sermon they chose. */
  ipcMain.handle('tape:import-confirmed', async (_e, items: Array<{ path: string; sermonId: number }>) => {
    const out: TapeImportResult[] = []
    for (const it of items ?? []) out.push(...(await importPaths([it.path], { sermonId: Number(it.sermonId) })))
    return out
  })

  ipcMain.handle('tape:preflight', async (_e, recordingId: string, extra: { browserDurationSec?: number | null; paragraphNumbers?: number[]; outputDevice?: { present: boolean; label?: string } | null } = {}): Promise<TapePreflight | null> => {
    const l = getTapeLibrary()
    const db = getTapeDb()
    if (!l || !db) return null
    const rec = db.getRecording(String(recordingId))
    return l.preflight(String(recordingId), { durationMin: rec ? sermonDurationMin(rec.sermonId) : undefined }, extra ?? {})
  })

  // ── sync maps (docs/design/sermon-audio/02 §4) ──
  const cleanMarks = cleanSyncMarks, cleanRegions = cleanSyncRegions, lang = cleanTextLanguage

  ipcMain.handle('tape:map-get', (_e, recordingId: string, textLanguage: string | null): SyncMap | null => getTapeDb()?.getMap(String(recordingId), lang(textLanguage)) ?? null)
  ipcMain.handle('tape:map-languages', (_e, recordingId: string) => getTapeDb()?.listMapLanguages(String(recordingId)) ?? [])
  ipcMain.handle('tape:map-save', (_e, recordingId: string, textLanguage: string | null, source: SyncSource, marks: unknown, regions: unknown): { ok: true; map: SyncMap; issues: MapIssue[] } | { ok: false; issues: MapIssue[] } => {
    const db = getTapeDb()
    const rec = db?.getRecording(String(recordingId))
    if (!db || !rec) return { ok: false, issues: [{ level: 'error', code: 'range', message: 'This recording is no longer attached to the sermon.' }] }
    const m = cleanMarks(marks), r = cleanRegions(regions)
    const issues = validateMap(m, r, rec.file.durationSec)
    if (issues.some((i) => i.level === 'error')) return { ok: false, issues }
    const src: SyncSource = source === 'auto' || source === 'imported' ? source : 'tap'
    return { ok: true, map: db.saveMap(rec.id, lang(textLanguage), src, m, r), issues }
  })
  ipcMain.handle('tape:pick-tool', async (_e, which: string): Promise<string | null> => {
    const hook = testHook('BORN_TEST_TAPE_TOOL', app.isPackaged)
    if (hook) return hook
    const titles: Record<string, string> = { whisper: 'Choose the whisper.cpp program (whisper-cli)', model: 'Choose a whisper.cpp model file (.bin)', ffmpeg: 'Choose ffmpeg' }
    const r = await dialog.showOpenDialog(getMain() ?? undefined!, { title: titles[which] ?? 'Choose a file', properties: ['openFile'] })
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]
  })
  // ── automatic alignment (optional; a PROPOSAL only, never saved here) ──
  ipcMain.handle('tape:align-run', async (e, recordingId: string, paragraphs: unknown) => {
    const rec = getTapeDb()?.getRecording(String(recordingId))
    const path = rec ? lib?.resolvePath(rec.file) : null
    if (!rec || !path) return { ok: false, message: 'This recording is no longer attached to the sermon.' }
    const paras = (Array.isArray(paragraphs) ? paragraphs : []).filter((p) => p && Number.isInteger(p.n) && typeof p.text === 'string').map((p) => ({ n: p.n as number, text: p.text as string }))
    if (!paras.length) return { ok: false, message: 'There is no numbered text to line up.' }
    const t = getSettings().tape
    return alignRecording(path, paras, { whisper: t.whisperPath ?? '', model: t.whisperModelPath ?? '', ffmpeg: t.ffmpegPath ?? '' }, (p) => { if (!e.sender.isDestroyed()) e.sender.send('tape:align-progress', p) })
  })
  ipcMain.handle('tape:align-cancel', () => { cancelAlign(); return alignBusy() })
  ipcMain.handle('tape:overrides-get', (_e, recordingId: string, textLanguage: string) => (lang(textLanguage) ? getTapeDb()?.getOverrides(String(recordingId), String(textLanguage)) ?? [] : []))
  ipcMain.handle('tape:overrides-set', (_e, recordingId: string, textLanguage: string, rows: unknown) => {
    const db = getTapeDb()
    if (!db || !lang(textLanguage) || !db.getRecording(String(recordingId))) return []
    const clean = cleanOverrides(rows)
    db.setOverrides(String(recordingId), String(textLanguage), clean)
    return clean
  })
  ipcMain.handle('tape:map-delete', (_e, recordingId: string, textLanguage: string | null) => { getTapeDb()?.deleteMap(String(recordingId), lang(textLanguage)); return true })
  ipcMain.handle('tape:map-export', async (_e, recordingId: string, textLanguage: string | null): Promise<{ ok: boolean; canceled?: boolean; path?: string; message?: string }> => {
    const db = getTapeDb()
    const rec = db?.getRecording(String(recordingId))
    const map = db && rec ? db.getMap(rec.id, lang(textLanguage)) : null
    if (!rec || !map) return { ok: false, message: 'There is no timing to export yet.' }
    const dateCode = sermonRefs().find((x) => x.id === rec.sermonId)?.date_code ?? ''
    const body = JSON.stringify(toTimingFile(map, { hash: rec.file.hash, durationSec: rec.file.durationSec, language: rec.language }, { id: rec.sermonId, dateCode }), null, 1)
    let path = testHook('BORN_TEST_TAPE_EXPORT', app.isPackaged)
    if (!path) {
      const r = await dialog.showSaveDialog(getMain() ?? undefined!, { title: 'Save the timing file', defaultPath: `${dateCode || 'tape'} timing.born-sync.json`, filters: [{ name: 'BORN timing', extensions: ['json'] }] })
      if (r.canceled || !r.filePath) return { ok: false, canceled: true }
      path = r.filePath
    }
    try { writeFileSync(path, body, 'utf8') } catch (e) { return { ok: false, message: `The file could not be saved (${(e as Error).message}).` } }
    return { ok: true, path }
  })
  ipcMain.handle('tape:map-import', async (_e, recordingId: string): Promise<{ ok: true; marks: SyncMark[]; regions: SyncRegion[]; textLanguage: string | null; warnings: string[] } | { ok: false; canceled?: boolean; message: string }> => {
    const rec = getTapeDb()?.getRecording(String(recordingId))
    if (!rec) return { ok: false, message: 'This recording is no longer attached to the sermon.' }
    let path = testHook('BORN_TEST_TAPE_IMPORT', app.isPackaged)
    if (!path) {
      const r = await dialog.showOpenDialog(getMain() ?? undefined!, { title: 'Choose a BORN timing file', properties: ['openFile'], filters: [{ name: 'BORN timing', extensions: ['json'] }] })
      if (r.canceled || r.filePaths.length === 0) return { ok: false, canceled: true, message: '' }
      path = r.filePaths[0]
    }
    let text: string
    try {
      if (statSync(path).size > 2 * 1024 * 1024) return { ok: false, message: 'This file is too large to be a timing file.' }
      text = readFileSync(path, 'utf8')
    } catch { return { ok: false, message: 'This file could not be read.' } }
    const p = parseTimingFile(text)
    if (!p.ok) return { ok: false, message: p.message }
    const warnings: string[] = []
    if (p.file.recording.hash !== rec.file.hash) warnings.push('This timing was made for a different file of this recording. If the two recordings are not the same (same length, same start), the times will be off.')
    if (Math.abs(p.file.recording.durationSec - rec.file.durationSec) > 5) warnings.push(`It was made for a ${Math.round(p.file.recording.durationSec / 60)}-minute recording; this one is ${Math.round(rec.file.durationSec / 60)} minutes.`)
    if (p.file.sermon.id !== rec.sermonId) warnings.push('It was made for a different sermon.')
    return { ok: true, marks: p.marks, regions: p.regions, textLanguage: p.file.textLanguage, warnings }
  })
  const activityCache = new Map<string, { values: number[]; durationSec: number } | null>()
  ipcMain.handle('tape:activity', (_e, recordingId: string, bins: number) => {
    const db = getTapeDb(), l = getTapeLibrary()
    const rec = db?.getRecording(String(recordingId))
    if (!db || !l || !rec) return null
    const n = Math.max(50, Math.min(2000, Math.round(Number(bins) || 600)))
    const key = `${rec.file.id}:${n}`
    if (!activityCache.has(key)) {
      const p = l.resolvePath(rec.file)
      activityCache.set(key, p ? audioActivity(p, n) : null)
    }
    return activityCache.get(key) ?? null
  })

  ipcMain.handle('tape:open-audio-page', async () => {
    await shell.openExternal(TAPE_AUDIO_PAGE)
    return true
  })
}

export type { TapeFile }
