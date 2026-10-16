/**
 * mediaDecoder.ts — the Electron implementation of MediaDecoder.
 *
 * Decoding happens in a hidden, sandboxed renderer (Chromium's own image
 * decoders: they honour EXIF rotation, reject cut-off files, and downscale as
 * they decode). This is also the place a bad picture is caught: a file that
 * will not decode never becomes a library item. Measured on a 50-megapixel
 * JPEG: ~60 ms and no visible memory spike (spike notes in
 * docs/design/media/spikes/7-real-world-files.md and the Step 2 report).
 *
 * HEIC/TIFF are not decodable by Chromium; they are converted to JPEG by a small
 * bundled decoder in a worker thread (imageConvert.ts), the same on every OS.
 */
import { BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { log } from './logger'
import { convertInWorker } from './heicConvert'
import type { DecodeResult, MediaDecoder } from './mediaLibrary'

let win: BrowserWindow | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
let queue: Promise<unknown> = Promise.resolve()
let pagePath: string | null = null

function ensurePage(): string {
  if (pagePath && existsSync(pagePath)) return pagePath
  const dir = mkdtempSync(join(tmpdir(), 'born-media-'))
  pagePath = join(dir, 'decode.html')
  writeFileSync(pagePath, '<!doctype html><meta charset="utf-8"><title>born media decoder</title>')
  return pagePath
}

async function getWindow(): Promise<BrowserWindow> {
  if (win && !win.isDestroyed()) return win
  win = new BrowserWindow({
    show: false,
    width: 320,
    height: 240,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  })
  win.on('closed', () => {
    win = null
  })
  await win.loadFile(ensurePage())
  return win
}

function scheduleIdleClose(): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (win && !win.isDestroyed()) win.destroy()
    win = null
  }, 60_000)
}

/** Runs in the hidden page. Kept as one string so it is easy to read and has no build step. */
const DECODE_FN = `async (url, widths, needNatural) => {
  try {
    const blob = await (await fetch(url)).blob()
    const out = []
    let natW = 0, natH = 0, alpha = false
    for (let i = 0; i < widths.length; i++) {
      const bm = await createImageBitmap(blob, { imageOrientation: 'from-image', resizeWidth: widths[i], resizeQuality: 'medium' })
      const c = new OffscreenCanvas(bm.width, bm.height)
      const g = c.getContext('2d')
      g.drawImage(bm, 0, 0)
      if (i === 0) {
        const d = g.getImageData(0, 0, bm.width, bm.height).data
        for (let p = 3; p < d.length; p += 4 * 7) { if (d[p] < 250) { alpha = true; break } }
      }
      const type = alpha ? 'image/png' : 'image/jpeg'
      const o = await c.convertToBlob(alpha ? { type } : { type, quality: 0.84 })
      const buf = new Uint8Array(await o.arrayBuffer())
      let s = ''
      for (let k = 0; k < buf.length; k += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(k, k + 0x8000))
      out.push({ w: bm.width, h: bm.height, ext: alpha ? 'png' : 'jpg', b64: btoa(s) })
      bm.close()
    }
    if (needNatural) {
      // formats whose header we cannot read here (AVIF): ask an <img>, which applies EXIF rotation
      const u = URL.createObjectURL(blob)
      const img = new Image()
      img.src = u
      try { await img.decode() } catch (e) {}
      natW = img.naturalWidth; natH = img.naturalHeight
      URL.revokeObjectURL(u)
    }
    return { ok: true, natW, natH, alpha, thumbs: out }
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) }
  }
}`

// ── video: prove one frame decodes here, and make the poster ──────────────────
//
// Its own hidden window, because drawing a frame of a local file onto a canvas needs web security off (a file:// video taints the
// canvas otherwise). The window never loads anything but this blank page and one local video; it has no Node, is sandboxed, and is
// closed after a minute idle.
let vwin: BrowserWindow | null = null
let vIdle: ReturnType<typeof setTimeout> | null = null

async function getVideoWindow(): Promise<BrowserWindow> {
  if (vwin && !vwin.isDestroyed()) return vwin
  vwin = new BrowserWindow({
    show: false,
    width: 320,
    height: 240,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, webSecurity: false, autoplayPolicy: 'no-user-gesture-required' }
  })
  vwin.on('closed', () => { vwin = null })
  await vwin.loadFile(ensurePage())
  return vwin
}
function scheduleVideoIdleClose(): void {
  if (vIdle) clearTimeout(vIdle)
  vIdle = setTimeout(() => {
    if (vwin && !vwin.isDestroyed()) vwin.destroy()
    vwin = null
  }, 60_000)
}

