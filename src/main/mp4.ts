/**
 * mp4.ts — read what BORN needs to know about a video file straight from its MP4 boxes, with no FFmpeg and no
 * browser: container brand, video/audio codec, size, frame rate, duration, bitrate, and — importantly — whether the
 * file is WHOLE. A half-copied video (an unfinished download or cloud sync) looks fine in a file list and then stops
 * partway through on stage, so the top-level boxes must add up to exactly the length of the file and a `moov` index
 * must be present. Reads only the box headers and the `moov` box (a few KB), so a 2 GB file costs a few reads.
 * Nothing here trusts the browser's `canPlayType`; whether a frame really decodes is checked separately, by decoding one.
 */
import { closeSync, fstatSync, openSync, readSync } from 'fs'

export interface Mp4Info {
  ok: true
  /** major brand, e.g. `isom`, `mp42`, `M4V `, `qt  ` (QuickTime MOV) */
  brand: string
  compatible: string[]
  /** seconds; null when the file does not say (some fragmented recordings) — the browser's value is used then */
  durationSec: number | null
  width: number
  height: number
  /** frames per second when the index says, else null */
  fps: number | null
  /** video sample-entry code: `avc1`/`avc3` (H.264), `hvc1`/`hev1` (HEVC), `av01`, `vp09`, `apch`… */
  videoCodec: string | null
  /** audio sample-entry code: `mp4a` (AAC), `ac-3`, `Opus`, `alac`… */
  audioCodec: string | null
  hasAudio: boolean
  /** bits per second over the whole file, when the duration is known */
  bitrate: number | null
  /** the file is made of `moof` fragments (what a browser's recorder writes) */
  fragmented: boolean
  bytes: number
}
export type Mp4Fail = { ok: false; reason: 'not-mp4' | 'truncated' | 'corrupt' | 'no-video'; detail?: string }

interface Box { type: string; start: number; size: number; header: number }

/** Boxes in `buf` between [from, to): returns each box's type and range (size 0 = to the end, size 1 = 64-bit size). */
function boxesIn(buf: Buffer, from: number, to: number): Box[] {
  const out: Box[] = []
  let p = from
  while (p + 8 <= to) {
    let size = buf.readUInt32BE(p)
    const type = buf.toString('latin1', p + 4, p + 8)
    let header = 8
    if (size === 1) {
      if (p + 16 > to) break
      size = Number(buf.readBigUInt64BE(p + 8))
      header = 16
    } else if (size === 0) size = to - p
    if (size < header || p + size > to) break
    out.push({ type, start: p, size, header })
    p += size
  }
  return out
}
const child = (buf: Buffer, b: Box, type: string): Box | undefined => boxesIn(buf, b.start + b.header, b.start + b.size).find((x) => x.type === type)
const children = (buf: Buffer, b: Box, type: string): Box[] => boxesIn(buf, b.start + b.header, b.start + b.size).filter((x) => x.type === type)

