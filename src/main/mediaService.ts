/**
 * mediaService.ts — owns the one MediaLibrary instance for the running app and
 * exposes it over IPC. All the rules live in mediaLibrary.ts; this file only
 * decides where the library lives (<userData>/media), keeps a backup of the
 * index, tidies at start-up, and turns operator actions (a file dialog, a
 * drop) into library calls.
 */
import { app, dialog, ipcMain, BrowserWindow, protocol, net, shell } from 'electron'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, statfsSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { pathToFileURL } from 'url'
import { join } from 'path'
import { log } from './logger'
import { checkAndRecoverDatabase } from './dbIntegrity'
import { MediaLibrary, type ImportOptions, type ListQuery } from './mediaLibrary'
import { MediaDbTooNewError } from './mediaSchema'
import { electronMediaDecoder, disposeMediaDecoder } from './mediaDecoder'
import { IMAGE_EXTENSIONS, MEDIA_MESSAGES, type MediaImportResult, type MediaRecord } from '../shared/media'

// `born-media://thumb/<id>/<320|960>` and `born-media://file/<id>` — how the
// renderer (and, in Step 4, the output windows) read library pictures without
// ever being given a file path. Must be declared before the app is ready.
protocol.registerSchemesAsPrivileged([{ scheme: 'born-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])

let lib: MediaLibrary | null = null
let unavailable: string | null = null

export function mediaDir(): string {
  return join(app.getPath('userData'), 'media')
}

/** Open the library (safe to call repeatedly). Never throws: on failure the media
 *  area reports itself unavailable and everything else in BORN carries on. */
export function getMediaLibrary(): MediaLibrary | null {
  if (lib || unavailable) return lib
  try {
    const dir = mediaDir()
    mkdirSync(dir, { recursive: true })
    const dbPath = join(dir, 'media.db')
    const bak = join(dir, 'media.db.bak')
    const rec = checkAndRecoverDatabase(
      dbPath,
      (target) => {
        // A damaged index is quarantined (never deleted); restore the last good backup if there is one.
        if (existsSync(bak)) {
          try {
            copyFileSync(bak, target)
            log.warn('media: restored media.db from media.db.bak')
          } catch (e) {
            log.error('media: restoring media.db.bak failed', e)
          }
        }
      },
      'media.db'
    )
    if (rec.recovered) log.error(`media: media.db was damaged; kept as ${rec.quarantinedTo}`)
    lib = new MediaLibrary({ dir, decoder: electronMediaDecoder })
    const swept = lib.sweepTemp()
    const purged = lib.purge()
    // One backup per day of a healthy index (cheap: the file is small).
    try {
      const stale = !existsSync(bak) || Date.now() - statSync(bak).mtimeMs > 24 * 3600 * 1000
      if (stale) {
        lib.db.pragma('wal_checkpoint(TRUNCATE)')
        copyFileSync(dbPath, bak)
      }
    } catch (e) {
      log.warn('media: backup of media.db skipped', e)
    }
    log.info(`media: library open at ${dir} (${lib.count().items} items; swept ${swept} temp files, purged ${purged.purged})`)
  } catch (e) {
    unavailable = e instanceof MediaDbTooNewError ? e.message : MEDIA_MESSAGES['library-unavailable']
    log.error('media: library could not be opened', e)
    lib = null
  }
  return lib
}

export function closeMediaLibrary(): void {
  disposeMediaDecoder()
  if (lib) {
    try {
      lib.close()
    } catch {
      /* closing at quit */
    }
    lib = null
  }
}

function freeBytes(dir: string): number | null {
  try {
    const s = statfsSync(dir)
    return Number(s.bavail) * Number(s.bsize)
  } catch {
    return null
  }
}

const unavailableResult = (path = ''): MediaImportResult => ({ ok: false, code: 'library-unavailable', message: unavailable ?? MEDIA_MESSAGES['library-unavailable'], path })

const CONTENT_TYPE: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif' }

function registerMediaProtocol(): void {
  protocol.handle('born-media', async (req) => {
    const notFound = new Response('not found', { status: 404 })
    try {
      const u = new URL(req.url)
      const parts = u.pathname.split('/').filter(Boolean)
      const l = getMediaLibrary()
      if (!l) return notFound
      const id = u.hostname === 'thumb' || u.hostname === 'file' || u.hostname === 'display' ? parts[0] : ''
      if (!/^m_[0-9a-f]{12}$/.test(id)) return notFound
      if (u.hostname === 'display') {
        const d = await l.display(id)
        if (!d || !existsSync(d.path)) return notFound
        return new Response(readFileSync(d.path), { headers: { 'content-type': d.type, 'cache-control': 'no-store' } })
      }
      if (u.hostname === 'thumb') {
        const w = parts[1] === '960' ? 960 : 320
        const p = await l.thumbnail(id, w)
        if (!p || !existsSync(p)) return notFound
        return new Response(readFileSync(p), { headers: { 'content-type': p.endsWith('.png') ? 'image/png' : 'image/jpeg', 'cache-control': 'private, max-age=3600' } })
      }
      const rec = l.get(id)
      const p = rec ? l.resolvePath(rec) : null
      if (!rec || !p || !existsSync(p)) return notFound
      const r = await net.fetch(pathToFileURL(p).href)
      return new Response(r.body, { headers: { 'content-type': CONTENT_TYPE[rec.ext] ?? 'application/octet-stream', 'cache-control': 'no-store' } })
    } catch (e) {
      log.warn('born-media protocol error', e)
      return notFound
    }
  })
}

export function registerMediaIpc(getMain: () => BrowserWindow | null): void {
  registerMediaProtocol()
  const need = <T>(fn: (l: MediaLibrary) => T, fallback: T): T => {
    const l = getMediaLibrary()
    return l ? fn(l) : fallback
  }

  ipcMain.handle('media:info', () => {
    const l = getMediaLibrary()
    if (!l) return { available: false, message: unavailable, dir: mediaDir() }
    const c = l.count()
    return { available: true, dir: l.dir, items: c.items, bytesManaged: c.bytesManaged, trashed: c.trashed, freeBytes: freeBytes(l.dir) }
  })
  ipcMain.handle('media:list', (_e, q: ListQuery | undefined) => need((l) => l.list(q ?? {}), [] as MediaRecord[]))
  ipcMain.handle('media:get', (_e, id: string) => need((l) => l.get(id), null))
  ipcMain.handle('media:tags', () => need((l) => l.allTags(), []))
  ipcMain.handle('media:folders', () => need((l) => l.listFolders(), []))
  ipcMain.handle('media:check-all', () => need((l) => l.checkAll(), []))
  ipcMain.handle('media:check', (_e, id: string) => need((l) => l.check(id), 'missing' as const))
  ipcMain.handle('media:thumb-path', (_e, id: string, w?: number) => need((l) => l.thumbnail(id, w === 960 ? 960 : 320), Promise.resolve(null)))

  const runImport = async (paths: string[], opts: ImportOptions): Promise<{ results: MediaImportResult[]; skipped: number }> => {
    const l = getMediaLibrary()
    if (!l) return { results: paths.map(unavailableResult), skipped: 0 }
    const win = getMain()
    const out = await l.importPaths(paths, opts, (p) => win?.webContents.send('media:import-progress', p))
    return out
  }
  ipcMain.handle('media:import-paths', (_e, paths: string[], opts?: ImportOptions) => runImport(Array.isArray(paths) ? paths.filter((p) => typeof p === 'string') : [], opts ?? {}))
  ipcMain.handle('media:pick-and-import', async (_e, opts?: ImportOptions & { folders?: boolean }) => {
    const win = getMain()
    const props: Array<'openFile' | 'openDirectory' | 'multiSelections'> = [opts?.folders ? 'openDirectory' : 'openFile', 'multiSelections']
    const r = await dialog.showOpenDialog(win ?? (undefined as never), {
      title: opts?.folders ? 'Add a folder of pictures' : 'Add pictures',
      properties: props,
      filters: opts?.folders ? undefined : [{ name: 'Pictures', extensions: IMAGE_EXTENSIONS }]
    })
    if (r.canceled || r.filePaths.length === 0) return { canceled: true, results: [], skipped: 0 }
    return { canceled: false, ...(await runImport(r.filePaths, opts ?? {})) }
  })

  ipcMain.handle('media:rename', (_e, id: string, name: string) => need((l) => (l.rename(id, name), true), false))
  ipcMain.handle('media:favorite', (_e, id: string, fav: boolean) => need((l) => (l.setFavorite(id, !!fav), true), false))
  ipcMain.handle('media:set-tags', (_e, id: string, tags: string[]) => need((l) => (l.setTags(id, tags), true), false))
  ipcMain.handle('media:move', (_e, ids: string[], folderId: string | null) => need((l) => (l.moveToFolder(ids, folderId), true), false))
  ipcMain.handle('media:mark-used', (_e, id: string) => need((l) => (l.markUsed(id), true), false))
  ipcMain.handle('media:remove', (_e, ids: string[]) => need((l) => (l.remove(ids), true), false))
  ipcMain.handle('media:restore', (_e, ids: string[]) => need((l) => l.restore(ids), [] as MediaRecord[]))
  ipcMain.handle('media:purge-now', () => need((l) => l.purge(0), { purged: 0, filesDeleted: 0 }))
  ipcMain.handle('media:folder-create', (_e, name: string, parentId?: string | null) => need((l) => l.createFolder(name, parentId ?? null), null))
  ipcMain.handle('media:folder-rename', (_e, id: string, name: string) => need((l) => (l.renameFolder(id, name), true), false))
  ipcMain.handle('media:folder-delete', (_e, id: string) => need((l) => (l.deleteFolder(id), true), false))
  // A picture pasted from the clipboard (e.g. a screenshot): written to a temp file, imported, temp removed.
  ipcMain.handle('media:import-buffer', async (_e, name: string, bytes: ArrayBuffer, opts?: ImportOptions) => {
    const l = getMediaLibrary()
    if (!l) return unavailableResult()
    if (!(bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(bytes)) return { ok: false, code: 'io', message: MEDIA_MESSAGES.io, path: '' } as MediaImportResult
    const dir = mkdtempSync(join(tmpdir(), 'born-paste-'))
    try {
      const safe = (name || 'Pasted picture.png').replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 80)
      const p = join(dir, safe)
      writeFileSync(p, Buffer.from(bytes as ArrayBuffer))
      return await l.importFile(p, opts ?? {})
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  // Make sure a picture can be put on a screen right now (a large one gets its screen-sized copy built).
  ipcMain.handle('media:prepare-display', async (_e, id: string) => {
    const l = getMediaLibrary()
    if (!l || typeof id !== 'string') return { ok: false, status: 'missing' as const }
    const status = l.check(id)
    if (status !== 'ok') return { ok: false, status }
    const d = await l.display(id)
    return d ? { ok: true, status } : { ok: false, status: 'unreadable' as const }
  })
  // PDF import: the file dialog and the read live here; the page rendering is done in the window (pdfImport.ts).
  // Dev/test only (like BORN_USER_DATA_DIR): BORN_TEST_PICK_PDF=<file> answers the picker without a dialog,
  // so automated runs can drive the real import. Unset in every normal run.
  let testPdfPath = process.env.BORN_TEST_PICK_PDF || ''
  ipcMain.handle('media:pick-pdf', async () => {
    if (testPdfPath) {
      const p = testPdfPath
      try {
        const buf = readFileSync(p)
        return { canceled: false, name: p.split(/[\\/]/).pop(), bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }
      } catch {
        return { canceled: false, error: 'io', name: p.split(/[\\/]/).pop() }
      }
    }
    const r = await dialog.showOpenDialog(getMain() ?? (undefined as never), { title: 'Choose a PDF', properties: ['openFile'], filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (r.canceled || !r.filePaths[0]) return { canceled: true }
    const p = r.filePaths[0]
    try {
      const st = statSync(p)
      if (st.size > 200 * 1024 * 1024) return { canceled: false, error: 'too-large', name: p.split(/[\\/]/).pop() }
      const buf = readFileSync(p)
      return { canceled: false, name: p.split(/[\\/]/).pop(), bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }
    } catch {
      return { canceled: false, error: 'io', name: p.split(/[\\/]/).pop() }
    }
  })
  ipcMain.handle('media:test-set-pdf', (_e, path: string) => {
    if (!process.env.BORN_TEST_PICK_PDF && !process.env.BORN_TEST_ALLOW_SET_PDF) return false
    testPdfPath = String(path || '')
    return true
  })
  ipcMain.handle('media:reveal', (_e, id: string) => {
    const l = getMediaLibrary()
    const rec = l?.get(id)
    const p = rec && l ? l.resolvePath(rec) : null
    if (p && existsSync(p)) shell.showItemInFolder(p)
    return !!p
  })
  ipcMain.handle('media:relink-pick', async (_e, id: string) => {
    const l = getMediaLibrary()
    if (!l) return { ok: false, message: unavailable ?? MEDIA_MESSAGES['library-unavailable'] }
    const r = await dialog.showOpenDialog(getMain() ?? (undefined as never), { title: 'Find the picture', properties: ['openFile'], filters: [{ name: 'Pictures', extensions: IMAGE_EXTENSIONS }] })
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true }
    return l.relink(id, r.filePaths[0])
  })
}

/** For the Graphics (OBS/browser) output: resolves `/media/<id>/display` to a file. */
export async function resolveMediaForHttp(id: string): Promise<{ path: string; type: string } | null> {
  if (!/^m_[0-9a-f]{12}$/.test(id)) return null
  const l = getMediaLibrary()
  if (!l || l.check(id) !== 'ok') return null
  return l.display(id)
}
