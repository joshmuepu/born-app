import { describe, it, expect } from 'vitest'
import { parseMp4Audio, findMoov } from '../../shared/mp4Audio'

// a hand-made MP4 index: one AAC-LC mono 16 kHz track with 5 frames in two chunks (3 + 2)
const u32 = (n: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b }
const u16 = (n: number): Buffer => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b }
const box = (type: string, ...parts: Buffer[]): Buffer => { const body = Buffer.concat(parts); return Buffer.concat([u32(8 + body.length), Buffer.from(type, 'latin1'), body]) }
const full = (type: string, ...parts: Buffer[]): Buffer => box(type, u32(0), ...parts)
const asc = Buffer.from([0x14, 0x08]) // object type 2 (LC), frequency index 8 (16000 Hz), channel config 1
const esds = full('esds', Buffer.concat([Buffer.from([0x03, 0x19, 0, 1, 0]), Buffer.from([0x04, 0x11, 0x40, 0x15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.from([0x05, 0x02]), asc, Buffer.from([0x06, 0x01, 0x02])]))
const mp4a = box('mp4a', Buffer.alloc(6), u16(1), Buffer.alloc(8), u16(1), u16(16), Buffer.alloc(4), u32(16000 << 16), esds)
const stsd = full('stsd', u32(1), mp4a)
const stsz = full('stsz', u32(0), u32(5), u32(100), u32(110), u32(120), u32(130), u32(140))
const stsc = full('stsc', u32(2), u32(1), u32(3), u32(1), u32(2), u32(2), u32(1))
const stco = full('stco', u32(2), u32(1000), u32(5000))
const trak = (handler: string, withAudio: boolean): Buffer => box('trak', box('mdia', full('hdlr', u32(0), Buffer.from(handler, 'latin1'), Buffer.alloc(12)), box('minf', box('stbl', ...(withAudio ? [stsd, stsz, stsc, stco] : [])))))
const moov = (...traks: Buffer[]): Buffer => box('moov', full('mvhd', Buffer.alloc(96)), ...traks)

describe('reading the audio track of an M4A index', () => {
  it('finds the codec, rate, channels, the decoder config and every frame’s place', () => {
    const t = parseMp4Audio(moov(trak('soun', true)))!
    expect(t.codec).toBe('mp4a.40.2')
    expect(t.sampleRate).toBe(16000)
    expect(t.channels).toBe(1)
    expect([...t.description]).toEqual([0x14, 0x08])
    expect(t.samplesPerFrame).toBe(1024)
    expect(t.frames).toEqual([
      { offset: 1000, size: 100 }, { offset: 1100, size: 110 }, { offset: 1210, size: 120 }, // chunk 1: three frames
      { offset: 5000, size: 130 }, { offset: 5130, size: 140 } // chunk 2: two
    ])
  })
  it('trusts the decoder config over the sample entry for the channel count (real files say stereo in one and mono in the other)', () => {
    const lying = Buffer.from(trak('soun', true)) // the sample entry says 1 channel; make it claim 2 while the config still says 1
    const at = lying.indexOf(Buffer.from('mp4a', 'latin1')) + 4 + 6 + 2 + 8
    lying.writeUInt16BE(2, at)
    expect(parseMp4Audio(moov(lying))!.channels).toBe(1)
  })
  it('skips a video track in front of the sound', () => {
    expect(parseMp4Audio(moov(trak('vide', false), trak('soun', true)))?.frames.length).toBe(5)
  })
  it('says nothing for a file with no AAC sound', () => {
    expect(parseMp4Audio(moov(trak('vide', false)))).toBeNull()
    expect(parseMp4Audio(Buffer.from('not an mp4 at all'))).toBeNull()
  })
  it('finds the index by walking the box headers', () => {
    const file = Buffer.concat([box('ftyp', Buffer.from('M4A ')), box('mdat', Buffer.alloc(50)), moov(trak('soun', true))])
    const at = findMoov((p, l) => file.subarray(p, p + l), file.length)!
    expect(file.toString('latin1', at.start + 4, at.start + 8)).toBe('moov')
    expect(parseMp4Audio(file.subarray(at.start, at.start + at.length))?.frames.length).toBe(5)
  })
})