export function probeMp4(path: string): Mp4Info | Mp4Fail {
  let fd: number | null = null
  try {
    fd = openSync(path, 'r')
    const size = fstatSync(fd).size
    const readAt = (pos: number, len: number): Buffer => {
      const b = Buffer.alloc(Math.max(0, Math.min(len, size - pos)))
      if (b.length) readSync(fd as number, b, 0, b.length, pos)
      return b
    }
    if (size < 16) return { ok: false, reason: 'not-mp4', detail: 'too small' }
    const head = readAt(0, 32)
    if (head.toString('latin1', 4, 8) !== 'ftyp') return { ok: false, reason: 'not-mp4', detail: 'no ftyp' }

    // 1. top-level boxes must add up to exactly the file length
    const top: Box[] = []
    let pos = 0
    while (pos + 8 <= size) {
      const h = readAt(pos, 16)
      let bsize = h.readUInt32BE(0)
      const type = h.toString('latin1', 4, 8)
      let header = 8
      if (bsize === 1) {
        if (h.length < 16) return { ok: false, reason: 'truncated' }
        bsize = Number(h.readBigUInt64BE(8))
        header = 16
      } else if (bsize === 0) bsize = size - pos
      if (bsize < header) return { ok: false, reason: 'corrupt', detail: `bad box at ${pos}` }
      if (pos + bsize > size) return { ok: false, reason: 'truncated', detail: `${type} runs past the end of the file` }
      top.push({ type, start: pos, size: bsize, header })
      pos += bsize
      if (top.length > 200000) return { ok: false, reason: 'corrupt', detail: 'too many boxes' }
    }
    if (pos < size) {
      const rest = readAt(pos, size - pos)
      if (rest.some((x) => x !== 0)) return { ok: false, reason: 'corrupt', detail: 'unexpected bytes after the last box' }
    }
    const moovBox = top.find((b) => b.type === 'moov')
    if (!moovBox) return { ok: false, reason: 'truncated', detail: 'no moov index (an unfinished recording or copy)' }
    if (moovBox.size > 64 * 1024 * 1024) return { ok: false, reason: 'corrupt', detail: 'moov too large' }
    if (!top.some((b) => b.type === 'mdat' || b.type === 'moof')) return { ok: false, reason: 'truncated', detail: 'no media data' }

    const ftyp = readAt(0, Math.min(top[0].size, 256))
    const brand = ftyp.toString('latin1', 8, 12)
    const compatible: string[] = []
    for (let o = 16; o + 4 <= ftyp.length; o += 4) compatible.push(ftyp.toString('latin1', o, o + 4))

    // 2. the index
    const moov = readAt(moovBox.start, moovBox.size)
    const m: Box = { type: 'moov', start: 0, size: moov.length, header: moovBox.header }
    let movieTimescale = 0
    let movieDuration = 0
    const mvhd = child(moov, m, 'mvhd')
    if (mvhd) {
      const o = mvhd.start + mvhd.header
      const v = moov[o]
      movieTimescale = v === 1 ? moov.readUInt32BE(o + 20) : moov.readUInt32BE(o + 12)
      movieDuration = v === 1 ? Number(moov.readBigUInt64BE(o + 24)) : moov.readUInt32BE(o + 16)
    }
    const mvex = child(moov, m, 'mvex')
    let fragDuration = 0
    let defaultSampleDuration = 0
    if (mvex) {
      const mehd = child(moov, mvex, 'mehd')
      if (mehd) {
        const o = mehd.start + mehd.header
        fragDuration = moov[o] === 1 ? Number(moov.readBigUInt64BE(o + 4)) : moov.readUInt32BE(o + 4)
      }
      const trex = child(moov, mvex, 'trex')
      if (trex) defaultSampleDuration = moov.readUInt32BE(trex.start + trex.header + 12)
    }

    let width = 0
    let height = 0
    let fps: number | null = null
    let videoCodec: string | null = null
    let audioCodec: string | null = null
    let videoDuration = 0
    for (const trak of children(moov, m, 'trak')) {
      const mdia = child(moov, trak, 'mdia')
      if (!mdia) continue
      const hdlr = child(moov, mdia, 'hdlr')
      const handler = hdlr ? moov.toString('latin1', hdlr.start + hdlr.header + 8, hdlr.start + hdlr.header + 12) : ''
      const mdhd = child(moov, mdia, 'mdhd')
      let ts = 0
      let dur = 0
      if (mdhd) {
        const o = mdhd.start + mdhd.header
        ts = moov[o] === 1 ? moov.readUInt32BE(o + 20) : moov.readUInt32BE(o + 12)
        dur = moov[o] === 1 ? Number(moov.readBigUInt64BE(o + 24)) : moov.readUInt32BE(o + 16)
      }
      const stbl = child(moov, child(moov, mdia, 'minf') ?? mdia, 'stbl')
      const stsd = stbl ? child(moov, stbl, 'stsd') : undefined
      let entry: Box | undefined
      if (stsd) entry = boxesIn(moov, stsd.start + stsd.header + 8, stsd.start + stsd.size)[0]
      if (handler === 'vide' && !videoCodec) {
        videoCodec = entry?.type ?? 'unknown'
        if (entry) {
          const eo = entry.start + entry.header
          if (moov.length >= eo + 28) {
            width = moov.readUInt16BE(eo + 24)
            height = moov.readUInt16BE(eo + 26)
          }
        }
        const tkhd = child(moov, trak, 'tkhd')
        if ((!width || !height) && tkhd) {
          const o = tkhd.start + tkhd.header
          const end = tkhd.start + tkhd.size
          width = Math.round(moov.readUInt32BE(end - 8) / 65536)
          height = Math.round(moov.readUInt32BE(end - 4) / 65536)
          void o
        }
        videoDuration = ts > 0 ? dur / ts : 0
        const stts = stbl ? child(moov, stbl, 'stts') : undefined
        if (stts && ts > 0) {
          const o = stts.start + stts.header + 4
          const n = moov.readUInt32BE(o)
          let samples = 0
          let ticks = 0
          for (let i = 0; i < n && o + 4 + i * 8 + 8 <= moov.length; i++) {
            const c = moov.readUInt32BE(o + 4 + i * 8)
            const d = moov.readUInt32BE(o + 8 + i * 8)
            samples += c
            ticks += c * d
          }
          if (samples > 0 && ticks > 0) fps = samples / (ticks / ts)
        }
        if (fps === null && defaultSampleDuration > 0 && ts > 0) fps = ts / defaultSampleDuration
      } else if (handler === 'soun' && !audioCodec) {
        audioCodec = entry?.type ?? 'unknown'
      }
    }
    if (!videoCodec) return { ok: false, reason: 'no-video', detail: 'the file has no video track' }
    // A fragmented file (a browser recording, a live-stream capture) puts only its first fragment's length in `mvhd`:
    // trust `mehd` there, or nothing — the decoder's own duration fills the gap at import.
    let durationSec: number | null = null
    if (mvex) {
      if (movieTimescale > 0 && fragDuration > 0) durationSec = fragDuration / movieTimescale
    } else {
      if (movieTimescale > 0 && movieDuration > 0) durationSec = movieDuration / movieTimescale
      if (durationSec === null && videoDuration > 0) durationSec = videoDuration
    }
    if (fps !== null && (!Number.isFinite(fps) || fps <= 0 || fps > 1000)) fps = null
    return {
      ok: true,
      brand,
      compatible,
      durationSec,
      width,
      height,
      fps: fps === null ? null : Math.round(fps * 100) / 100,
      videoCodec,
      audioCodec,
      hasAudio: !!audioCodec,
      bitrate: durationSec && durationSec > 0 ? Math.round((size * 8) / durationSec) : null,
      fragmented: !!top.find((b) => b.type === 'moof') || !!mvex,
      bytes: size
    }
  } catch (e) {
    return { ok: false, reason: 'corrupt', detail: (e as Error).message }
  } finally {
    if (fd !== null) {
      try { closeSync(fd) } catch { /* ignore */ }
    }
  }
}
