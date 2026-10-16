/**
 * audioProbe.ts — read what BORN needs to know about an audio file straight from its bytes (no FFmpeg, no browser): container, codec,
 * length, whether the file is WHOLE, and the two things that make a long tape unreliable to seek in:
 *   • variable-bitrate MP3 (the browser estimates positions and can land up to ~1 s off), and a VBR MP3 with no seek table (it also
 *     reports the wrong length);
 *   • a very large WAV (Chromium refused a 2-hour 635 MB one in testing).
 * Electron-free so tests can run it on small files built at test time. Whether the file truly DECODES is checked separately by the audio
 * engine (it asks the browser for a duration). Measured numbers behind these rules: docs/design/sermon-audio/01-investigation.md §5.
 */
import { closeSync, fstatSync, openSync, readSync } from 'fs'

export type AudioContainer = 'm4a' | 'mp3' | 'flac' | 'ogg' | 'wav'

export interface AudioInfo {
  ok: true
  container: AudioContainer
  /** `mp4a` (AAC), `alac`, `mp3`, `flac`, `vorbis`, `opus`, `pcm` … */
  codec: string
  durationSec: number
  /** bits per second over the whole file */
  bitrate: number
  /** MP3 only: bitrate changes through the file */
  vbr: boolean | null
  /** can the browser seek exactly? false for VBR MP3 without a seek table (and warned about for any VBR MP3) */
  seekTableOk: boolean
  /** the file ends where its own headers say it should */
  whole: boolean
  /** M4A: the index is at the front (opens instantly); false = at the end (still fine for a local file) */
  indexFirst: boolean | null
  bytes: number
  /** plain-language cautions, each already with its fix */
  warnings: string[]
}
export type AudioFail = { ok: false; reason: 'unreadable' | 'not-audio' | 'unsupported' | 'empty'; message: string }

const FAIL = (reason: AudioFail['reason'], message: string): AudioFail => ({ ok: false, reason, message })

export const AUDIO_EXTENSIONS = ['m4a', 'mp4', 'mp3', 'flac', 'ogg', 'oga', 'opus', 'wav']
/** a WAV bigger than this may not open (a 635 MB one did not) */
export const WAV_WARN_BYTES = 256 * 1024 * 1024

function readAt(fd: number, pos: number, len: number): Buffer {
  const b = Buffer.alloc(len)
  const n = readSync(fd, b, 0, len, pos)
  return n === len ? b : b.subarray(0, n)
}

export function probeAudio(path: string): AudioInfo | AudioFail {
  let fd = -1
  try {
    fd = openSync(path, 'r')
    const bytes = fstatSync(fd).size
    if (bytes === 0) return FAIL('empty', 'The file is empty (0 bytes). It may not have finished downloading.')
    const head = readAt(fd, 0, 16)
    if (head.length < 12) return FAIL('not-audio', "This file is too small to be a recording.")
    if (head.toString('latin1', 4, 8) === 'ftyp') return probeM4a(fd, bytes)
    if (head.toString('latin1', 0, 4) === 'fLaC') return probeFlac(fd, bytes)
    if (head.toString('latin1', 0, 4) === 'OggS') return probeOgg(fd, bytes)
    if (head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WAVE') return probeWav(fd, bytes)
    if (head.toString('latin1', 0, 3) === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) return probeMp3(fd, bytes)
    return FAIL('not-audio', "This isn't an audio file BORN can use. Use M4A, MP3, FLAC, OGG or WAV.")
  } catch (e) {
    return FAIL('unreadable', `This file could not be read (${(e as Error).message}).`)
  } finally {
    if (fd >= 0) try { closeSync(fd) } catch { /* closing a file that is already closed */ }
  }
}

// ── M4A / MP4 audio ─────────────────────────────────────────────────────────

interface Box { type: string; start: number; size: number; header: number }
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
    if (size < header) break
    out.push({ type, start: p, size, header })
    p += size
  }
  return out
}
const child = (buf: Buffer, b: Box, type: string): Box | undefined => boxesIn(buf, b.start + b.header, Math.min(buf.length, b.start + b.size)).find((x) => x.type === type)