const DECODE_VIDEO_FN = `async (url, widths) => {
  const v = document.createElement('video')
  try {
    v.muted = true; v.preload = 'auto'; v.playsInline = true
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timed out opening the video')), 25000)
      v.onloadeddata = () => { clearTimeout(t); res() }
      v.onerror = () => { clearTimeout(t); rej(new Error('media error ' + (v.error ? v.error.code + ' ' + v.error.message : ''))) }
      v.src = url
    })
    const dur = v.duration
    if (!isFinite(dur) || dur <= 0) throw new Error('the video has no length')
    const at = Math.min(1, dur * 0.1)
    if (at > 0.05) {
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('timed out seeking')), 25000)
        v.onseeked = () => { clearTimeout(t); res() }
        v.onerror = () => { clearTimeout(t); rej(new Error('seek error ' + (v.error ? v.error.code : ''))) }
        v.currentTime = at
      })
    }
    const w = v.videoWidth, h = v.videoHeight
    if (!w || !h) throw new Error('the video has no picture')
    const out = []
    for (const tw of widths) {
      const sw = Math.min(tw, w), sh = Math.max(1, Math.round(h * sw / w))
      const c = new OffscreenCanvas(sw, sh)
      c.getContext('2d').drawImage(v, 0, 0, sw, sh)
      const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.84 })
      const buf = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (let k = 0; k < buf.length; k += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(k, k + 0x8000))
      out.push({ w: sw, h: sh, ext: 'jpg', b64: btoa(s) })
    }
    return { ok: true, w, h, duration: dur, thumbs: out }
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) }
  } finally {
    try { v.removeAttribute('src'); v.load() } catch (e) {}
  }
}`

export const electronMediaDecoder: MediaDecoder = {
  decode(path, thumbWidths, opts) {
    const job = queue.then(async (): Promise<DecodeResult> => {
      try {
        const w = await getWindow()
        const r = (await w.webContents.executeJavaScript(`(${DECODE_FN})(${JSON.stringify(pathToFileURL(path).href)}, ${JSON.stringify(thumbWidths)}, ${opts?.needNatural ? 'true' : 'false'})`)) as
          | { ok: true; natW: number; natH: number; alpha: boolean; thumbs: Array<{ w: number; h: number; ext: 'jpg' | 'png'; b64: string }> }
          | { ok: false; error: string }
        scheduleIdleClose()
        if (!r.ok) {
          const m = r.error.toLowerCase()
          if (m.includes('could not be decoded') || m.includes('decode') || m.includes('invalid')) return { ok: false, reason: 'corrupt', detail: r.error }
          return { ok: false, reason: 'io', detail: r.error }
        }
        const nat = r.natW > 0 ? { w: r.natW, h: r.natH } : { w: 0, h: 0 }
        return {
          ok: true,
          width: nat.w,
          height: nat.h,
          hasAlpha: r.alpha,
          thumbs: r.thumbs.map((t) => ({ width: t.w, height: t.h, ext: t.ext, data: Buffer.from(t.b64, 'base64') }))
        }
      } catch (e) {
        log.warn('mediaDecoder: decode threw', e)
        return { ok: false, reason: 'io', detail: (e as Error).message }
      }
    })
    queue = job.catch(() => undefined)
    return job
  },

  decodeVideo(path, thumbWidths) {
    const job = queue.then(async () => {
      try {
        const w = await getVideoWindow()
        const r = (await w.webContents.executeJavaScript(`(${DECODE_VIDEO_FN})(${JSON.stringify(pathToFileURL(path).href)}, ${JSON.stringify(thumbWidths)})`)) as
          | { ok: true; w: number; h: number; duration: number; thumbs: Array<{ w: number; h: number; ext: 'jpg' | 'png'; b64: string }> }
          | { ok: false; error: string }
        scheduleVideoIdleClose()
        if (!r.ok) {
          log.warn(`mediaDecoder: video did not decode: ${r.error}`)
          return { ok: false as const, reason: 'undecodable' as const, detail: r.error }
        }
        return {
          ok: true as const,
          width: r.w,
          height: r.h,
          duration: r.duration,
          hasAudio: null,
          thumbs: r.thumbs.map((t) => ({ width: t.w, height: t.h, ext: t.ext, data: Buffer.from(t.b64, 'base64') }))
        }
      } catch (e) {
        log.warn('mediaDecoder: video decode threw', e)
        return { ok: false as const, reason: 'io' as const, detail: (e as Error).message }
      }
    })
    queue = job.catch(() => undefined)
    return job
  },

  /**
   * One conversion path on every OS: libheif/UTIF in a worker thread (see imageConvert.ts). On macOS only, if that
   * cannot read a HEIC file, the system's own `sips` gets a second try — the OS knows more HEIC variants than libheif
   * (some HDR and depth files), at no cost to anyone else.
   */
  async convertToJpeg(path, outPath) {
    const r = await convertInWorker(path, outPath)
    if (r.ok) return { ok: true, notes: r.notes }
    if (process.platform === 'darwin' && (r.reason === 'unsupported' || r.reason === 'corrupt')) {
      const viaOs = await new Promise<boolean>((resolve) => {
        execFile('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', path, '--out', outPath], { timeout: 60_000 }, (err) => resolve(!err))
      })
      if (viaOs) return { ok: true, notes: [] }
    }
    log.warn(`mediaDecoder: conversion failed (${r.reason}) ${r.detail ?? ''}`)
    return { ok: false, reason: r.reason }
  }
}

/** Free the hidden window (app quit, or a test). */
export function disposeMediaDecoder(): void {
  if (idleTimer) clearTimeout(idleTimer)
  if (win && !win.isDestroyed()) win.destroy()
  win = null
  if (vIdle) clearTimeout(vIdle)
  if (vwin && !vwin.isDestroyed()) vwin.destroy()
  vwin = null
  if (pagePath) {
    try {
      rmSync(join(pagePath, '..'), { recursive: true, force: true })
    } catch { /* ignore */ }
    pagePath = null
  }
}
