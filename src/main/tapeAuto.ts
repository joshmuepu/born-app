/**
 * tapeAuto.ts — times a recording by itself, in the background, so nobody has to. When an English recording is added or downloaded (or found untimed
 * when the app starts) it joins a queue; one at a time it is decoded, listened to and matched against the sermon's numbered paragraphs, and the
 * result is saved as an automatic timing. The tape plays the whole time — the text only starts following once its timing is saved.
 * It never touches what is live and it runs at low priority so a service is not affected.
 */
import { BrowserWindow } from 'electron'
import { log } from './logger'
import { alignRecording, cancelAlign, type AlignProgress } from './tapeAligner'
import { bundledTools } from './tapeTools'
import type { TapeDb } from './tapeDb'
import type { TapeLibrary } from './tapeLibrary'

export interface AutoTimingState {
  /** the recording being timed now */
  active: { id: string; phase: AlignProgress['phase']; pct: number } | null
  /** waiting their turn */
  queued: string[]
  /** whether the recogniser is present at all */
  available: boolean
}
export interface AutoTimingDone { recordingId: string; ok: boolean; located: number; paragraphs: number; message: string }

interface Deps {
  db: () => TapeDb | null
  lib: () => TapeLibrary | null
  paragraphs: (sermonId: number) => Promise<Array<{ n: number; text: string }>>
}
let deps: Deps | null = null
const queue: string[] = []
let active: AutoTimingState['active'] = null
let working = false
let stopRequested = false
const failed = new Set<string>() // not retried again this run

export function initAutoTiming(d: Deps): void { deps = d }

export function autoTimingState(): AutoTimingState {
  return { active, queued: [...queue], available: !!bundledTools() }
}
function send(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload)
}
const publish = (): void => send('tape:timing', autoTimingState())

/** Is this recording one that can be timed on its own? (English, has a sound file, nothing timed yet) */
export function wantsTiming(id: string): boolean {
  const db = deps?.db()
  const rec = db?.getRecording(id)
  if (!db || !rec || rec.language !== 'en' || rec.synced || failed.has(id)) return false
  return true
}

export function enqueueTiming(id: string): boolean {
  if (!deps || !wantsTiming(id) || queue.includes(id) || active?.id === id || !bundledTools()) return false
  queue.push(id)
  publish()
  void pump()
  return true
}

/** At start: every untimed English recording waits its turn (a short delay so starting up stays quick). */
export function enqueueUntimed(): void {
  setTimeout(() => {
    for (const r of deps?.db()?.listAll() ?? []) enqueueTiming(r.id)
  }, 15000).unref()
}

export function forgetFailure(id: string): void { failed.delete(id) }

export function cancelAutoTiming(id?: string): void {
  if (id) {
    const i = queue.indexOf(id)
    if (i >= 0) queue.splice(i, 1)
    failed.add(id)
    if (active?.id === id) cancelAlign()
  } else {
    queue.length = 0
    stopRequested = true
    cancelAlign()
  }
  publish()
}

async function pump(): Promise<void> {
  if (working || !deps) return
  working = true
  try {
    while (queue.length && !stopRequested) {
      const id = queue.shift()!
      await timeOne(id)
    }
  } finally {
    working = false
    stopRequested = false
    active = null
    publish()
  }
}

async function timeOne(id: string): Promise<void> {
  const d = deps!
  const db = d.db()
  const rec = db?.getRecording(id)
  const path = rec ? d.lib()?.resolvePath(rec.file) : null
  const tools = bundledTools()
  if (!db || !rec || !path || !tools || rec.synced) return
  active = { id, phase: 'prepare', pct: 0 }
  publish()
  let lastSent = 0
  try {
    const paras = await d.paragraphs(rec.sermonId)
    if (!paras.length) { failed.add(id); return }
    const r = await alignRecording(path, paras, tools, (p) => {
      active = { id, phase: p.phase, pct: p.pct }
      const now = Date.now()
      if (now - lastSent > 1000) { lastSent = now; publish() }
    }, { lowPriority: true })
    if (!r.ok) {
      if (!r.canceled) failed.add(id)
      log.warn(`auto timing ${id}: ${r.message}`)
      if (!r.canceled) send('tape:timing-done', { recordingId: id, ok: false, located: 0, paragraphs: paras.length, message: r.message } satisfies AutoTimingDone)
      return
    }
    // it may have been timed by hand while this ran: never replace that
    if (db.getMap(id, null)) return
    if (!r.result.marks.length) { failed.add(id); send('tape:timing-done', { recordingId: id, ok: false, located: 0, paragraphs: paras.length, message: 'No words matching the sermon text were found in this recording.' } satisfies AutoTimingDone); return }
    db.saveMap(id, null, 'auto', r.result.marks, r.result.regions)
    log.info(`auto timing ${id}: ${r.result.stats.located}/${r.result.stats.paragraphs} paragraphs in ${Math.round(r.seconds)} s`)
    send('tape:timing-done', { recordingId: id, ok: true, located: r.result.stats.located, paragraphs: r.result.stats.paragraphs, message: '' } satisfies AutoTimingDone)
  } catch (e) {
    failed.add(id)
    log.warn(`auto timing ${id} failed: ${String(e)}`)
  }
}
