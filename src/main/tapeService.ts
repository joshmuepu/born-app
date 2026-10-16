/**
 * tapeService.ts — the Tape service's glue to Electron: where tape.db and the audio copies live (<userData>/tape.db, <userData>/tapes),
 * the `born-tape://` protocol the audio engine reads files through (with Range, so seeking works), and the IPC the operator's screens use.
 * The rules live in tapeLibrary.ts / tapeDb.ts / shared/tape*.ts (Electron-free, tested directly).
 */
import { app, dialog, ipcMain, BrowserWindow, protocol, shell } from 'electron'
import Database from 'better-sqlite3'
import { Readable } from 'stream'
import { createReadStream, existsSync, statSync, statfsSync } from 'fs'
import { join } from 'path'
import { log } from './logger'
import { testHook } from './testHooks'
import { getDb } from './db'
import { getSettings, updateSettings } from './settings'
import { TapeDb } from './tapeDb'
import { TapeLibrary } from './tapeLibrary'
import { AUDIO_EXTENSIONS } from './audioProbe'
import { parseRange } from '../shared/httpRange'
import { TAPE_AUDIO_PAGE, type TapeFile, type TapeFolderHit, type TapeImportResult, type TapePreflight, type TapeRecording } from '../shared/tape'
import { matchSermon, parseTapeName, type SermonRef, type TapeMatch } from '../shared/tapeMatch'

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

export function registerTapeIpc(getMain: () => BrowserWindow | null): void {
  registerTapeProtocol()

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

  ipcMain.handle('tape:open-audio-page', async () => {
    await shell.openExternal(TAPE_AUDIO_PAGE)
    return true
  })
}

export type { TapeFile }