function probeM4a(fd: number, bytes: number): AudioInfo | AudioFail {
  // walk the top-level boxes by reading only their 16-byte headers
  const top: Box[] = []
  let p = 0
  while (p + 8 <= bytes) {
    const h = readAt(fd, p, 16)
    if (h.length < 8) break
    let size = h.readUInt32BE(0)
    const type = h.toString('latin1', 4, 8)
    let header = 8
    if (size === 1 && h.length >= 16) { size = Number(h.readBigUInt64BE(8)); header = 16 }
    else if (size === 0) size = bytes - p
    if (size < header) break
    top.push({ type, start: p, size, header })
    p += size
  }
  const end = top.length ? top[top.length - 1].start + top[top.length - 1].size : 0
  const whole = end === bytes
  const moovBox = top.find((b) => b.type === 'moov')
  if (!moovBox) return FAIL('not-audio', 'This file has no index, so it is incomplete (an unfinished download or copy). Download or copy it again.')
  if (moovBox.size > 64 * 1024 * 1024) return FAIL('unsupported', 'This file’s index is unusually large and BORN will not open it.')
  const moovAvail = Math.min(moovBox.size, bytes - moovBox.start)
  const moov = readAt(fd, moovBox.start, moovAvail)
  const mvhd = child(moov, { type: 'moov', start: 0, size: moov.length, header: moovBox.header }, 'mvhd')
  if (!mvhd) return FAIL('not-audio', 'This file’s header is damaged.')
  const v = moov.readUInt8(mvhd.start + mvhd.header)
  const timescale = v === 1 ? moov.readUInt32BE(mvhd.start + mvhd.header + 20) : moov.readUInt32BE(mvhd.start + mvhd.header + 12)
  const dur = v === 1 ? Number(moov.readBigUInt64BE(mvhd.start + mvhd.header + 24)) : moov.readUInt32BE(mvhd.start + mvhd.header + 16)
  let durationSec = timescale > 0 ? dur / timescale : 0
  // the audio track's sample entry
  let codec = 'unknown'
  const moovAsBox: Box = { type: 'moov', start: 0, size: moov.length, header: moovBox.header }
  for (const trak of boxesIn(moov, moovAsBox.start + moovAsBox.header, moov.length).filter((b) => b.type === 'trak')) {
    const mdia = child(moov, trak, 'mdia')
    const hdlr = mdia && child(moov, mdia, 'hdlr')
    if (!mdia || !hdlr || moov.toString('latin1', hdlr.start + hdlr.header + 8, hdlr.start + hdlr.header + 12) !== 'soun') continue
    const minf = child(moov, mdia, 'minf'); const stbl = minf && child(moov, minf, 'stbl'); const stsd = stbl && child(moov, stbl, 'stsd')
    if (stsd) codec = moov.toString('latin1', stsd.start + stsd.header + 12, stsd.start + stsd.header + 16).trim()
    // a per-track duration is more exact than the movie's when they differ
    const mdhd = child(moov, mdia, 'mdhd')
    if (mdhd) {
      const mv = moov.readUInt8(mdhd.start + mdhd.header)
      const ts = mv === 1 ? moov.readUInt32BE(mdhd.start + mdhd.header + 20) : moov.readUInt32BE(mdhd.start + mdhd.header + 12)
      const d = mv === 1 ? Number(moov.readBigUInt64BE(mdhd.start + mdhd.header + 24)) : moov.readUInt32BE(mdhd.start + mdhd.header + 16)
      if (ts > 0 && d > 0) durationSec = d / ts
    }
    break
  }
  if (codec === 'unknown') return FAIL('not-audio', 'This file has no sound track.')
  const warnings: string[] = []
  if (!whole) warnings.push('This file looks cut short (an unfinished download or copy). It will play only as far as it goes — download or copy it again.')
  if (codec !== 'mp4a') warnings.push(`This M4A uses “${codec}”, which many computers cannot play. Convert it to AAC (the usual M4A) and add that file.`)
  if (durationSec <= 0) warnings.push('This file does not say how long it is.')
  const mdatBox = top.find((b) => b.type === 'mdat')
  return {
    ok: true, container: 'm4a', codec, durationSec, bitrate: durationSec > 0 ? Math.round((bytes * 8) / durationSec) : 0, vbr: null,
    seekTableOk: true, whole: whole && !!mdatBox, indexFirst: mdatBox ? moovBox.start < mdatBox.start : null, bytes, warnings
  }
}

// ── MP3 ──────────────────────────────────────────────────────────────────────

