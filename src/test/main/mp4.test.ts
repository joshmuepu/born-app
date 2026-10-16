import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { probeMp4 } from '../../main/mp4'
import { buildMp4, type Mp4Spec } from '../helpers/mp4Builder'

let dir: string
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'born-mp4-')) })
afterAll(() => rmSync(dir, { recursive: true, force: true }))
let n = 0
const probe = (spec: Mp4Spec | Buffer) => {
  const p = join(dir, `f${n++}.mp4`)
  writeFileSync(p, Buffer.isBuffer(spec) ? spec : buildMp4(spec))
  return probeMp4(p)
}

describe('MP4 reader (no encoder, no browser)', () => {
  it('reads codec, size, frame rate, duration, bitrate and audio from a classic file', () => {
    const r = probe({ width: 1920, height: 1080, fps: 30, seconds: 12, mdatBytes: 3_000_000 })
    expect(r).toMatchObject({ ok: true, brand: 'isom', videoCodec: 'avc1', audioCodec: 'mp4a', hasAudio: true, width: 1920, height: 1080, fps: 30, durationSec: 12, fragmented: false })
    expect(r.ok && r.bitrate).toBeGreaterThan(1_900_000)
  })
  it('knows an audio-less file, HEVC, QuickTime and 4K', () => {
    expect(probe({ audio: null })).toMatchObject({ ok: true, hasAudio: false, audioCodec: null })
    expect(probe({ video: 'hvc1' })).toMatchObject({ ok: true, videoCodec: 'hvc1' })
    expect(probe({ brand: 'qt  ' })).toMatchObject({ ok: true, brand: 'qt  ' })
    expect(probe({ width: 3840, height: 2160, fps: 60 })).toMatchObject({ width: 3840, height: 2160, fps: 60 })
  })
  it('handles a 64-bit mdat size and a moov placed after the media data', () => {
    expect(probe({ bigMdat: true })).toMatchObject({ ok: true, durationSec: 10 })
    expect(probe({ moovLast: true })).toMatchObject({ ok: true, durationSec: 10 })
  })
  it('a fragmented file (a browser recording) does not trust the first-fragment duration', () => {
    const r = probe({ fragmented: true, seconds: 8 })
    expect(r).toMatchObject({ ok: true, fragmented: true, durationSec: 8 })
  })
  it('is whole only if the boxes add up to the file: a cut-off file is "truncated", not trusted', () => {
    expect(probe({ truncateBy: 100 })).toMatchObject({ ok: false, reason: 'truncated' })
    expect(probe({ truncateBy: 1 })).toMatchObject({ ok: false, reason: 'truncated' })
    expect(probe({ noMoov: true })).toMatchObject({ ok: false, reason: 'truncated' })
    // moov at the end with the tail cut off: the unfinished-recording case
    expect(probe({ moovLast: true, truncateBy: 30 })).toMatchObject({ ok: false, reason: 'truncated' })
  })
  it('trailing zero padding is fine; trailing junk is not', () => {
    expect(probe(Buffer.concat([buildMp4(), Buffer.alloc(16)]))).toMatchObject({ ok: true })
    expect(probe(Buffer.concat([buildMp4(), Buffer.from('junk-after-the-end')]))).toMatchObject({ ok: false })
  })
  it('refuses things that are not MP4 files', () => {
    expect(probe(Buffer.from('this is not a video at all, just text padding padding'))).toMatchObject({ ok: false, reason: 'not-mp4' })
    expect(probe(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...new Array(60).fill(0)]))).toMatchObject({ ok: false, reason: 'not-mp4' }) // Matroska/WebM
    expect(probe(Buffer.alloc(4))).toMatchObject({ ok: false, reason: 'not-mp4' })
  })
  it('an MP4 with no video track (audio only) is "no-video"', () => {
    const b = buildMp4()
    const text = b.toString('latin1').replace('vide', 'soun')
    expect(probe(Buffer.from(text, 'latin1'))).toMatchObject({ ok: false, reason: 'no-video' })
  })
})
