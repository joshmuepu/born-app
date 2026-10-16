/**
 * packService.ts — the Electron side of service packs: file dialogs, progress events and cancel.
 * All the real work (and all the safety) is in servicePack.ts, which is tested without Electron.
 */
import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { statfsSync } from 'fs'
import { basename } from 'path'
import { log } from './logger'
import { testHook } from './testHooks'
import { getMediaLibrary } from './mediaService'
import { estimatePack, exportPack, importPack, inspectPack, type PackSettings } from './servicePack'
import { PACK_EXTENSION, PACK_MESSAGES } from '../shared/servicePack'
import type { QueueItem } from '../shared/queueItem'

let current: AbortController | null = null
/** The only pack file the renderer may ask to import: the one the user just chose and reviewed. */
let reviewedPath: string | null = null

const asQueue = (raw: unknown): QueueItem[] => (Array.isArray(raw) ? (raw.filter((x) => typeof x === 'object' && x !== null) as QueueItem[]) : [])
const unavailable = { ok: false as const, code: 'io' as const, message: "BORN's media library could not be opened. Your service files are not affected." }

export function registerPackIpc(getMain: () => BrowserWindow | null, getSettings: () => PackSettings): void {
  const win = (): BrowserWindow | undefined => getMain() ?? undefined
  const send = (ch: string, p: unknown): void => { try { getMain()?.webContents.send(ch, p) } catch { /* window closing */ } }
  const free = (dir: string): number | null => { try { const s = statfsSync(dir); return Number(s.bavail) * Number(s.bsize) } catch { return null } }

  ipcMain.handle('pack:estimate', (_e, rawQueue: unknown) => {
    const l = getMediaLibrary()
    if (!l) return null
    return estimatePack(l, asQueue(rawQueue), getSettings(), free(app.getPath('documents')))
  })

  ipcMain.handle('pack:export', async (_e, rawQueue: unknown, title: string) => {
    const l = getMediaLibrary()
    if (!l) return unavailable
    if (current) return { ok: false, code: 'io', message: 'A service pack is already being saved or opened.' }
    const base = (typeof title === 'string' && title.trim() ? title.trim() : 'Sunday service').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 80)
    // BORN_TEST_PACK_SAVE=<file>: answers the save dialog in dev/test runs only (never in an installed app)
    const testSave = testHook('BORN_TEST_PACK_SAVE', app.isPackaged)
    const r = testSave
      ? { canceled: false, filePath: testSave }
      : await dialog.showSaveDialog(win() as BrowserWindow, {
          title: 'Save service with pictures',
          defaultPath: `${base}.${PACK_EXTENSION}`,
          filters: [{ name: 'BORN service pack', extensions: [PACK_EXTENSION] }]
        })
    if (r.canceled || !r.filePath) return { ok: false, code: 'cancelled', message: PACK_MESSAGES.cancelled, canceled: true }
    const dest = r.filePath.toLowerCase().endsWith(`.${PACK_EXTENSION}`) ? r.filePath : `${r.filePath}.${PACK_EXTENSION}`
    current = new AbortController()
    try {
      const out = await exportPack(l, asQueue(rawQueue), {
        dest,
        title: basename(dest).replace(new RegExp(`\\.${PACK_EXTENSION}$`, 'i'), ''),
        appVersion: app.getVersion(),
        settings: getSettings(),
        signal: current.signal,
        onProgress: (p) => send('pack:progress', { kind: 'export', ...p })
      })
      log.info(`pack:export ${out.ok ? `ok ${out.count} pictures ${out.bytes} bytes` : `failed ${out.code}`}`)
      return out
    } finally {
      current = null
    }
  })

  ipcMain.handle('pack:pick-and-inspect', async () => {
    const l = getMediaLibrary()
    if (!l) return unavailable
    if (current) return { ok: false, code: 'io', message: 'A service pack is already being saved or opened.' }
    const testOpen = testHook('BORN_TEST_PACK_OPEN', app.isPackaged)
    const r = testOpen
      ? { canceled: false, filePaths: [testOpen] }
      : await dialog.showOpenDialog(win() as BrowserWindow, {
          title: 'Open service pack',
          filters: [{ name: 'BORN service pack', extensions: [PACK_EXTENSION] }],
          properties: ['openFile']
        })
    if (r.canceled || !r.filePaths[0]) return { ok: false, code: 'cancelled', message: PACK_MESSAGES.cancelled, canceled: true }
    return inspect(l, r.filePaths[0])
  })

  const inspect = async (l: NonNullable<ReturnType<typeof getMediaLibrary>>, path: string): Promise<unknown> => {
    current = new AbortController()
    try {
      const out = await inspectPack(l, path, { signal: current.signal, onProgress: (done, total) => send('pack:progress', { kind: 'check', done, total }) })
      reviewedPath = out.ok ? path : null
      log.info(`pack:inspect ${out.ok ? 'ok' : `failed ${out.code}`}`)
      return out
    } finally {
      current = null
    }
  }

  // A .bornpack dropped on the window: read-only review, exactly like choosing it in the Open dialog.
  ipcMain.handle('pack:inspect-path', async (_e, path: string) => {
    const l = getMediaLibrary()
    if (!l) return unavailable
    if (typeof path !== 'string' || !path.toLowerCase().endsWith(`.${PACK_EXTENSION}`)) return { ok: false, code: 'not-a-pack', message: PACK_MESSAGES['not-a-pack'] }
    if (current) return { ok: false, code: 'io', message: 'A service pack is already being saved or opened.' }
    return inspect(l, path)
  })

  ipcMain.handle('pack:import', async (_e, path: string) => {
    const l = getMediaLibrary()
    if (!l) return unavailable
    if (!reviewedPath || path !== reviewedPath) return { ok: false, code: 'io', message: 'Choose the pack again.' }
    if (current) return { ok: false, code: 'io', message: 'A service pack is already being saved or opened.' }
    current = new AbortController()
    try {
      const out = await importPack(l, reviewedPath, { signal: current.signal, onProgress: (p) => send('pack:progress', { kind: p.phase === 'checking' ? 'check' : 'import', done: p.done, total: p.total }) })
      log.info(`pack:import ${out.ok ? `ok added ${out.summary.added}` : `failed ${out.code}`}`)
      return out
    } finally {
      current = null
    }
  })

  ipcMain.on('pack:cancel', () => current?.abort())
}
