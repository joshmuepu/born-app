import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir, homedir } from 'os'
import { join } from 'path'
import { probeAudio } from '../../main/audioProbe'

/** Files are BUILT HERE at test time (tiny, generated): no audio is ever stored in the repo. */
let dir: string
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'born-probe-')) })
afterAll(() => rmSync(dir, { recursive: true, force: true }))
const put = (name: string, b: Buffer): string => { const p = join(dir, name); writeFileSync(p, b); return p }

const box = (type: string, ...payload: Buffer[]): Buffer => { const body = Buffer.concat(payload); const h = Buffer.alloc(8); h.writeUInt32BE(8 + body.length, 0); h.write(type, 4, 'latin1'); return Buffer.concat([h, body]) }
const u32 = (n: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b }
function m4a(opts: { seconds: number; codec?: string; moovFirst?: boolean; cut?: number; noMoov?: boolean }): Buffer {
  const ts = 44100
  const mvhd = box('mvhd', Buffer.alloc(4), u32(0), u32(0), u32(ts), u32(Math.round(opts.seconds * ts)), Buffer.alloc(80))
  const mdhd = box('mdhd', Buffer.alloc(4), u32(0), u32(0), u32(ts), u32(Math.round(opts.seconds * ts)), Buffer.alloc(4))
  const hdlr = box('hdlr', Buffer.alloc(4), u32(0), Buffer.from('soun', 'latin1'), Buffer.alloc(13))
  const entry = Buffer.concat([u32(16 + 12), Buffer.from(opts.codec ?? 'mp4a', 'latin1'), Buffer.alloc(24)])
  const stsd = box('stsd', Buffer.alloc(4), u32(1), entry)
  const trak = box('trak', box('mdia', mdhd, hdlr, box('minf', box('stbl', stsd))))
  const moov = box('moov', mvhd, trak)
  const ftyp = box('ftyp', Buffer.from('M4A ', 'latin1'), u32(0), Buffer.from('M4A mp42isom', 'latin1'))
  const mdat = box('mdat', Buffer.alloc(5000, 1))
  let all = opts.noMoov ? Buffer.concat([ftyp, mdat]) : opts.moovFirst === false ? Buffer.concat([ftyp, mdat, moov]) : Buffer.concat([ftyp, moov, mdat])
  if (opts.cut) all = all.subarray(0, all.length - opts.cut)
  return all
}

/** MP3 frames of silence: MPEG-1 Layer III, 44.1 kHz, mono. `rates` = bitrate index per frame. */
function mp3(frames: number, rates: number[] = [9], opts: { xing?: 'Xing' | 'Info'; toc?: boolean; id3?: boolean; cut?: number } = {}): Buffer {
  const BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
  const parts: Buffer[] = []
  if (opts.id3) { const t = Buffer.alloc(10 + 20); t.write('ID3', 0); t[3] = 3; t[9] = 20; parts.push(t) }
  const frame = (bi: number, extra?: (b: Buffer) => void): Buffer => {
    const len = Math.floor((144 * BR[bi] * 1000) / 44100)
    const b = Buffer.alloc(len)
    b[0] = 0xff; b[1] = 0xfb; b[2] = (bi << 4) | 0; b[3] = 0xc0 // mono
    extra?.(b)
    return b
  }
  if (opts.xing) {
    parts.push(frame(rates[0], (b) => { const o = 4 + 17; b.write(opts.xing!, o, 'latin1'); b.writeUInt32BE(opts.toc ? 5 : 1, o + 4); b.writeUInt32BE(frames, o + 8) }))
  }
  for (let i = 0; i < frames; i++) parts.push(frame(rates[i % rates.length]))
  let all = Buffer.concat(parts)
  if (opts.cut) all = all.subarray(0, all.length - opts.cut)
  return all
}

describe('M4A / AAC (what the rights holder publishes)', () => {
  it('reads length and codec from the index, and says the file is whole', () => {
    const r = probeAudio(put('a.m4a', m4a({ seconds: 8687.9 })))
    expect(r).toMatchObject({ ok: true, container: 'm4a', codec: 'mp4a', whole: true, indexFirst: true, seekTableOk: true })
    if (r.ok) { expect(r.durationSec).toBeCloseTo(8687.9, 1); expect(r.warnings).toEqual([]) }
  })
  it('an index at the end of the file is fine (and noted)', () => {
    const r = probeAudio(put('b.m4a', m4a({ seconds: 60, moovFirst: false })))
    expect(r).toMatchObject({ ok: true, indexFirst: false, whole: true })
  })
  it('a cut-short file is found out and says what to do', () => {
    const r = probeAudio(put('c.m4a', m4a({ seconds: 60, cut: 1200 })))
    expect(r.ok && r.whole).toBe(false)
    if (r.ok) expect(r.warnings[0]).toMatch(/cut short/)
  })
  it('no index at all = unfinished download', () => {
    const r = probeAudio(put('d.m4a', m4a({ seconds: 60, noMoov: true })))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/no index|incomplete/i)
  })
  it('a codec browsers cannot play (ALAC) is warned about', () => {
    const r = probeAudio(put('e.m4a', m4a({ seconds: 60, codec: 'alac' })))
    expect(r.ok && r.warnings.join(' ')).toMatch(/alac/)
  })
})

