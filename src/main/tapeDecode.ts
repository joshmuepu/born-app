/**
 * tapeDecode.ts — turns an M4A recording into a 16 kHz mono WAV for the automatic timing, with no separate audio program: the index is read here, the
 * compressed frames go to a hidden window (the same browser engine that plays the tape) in batches, and the decoded sound comes back and is written out.
 * A 2½-hour recording takes about a minute and the file is never held whole.
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import { closeSync, fstatSync, openSync, readSync, writeSync } from 'fs'
import { join } from 'path'
import { findMoov, parseMp4Audio } from '../shared/mp4Audio'
import { wavHeader } from '../shared/resample'
import { log } from './logger'

type Out = { jobId: number; pcm?: ArrayBuffer; error?: string }
let win: BrowserWindow | null = null
let ready: Promise<void> | null = null
let readyResolve: (() => void) | null = null
let jobCounter = 0
let waiting: { jobId: number; resolve: (o: Out) => void } | null = null

ipcMain.on('tape:decode-ready', () => { readyResolve?.() })
ipcMain.on('tape:decode-out', (_e, m: Out) => { if (waiting && waiting.jobId === m.jobId) { const w = waiting; waiting = null; w.resolve(m) } })

function ensureWindow(): Promise<void> {
  if (win && !win.isDestroyed() && ready) return ready
  ready = new Promise<void>((resolve) => { readyResolve = resolve })
  win = new BrowserWindow({
    show: false,
    width: 200,
    height: 100,
    title: 'BORN tape decoder',
    webPreferences: { preload: join(app.getAppPath(), 'out', 'preload', 'index.js'), contextIsolation: true, sandbox: false, backgroundThrottling: false }
  })
  const dev = process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']
  if (dev) void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/decode.html`)
  else void win.loadFile(join(app.getAppPath(), 'out', 'renderer', 'decode.html')) // not __dirname: this file may be a lazily loaded chunk
  return ready
}

function closeWindow(): void {
  try { win?.destroy() } catch { /* already gone */ }
  win = null
  ready = null
}

const BATCH = 400 // frames per round trip (about 9 s of sound)

export type DecodeOutcome = { ok: true; samples: number } | { ok: false; message: string; canceled?: boolean }

/** `isCanceled` is polled between batches. */
export async function decodeM4aToWav16k(path: string, wavPath: string, onProgress: (pct: number) => void, isCanceled: () => boolean): Promise<DecodeOutcome> {
  let fd = -1
  let out = -1
  try {
    fd = openSync(path, 'r')
    const size = fstatSync(fd).size
    const read = (pos: number, len: number): Buffer => {
      const b = Buffer.alloc(Math.max(0, Math.min(len, size - pos)))
      if (b.length) readSync(fd, b, 0, b.length, pos)
      return b
    }
    const at = findMoov(read, size)
    const track = at ? parseMp4Audio(read(at.start, at.length)) : null
    if (!track) return { ok: false, message: 'This recording’s sound could not be read for automatic timing (only AAC / M4A is read this way).' }
    log.info(`tape decode: ${track.codec} ${track.sampleRate} Hz x${track.channels}, asc ${Buffer.from(track.description).toString('hex')}, ${track.frames.length} frames`)
    await Promise.race([ensureWindow(), new Promise<never>((_r, rej) => setTimeout(() => rej(new Error('The decoder window did not start.')), 20000))])
    const jobId = ++jobCounter
    out = openSync(wavPath, 'w')
    writeSync(out, wavHeader(0))
    let samples = 0
    const send = (m: Record<string, unknown>): void => { win?.webContents.send('tape:decode', { jobId, ...m }) }
    send({ type: 'begin', config: { codec: track.codec, sampleRate: track.sampleRate, channels: track.channels, description: track.description } })
    for (let i = 0; i < track.frames.length; i += BATCH) {
      if (isCanceled()) return { ok: false, message: 'Canceled.', canceled: true }
      const slice = track.frames.slice(i, i + BATCH)
      const bufs = slice.map((f) => { const b = read(f.offset, f.size); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length) })
      const reply = new Promise<Out>((resolve) => { waiting = { jobId, resolve } })
      send({ type: 'frames', frames: bufs, first: i })
      const r = await Promise.race([reply, new Promise<Out>((resolve) => setTimeout(() => resolve({ jobId, error: 'The decoder stopped answering.' }), 60000))])
      if (r.error || !r.pcm) return { ok: false, message: `The recording’s sound could not be decoded (${r.error ?? 'no sound came back'}).` }
      const buf = Buffer.from(r.pcm)
      writeSync(out, buf)
      samples += buf.length / 2
      onProgress(Math.min(100, Math.round(((i + slice.length) / track.frames.length) * 100)))
    }
    send({ type: 'end' })
    writeSync(out, wavHeader(samples), 0, 44, 0)
    return { ok: true, samples }
  } catch (e) {
    log.warn(`tape decode: ${String(e)}`)
    return { ok: false, message: `The recording’s sound could not be decoded (${(e as Error).message}).` }
  } finally {
    waiting = null
    if (fd >= 0) try { closeSync(fd) } catch { /* nothing to do */ }
    if (out >= 0) try { closeSync(out) } catch { /* nothing to do */ }
    closeWindow()
  }
}