const MP3_BITRATES: Record<string, number[]> = {
  '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  '2-3': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
}
const MP3_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }
interface Mp3Frame { len: number; bitrate: number; rate: number; spf: number; mono: boolean; mpeg: number }
function mp3Frame(b: Buffer, p: number): Mp3Frame | null {
  if (p + 4 > b.length || b[p] !== 0xff || (b[p + 1] & 0xe0) !== 0xe0) return null
  const ver = (b[p + 1] >> 3) & 3 // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
  const layer = (b[p + 1] >> 1) & 3 // 1 = Layer III
  if (ver === 1 || layer !== 1) return null
  const bi = (b[p + 2] >> 4) & 15, ri = (b[p + 2] >> 2) & 3
  if (bi === 0 || bi === 15 || ri === 3) return null
  const pad = (b[p + 2] >> 1) & 1
  const bitrate = MP3_BITRATES[ver === 3 ? '1-3' : '2-3'][bi] * 1000
  const rate = MP3_RATES[ver][ri]
  const spf = ver === 3 ? 1152 : 576
  const len = Math.floor(((ver === 3 ? 144 : 72) * bitrate) / rate) + pad
  return { len, bitrate, rate, spf, mono: ((b[p + 3] >> 6) & 3) === 3, mpeg: ver }
}

function probeMp3(fd: number, bytes: number): AudioInfo | AudioFail {
  let pos = 0
  const h = readAt(fd, 0, 10)
  if (h.toString('latin1', 0, 3) === 'ID3') pos = 10 + (((h[6] & 0x7f) << 21) | ((h[7] & 0x7f) << 14) | ((h[8] & 0x7f) << 7) | (h[9] & 0x7f))
  const CHUNK = 4 * 1024 * 1024
  let frames = 0, audioBytes = 0, samples = 0, firstRate = 0, truncated = false
  const rates = new Set<number>()
  let xing: { frames?: number; toc: boolean; info: boolean } | null = null
  let vbri = false
  let buf: Buffer = Buffer.alloc(0)
  let bufStart = 0
  const ensure = (p: number, need: number): boolean => {
    if (p >= bufStart && p + need <= bufStart + buf.length) return true
    if (p + need > bytes) return false
    bufStart = p
    buf = readAt(fd, p, Math.min(CHUNK, bytes - p))
    return buf.length >= need
  }
  let guard = 0
  let firstFramePos = -1
  while (pos + 4 <= bytes && guard++ < 6_000_000) {
    if (!ensure(pos, 4)) break
    const f = mp3Frame(buf, pos - bufStart)
    if (!f) {
      // resync: a stray byte, the end tag, or damage
      if (bytes - pos <= 128) break // ID3v1 tag
      let q = pos + 1
      let found = false
      while (q + 4 < bytes && q - pos < 65536) {
        if (!ensure(q, 4)) break
        if (mp3Frame(buf, q - bufStart)) { found = true; break }
        q++
      }
      if (!found) break
      pos = q
      continue
    }
    if (firstFramePos < 0) {
      firstFramePos = pos
      // a Xing/Info/VBRI header lives inside the first frame
      if (ensure(pos, Math.min(f.len, 200))) {
        const side = f.mpeg === 3 ? (f.mono ? 17 : 32) : f.mono ? 9 : 17
        const o = pos - bufStart + 4 + side
        const tag = buf.toString('latin1', o, o + 4)
        if (tag === 'Xing' || tag === 'Info') {
          const flags = buf.readUInt32BE(o + 4)
          xing = { info: tag === 'Info', toc: (flags & 4) !== 0, frames: flags & 1 ? buf.readUInt32BE(o + 8) : undefined }
          pos += f.len
          firstRate = f.rate
          rates.add(f.rate)
          continue // the header frame itself carries no sound
        }
        if (buf.toString('latin1', pos - bufStart + 4 + 32, pos - bufStart + 4 + 36) === 'VBRI') vbri = true
      }
    }
    if (pos + f.len > bytes) { truncated = true; break }
    frames++
    audioBytes += f.len
    samples += f.spf
    firstRate = firstRate || f.rate
    rates.add(f.bitrate)
    pos += f.len
  }
  if (frames < 3 || !firstRate) return FAIL('not-audio', 'This MP3 has no readable sound.')
  const durationSec = samples / firstRate
  const nonHeaderRates = [...rates].filter((r) => r > 1000)
  const vbr = nonHeaderRates.length > 1 && !(xing && xing.info)
  const seekTable = !vbr || !!(xing && xing.toc) || vbri
  const warnings: string[] = []
  if (truncated) warnings.push('This MP3 ends in the middle of a sound frame — it looks cut short. Download or copy it again.')
  if (vbr && !seekTable) warnings.push('This MP3 has variable quality and no seek table, so jumping around can land seconds away and its length may show wrongly. Convert it to M4A (AAC) or a constant-bitrate MP3 and add that file.')
  else if (vbr) warnings.push('This MP3 has variable quality, so jumping to a spot can land up to a second away. For exact following, convert it to M4A (AAC) and add that file.')
  return { ok: true, container: 'mp3', codec: 'mp3', durationSec, bitrate: Math.round((bytes * 8) / durationSec), vbr, seekTableOk: seekTable && !vbr ? true : seekTable, whole: !truncated, indexFirst: null, bytes, warnings }
}