describe('MP3', () => {
  it('constant bitrate: exact length, no warning', () => {
    const r = probeAudio(put('cbr.mp3', mp3(1000, [9])))
    expect(r).toMatchObject({ ok: true, container: 'mp3', vbr: false, whole: true, seekTableOk: true })
    if (r.ok) { expect(r.durationSec).toBeCloseTo((1000 * 1152) / 44100, 2); expect(r.warnings).toEqual([]) }
  })
  it('a CBR file with an "Info" header is still constant bitrate', () => {
    const r = probeAudio(put('info.mp3', mp3(500, [9], { xing: 'Info' })))
    expect(r.ok && r.vbr).toBe(false)
  })
  it('variable bitrate WITH a seek table: allowed, but warned (seeks can land ~1 s away)', () => {
    const r = probeAudio(put('vbr.mp3', mp3(600, [5, 9, 12, 7], { xing: 'Xing', toc: true })))
    expect(r.ok && r.vbr).toBe(true)
    if (r.ok) { expect(r.seekTableOk).toBe(true); expect(r.warnings.join(' ')).toMatch(/up to a second/); expect(r.warnings.join(' ')).toMatch(/M4A/) }
  })
  it('variable bitrate WITHOUT a seek table: found out, with the fix', () => {
    const r = probeAudio(put('vbr2.mp3', mp3(600, [5, 9, 12, 7])))
    expect(r.ok && r.vbr).toBe(true)
    if (r.ok) { expect(r.seekTableOk).toBe(false); expect(r.warnings.join(' ')).toMatch(/no seek table/); expect(r.warnings.join(' ')).toMatch(/Convert it to M4A/) }
  })
  it('skips an ID3 tag, and finds a cut-short file', () => {
    expect(probeAudio(put('id3.mp3', mp3(400, [9], { id3: true })))).toMatchObject({ ok: true, whole: true })
    const r = probeAudio(put('cut.mp3', mp3(400, [9], { cut: 100 })))
    expect(r.ok && r.whole).toBe(false)
  })
})

describe('WAV, FLAC, OGG and refusals', () => {
  function wav(seconds: number, dataSizeOverride?: number): Buffer {
    const rate = 8000, n = Math.round(seconds * rate) * 2
    const h = Buffer.alloc(44)
    h.write('RIFF', 0); h.writeUInt32LE(36 + n, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dataSizeOverride ?? n, 40)
    return Buffer.concat([h, Buffer.alloc(n)])
  }
  it('WAV: length from the data size; a truncated one is found', () => {
    const r = probeAudio(put('x.wav', wav(3)))
    expect(r).toMatchObject({ ok: true, container: 'wav', whole: true })
    if (r.ok) expect(r.durationSec).toBeCloseTo(3, 2)
    const t = probeAudio(put('y.wav', wav(3, 999999)))
    expect(t.ok && t.whole).toBe(false)
  })
  it('FLAC: length from the stream info', () => {
    const b = Buffer.alloc(42)
    b.write('fLaC', 0, 'latin1'); b[4] = 0x80; b.writeUIntBE(34, 5, 3)
    const rate = 44100, total = 44100 * 90
    b[18] = (rate >> 12) & 0xff; b[19] = (rate >> 4) & 0xff; b[20] = ((rate & 0xf) << 4) | 0
    b[21] = (b[21] & 0xf0) | Math.floor(total / 2 ** 32); b.writeUInt32BE(total >>> 0, 22)
    const r = probeAudio(put('z.flac', b))
    expect(r.ok && Math.round(r.durationSec)).toBe(90)
  })
  it('OGG Vorbis: length from the last page', () => {
    const page = (granule: bigint, payload: Buffer): Buffer => { const h = Buffer.alloc(27); h.write('OggS', 0); h.writeBigUInt64LE(granule, 6); h[26] = 1; return Buffer.concat([h, Buffer.from([payload.length]), payload]) }
    const idh = Buffer.alloc(30); idh[0] = 1; idh.write('vorbis', 1, 'latin1'); idh.writeUInt32LE(44100, 12)
    const r = probeAudio(put('v.ogg', Buffer.concat([page(0n, idh), page(BigInt(44100 * 120), Buffer.alloc(40))])))
    expect(r.ok && Math.round(r.durationSec)).toBe(120)
  })
  it('refuses empty files, text files and pictures in plain words', () => {
    expect(probeAudio(put('e.mp3', Buffer.alloc(0)))).toMatchObject({ ok: false, reason: 'empty' })
    expect(probeAudio(put('t.mp3', Buffer.from('this is just text, not audio at all, really')))).toMatchObject({ ok: false, reason: 'not-audio' })
    expect(probeAudio(join(dir, 'does-not-exist.m4a'))).toMatchObject({ ok: false, reason: 'unreadable' })
  })
})

/** The owner's real tape, only when it is on this machine (numbers only; nothing is copied). */
const REAL = join(homedir(), 'Downloads', '65-0418M It Is The Rising Of The Sun VGR.m4a')
describe.skipIf(!existsSync(REAL))('the real test tape (65-0418M)', () => {
  it('is a whole AAC M4A of about 2 h 24 m 48 s with its index first', () => {
    const r = probeAudio(REAL)
    expect(r).toMatchObject({ ok: true, container: 'm4a', codec: 'mp4a', whole: true, indexFirst: true, seekTableOk: true })
    if (r.ok) { expect(r.durationSec).toBeGreaterThan(8680); expect(r.durationSec).toBeLessThan(8700); expect(r.warnings).toEqual([]) }
  })
})
