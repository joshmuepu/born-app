/**
 * Builds small, structurally valid MP4 files out of boxes, with no encoder. They contain no real picture — only the
 * boxes BORN reads (ftyp, moov/mvhd/trak/tkhd/mdia/mdhd/hdlr/stsd/stts, mdat) — so tests can describe "a 4K HEVC file",
 * "a file cut off halfway" or "an audio-less H.264 file" exactly, and no video ever has to be committed.
 */
const u32 = (n: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b }
const u16 = (n: number): Buffer => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b }
const box = (type: string, ...parts: Buffer[]): Buffer => {
  const body = Buffer.concat(parts)
  return Buffer.concat([u32(8 + body.length), Buffer.from(type, 'latin1'), body])
}
const fullbox = (type: string, version: number, flags: number, ...parts: Buffer[]): Buffer => box(type, Buffer.from([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...parts)

export interface Mp4Spec {
  brand?: string
  width?: number
  height?: number
  fps?: number
  seconds?: number
  /** video sample entry, default avc1 */
  video?: string
  /** audio sample entry; null = no audio track. Default mp4a */
  audio?: string | null
  /** bytes of fake media data */
  mdatBytes?: number
  /** put moov after mdat (a "not fast-start" file) */
  moovLast?: boolean
  /** omit moov entirely (an interrupted recording) */
  noMoov?: boolean
  /** fragmented: moov has mvex, media is in moof/mdat */
  fragmented?: boolean
  /** use a 64-bit size for mdat */
  bigMdat?: boolean
  /** chop this many bytes off the end */
  truncateBy?: number
}

function track(kind: 'vide' | 'soun', entry: string, w: number, h: number, ts: number, durTicks: number, fps: number): Buffer {
  const tkhd = fullbox('tkhd', 0, 7, Buffer.alloc(8), u32(kind === 'vide' ? 1 : 2), Buffer.alloc(4), u32(0), Buffer.alloc(8 + 8 + 36), u32(w * 65536), u32(h * 65536))
  const mdhd = fullbox('mdhd', 0, 0, Buffer.alloc(8), u32(ts), u32(durTicks), Buffer.alloc(4))
  const hdlr = fullbox('hdlr', 0, 0, Buffer.alloc(4), Buffer.from(kind, 'latin1'), Buffer.alloc(12), Buffer.from('h\0', 'latin1'))
  const visual = Buffer.concat([Buffer.alloc(6), u16(1), Buffer.alloc(16), u16(w), u16(h), Buffer.alloc(50)])
  const audio = Buffer.concat([Buffer.alloc(6), u16(1), Buffer.alloc(20)])
  const stsd = fullbox('stsd', 0, 0, u32(1), box(entry, kind === 'vide' ? visual : audio))
  const frames = Math.max(1, Math.round((durTicks / ts) * fps))
  const stts = fullbox('stts', 0, 0, u32(1), u32(frames), u32(Math.round(ts / fps)))
  const stbl = box('stbl', stsd, stts)
  return box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', stbl)))
}

export function buildMp4(spec: Mp4Spec = {}): Buffer {
  const { brand = 'isom', width = 1920, height = 1080, fps = 30, seconds = 10, video = 'avc1', audio = 'mp4a', mdatBytes = 4096 } = spec
  const ts = 90000
  const durTicks = Math.round(seconds * ts)
  const ftyp = box('ftyp', Buffer.from(brand.padEnd(4, ' '), 'latin1'), u32(0), Buffer.from('isom', 'latin1'), Buffer.from('mp42', 'latin1'))
  const mvhd = fullbox('mvhd', 0, 0, Buffer.alloc(8), u32(ts), u32(spec.fragmented ? Math.round(ts / fps) : durTicks), Buffer.alloc(80))
  const traks = [track('vide', video, width, height, ts, spec.fragmented ? 0 : durTicks, fps)]
  if (audio) traks.push(track('soun', audio, 0, 0, ts, spec.fragmented ? 0 : durTicks, 1))
  const mvex = spec.fragmented ? box('mvex', fullbox('mehd', 0, 0, u32(durTicks)), fullbox('trex', 0, 0, u32(1), u32(1), u32(Math.round(ts / fps)), u32(0), u32(0))) : Buffer.alloc(0)
  const moov = box('moov', mvhd, ...traks, mvex)
  const data = Buffer.alloc(mdatBytes, 0x5a)
  const mdat = spec.bigMdat ? Buffer.concat([u32(1), Buffer.from('mdat', 'latin1'), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(16 + data.length)); return b })(), data]) : box('mdat', data)
  const parts = spec.noMoov ? [ftyp, mdat] : spec.moovLast ? [ftyp, mdat, moov] : [ftyp, moov, mdat]
  let out = Buffer.concat(parts)
  if (spec.truncateBy) out = out.subarray(0, out.length - spec.truncateBy)
  return out
}