// ── FLAC / OGG / WAV ───────────────────────────────────────────────────────

function probeFlac(fd: number, bytes: number): AudioInfo | AudioFail {
  const b = readAt(fd, 0, 42)
  if (b.length < 42 || (b[4] & 0x7f) !== 0) return FAIL('not-audio', 'This FLAC file’s header is damaged.')
  const rate = (b[18] << 12) | (b[19] << 4) | (b[20] >> 4)
  const total = ((b[21] & 0x0f) * 2 ** 32) + b.readUInt32BE(22)
  if (!rate || !total) return FAIL('unsupported', 'This FLAC file does not say how long it is.')
  const durationSec = total / rate
  return { ok: true, container: 'flac', codec: 'flac', durationSec, bitrate: Math.round((bytes * 8) / durationSec), vbr: null, seekTableOk: true, whole: true, indexFirst: null, bytes, warnings: [] }
}

function probeOgg(fd: number, bytes: number): AudioInfo | AudioFail {
  const first = readAt(fd, 0, 512)
  let codec = 'vorbis'
  let rate = 0
  const vi = first.indexOf('\x01vorbis', 0, 'latin1')
  const oi = first.indexOf('OpusHead', 0, 'latin1')
  if (vi >= 0) rate = first.readUInt32LE(vi + 12)
  else if (oi >= 0) { codec = 'opus'; rate = 48000 }
  else return FAIL('unsupported', 'This OGG file is not Vorbis or Opus audio.')
  const tailLen = Math.min(bytes, 65536)
  const tail = readAt(fd, bytes - tailLen, tailLen)
  const i = tail.lastIndexOf('OggS', tail.length - 4, 'latin1')
  if (i < 0 || i + 14 > tail.length) return FAIL('not-audio', 'This OGG file looks cut short.')
  const granule = Number(tail.readBigUInt64LE(i + 6))
  if (granule <= 0 || !rate) return FAIL('unsupported', 'This OGG file does not say how long it is.')
  const durationSec = granule / rate
  return { ok: true, container: 'ogg', codec, durationSec, bitrate: Math.round((bytes * 8) / durationSec), vbr: null, seekTableOk: true, whole: true, indexFirst: null, bytes, warnings: [] }
}

function probeWav(fd: number, bytes: number): AudioInfo | AudioFail {
  const head = readAt(fd, 0, Math.min(bytes, 4096))
  let p = 12, rate = 0, channels = 0, bits = 0, dataSize = -1, tag = 1
  while (p + 8 <= head.length) {
    const id = head.toString('latin1', p, p + 4)
    const size = head.readUInt32LE(p + 4)
    if (id === 'fmt ') { tag = head.readUInt16LE(p + 8); channels = head.readUInt16LE(p + 10); rate = head.readUInt32LE(p + 12); bits = head.readUInt16LE(p + 22) }
    if (id === 'data') { dataSize = size; break }
    p += 8 + size + (size & 1)
  }
  if (!rate || !channels || !bits || dataSize < 0) return FAIL('not-audio', 'This WAV file’s header is damaged.')
  const dataStart = p + 8
  const available = Math.max(0, bytes - dataStart)
  const streamed = dataSize === 0 || dataSize === 0xffffffff
  const effective = streamed ? available : Math.min(dataSize, available)
  const durationSec = effective / ((rate * channels * bits) / 8)
  const whole = streamed || dataSize <= available
  const warnings: string[] = []
  if (!whole) warnings.push('This WAV file looks cut short (an unfinished copy). Copy it again.')
  if (bytes > WAV_WARN_BYTES) warnings.push('A WAV this large may not open on this computer. Convert it to M4A (AAC) — it will be about 20 times smaller and sound the same for speech — and add that file.')
  if (tag !== 1 && tag !== 3 && tag !== 0xfffe) warnings.push('This WAV uses a compressed format that many computers cannot play. Convert it to M4A (AAC).')
  return { ok: true, container: 'wav', codec: 'pcm', durationSec, bitrate: Math.round(rate * channels * bits), vbr: null, seekTableOk: true, whole, indexFirst: null, bytes, warnings }
}
