/**
 * The audio track of an M4A / MP4 file, read from its index (the `moov` box): the decoder configuration and where every compressed frame sits in the file.
 * Pure (a Buffer in, plain data out) so it runs in the main process and in the renderer, and is testable with a hand-made file.
 * Used to turn a recording into 16 kHz sound for the automatic timing without a separate audio program: the browser engine already inside BORN decodes the AAC.
 */
export interface Mp4AudioTrack {
  /** WebCodecs codec string, e.g. "mp4a.40.2" (AAC-LC) */
  codec: string
  sampleRate: number
  channels: number
  /** the AudioSpecificConfig (WebCodecs' `description`) */
  description: Uint8Array
  /** where each compressed frame starts in the file, and how long it is */
  frames: Array<{ offset: number; size: number }>
  /** PCM samples per frame (1024 for AAC-LC) */
  samplesPerFrame: number
}

interface Box { type: string; start: number; end: number; body: number }

function boxes(b: Buffer, from: number, to: number): Box[] {
  const out: Box[] = []
  let p = from
  while (p + 8 <= to) {
    let size = b.readUInt32BE(p)
    const type = b.toString('latin1', p + 4, p + 8)
    let body = p + 8
    if (size === 1) { size = Number(b.readBigUInt64BE(p + 8)); body = p + 16 } else if (size === 0) size = to - p
    if (size < body - p || p + size > to) break
    out.push({ type, start: p, end: p + size, body })
    p += size
  }
  return out
}
const find = (b: Buffer, parent: Box, ...path: string[]): Box | null => {
  let cur: Box | null = parent
  for (const t of path) { cur = cur ? boxes(b, cur.body, cur.end).find((x) => x.type === t) ?? null : null }
  return cur
}

/** MPEG-4 descriptor length: 1–4 bytes of 7 bits */
function descLen(b: Buffer, p: number): { len: number; next: number } {
  let len = 0
  let i = p
  for (let k = 0; k < 4; k++) { const c = b[i++]; len = (len << 7) | (c & 0x7f); if (!(c & 0x80)) break }
  return { len, next: i }
}

/** The AudioSpecificConfig bytes inside an `esds` box body, or null. */
function esdsConfig(b: Buffer, body: number, end: number): Buffer | null {
  let p = body + 4 // version + flags
  if (b[p] !== 0x03) return null
  let d = descLen(b, p + 1)
  p = d.next + 3 // ES_ID (2) + flags (1)
  if (b[p - 1] & 0x80) p += 2 // dependsOn
  if (b[p - 1] & 0x40) p += 1 + b[p]
  if (b[p - 1] & 0x20) p += 2
  if (b[p] !== 0x04) return null
  d = descLen(b, p + 1)
  p = d.next + 13 // objectType, streamType, bufferSize, maxBitrate, avgBitrate
  if (p >= end || b[p] !== 0x05) return null
  d = descLen(b, p + 1)
  return b.subarray(d.next, d.next + d.len)
}

const FREQ = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350]

/** `moov` is the whole moov box (header included) read from the file; null when there is no AAC audio track. */
export function parseMp4Audio(moov: Buffer): Mp4AudioTrack | null {
  const top = boxes(moov, 0, moov.length).find((x) => x.type === 'moov')
  if (!top) return null
  for (const trak of boxes(moov, top.body, top.end).filter((x) => x.type === 'trak')) {
    const hdlr = find(moov, trak, 'mdia', 'hdlr')
    if (!hdlr || moov.toString('latin1', hdlr.body + 8, hdlr.body + 12) !== 'soun') continue
    const stbl = find(moov, trak, 'mdia', 'minf', 'stbl')
    if (!stbl) continue
    const stsd = find(moov, stbl, 'stsd')
    const stsz = find(moov, stbl, 'stsz')
    const stsc = find(moov, stbl, 'stsc')
    const stco = find(moov, stbl, 'stco') ?? find(moov, stbl, 'co64')
    if (!stsd || !stsz || !stsc || !stco) continue
    // the sample entry: mp4a
    const entry = boxes(moov, stsd.body + 8, stsd.end)[0]
    if (!entry || entry.type !== 'mp4a') continue
    const channels = moov.readUInt16BE(entry.body + 16)
    const esdsBox = boxes(moov, entry.body + 28, entry.end).find((x) => x.type === 'esds')
    if (!esdsBox) continue
    const asc = esdsConfig(moov, esdsBox.body, esdsBox.end)
    if (!asc || asc.length < 2) continue
    const objectType = asc[0] >> 3
    const fi = ((asc[0] & 7) << 1) | (asc[1] >> 7)
    const chCfg = (asc[1] >> 3) & 15
    const sampleRate = FREQ[fi]
    if (!sampleRate || objectType !== 2) continue // AAC-LC only: it is what the publisher and every phone recorder use
    // frame sizes
    const fixed = moov.readUInt32BE(stsz.body + 4)
    const count = moov.readUInt32BE(stsz.body + 8)
    const sizes = new Array<number>(count)
    for (let i = 0; i < count; i++) sizes[i] = fixed || moov.readUInt32BE(stsz.body + 12 + i * 4)
    // chunk offsets
    const is64 = stco.type === 'co64'
    const nChunks = moov.readUInt32BE(stco.body + 4)
    const chunkAt = (i: number): number => (is64 ? Number(moov.readBigUInt64BE(stco.body + 8 + i * 8)) : moov.readUInt32BE(stco.body + 8 + i * 4))
    // samples per chunk
    const nRuns = moov.readUInt32BE(stsc.body + 4)
    const runs: Array<{ first: number; per: number }> = []
    for (let i = 0; i < nRuns; i++) runs.push({ first: moov.readUInt32BE(stsc.body + 8 + i * 12), per: moov.readUInt32BE(stsc.body + 12 + i * 12) })
    const frames: Array<{ offset: number; size: number }> = []
    let s = 0
    for (let c = 0; c < nChunks && s < count; c++) {
      let per = runs[0]?.per ?? 1
      for (const r of runs) if (r.first <= c + 1) per = r.per
      let off = chunkAt(c)
      for (let k = 0; k < per && s < count; k++, s++) { frames.push({ offset: off, size: sizes[s] }); off += sizes[s] }
    }
    return { codec: 'mp4a.40.2', sampleRate, channels: chCfg || channels || 1, description: new Uint8Array(asc), frames, samplesPerFrame: 1024 }
  }
  return null
}

/** The smallest piece of the file that holds the index: (offset, length) of the `moov` box, found from the box headers. */
export function findMoov(read: (pos: number, len: number) => Buffer, size: number): { start: number; length: number } | null {
  let pos = 0
  while (pos + 8 <= size) {
    const h = read(pos, 16)
    let len = h.readUInt32BE(0)
    const type = h.toString('latin1', 4, 8)
    if (len === 1) len = Number(h.readBigUInt64BE(8))
    else if (len === 0) len = size - pos
    if (len < 8) return null
    if (type === 'moov') return { start: pos, length: len }
    pos += len
  }
  return null
}
