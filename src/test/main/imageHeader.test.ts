import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { orientedSize, readImageHeader, sniffFormat } from '../../main/imageHeader'

const fx = (n: string): Buffer => readFileSync(join(__dirname, '../fixtures/media', n))

describe('imageHeader: format, size, rotation and animation from the first bytes', () => {
  it('reads JPEG size and treats EXIF orientation 6 as a 90° turn', () => {
    const h = readImageHeader(fx('exif6.jpg'))
    expect(h.format).toBe('jpeg')
    expect([h.width, h.height]).toEqual([64, 48])
    expect(h.orientation).toBe(6)
    expect(orientedSize(h)).toEqual({ width: 48, height: 64 })
  })
  it('an upright JPEG keeps its size', () => {
    const h = readImageHeader(fx('tiny.jpg'))
    expect(h.orientation).toBe(1)
    expect(orientedSize(h)).toEqual({ width: 64, height: 48 })
  })
  it('PNG: size and alpha', () => {
    expect(readImageHeader(fx('tiny.png'))).toMatchObject({ format: 'png', width: 64, height: 48, hasAlpha: false, animated: false })
    expect(readImageHeader(fx('alpha.png')).hasAlpha).toBe(true)
  })
  it('GIF: distinguishes a single frame from an animation', () => {
    expect(readImageHeader(fx('static.gif'))).toMatchObject({ format: 'gif', width: 64, height: 48, animated: false })
    expect(readImageHeader(fx('anim.gif'))).toMatchObject({ format: 'gif', width: 48, height: 32, animated: true })
  })
  it('WebP: size and animation', () => {
    expect(readImageHeader(fx('still.webp'))).toMatchObject({ format: 'webp', width: 64, height: 48, animated: false })
    expect(readImageHeader(fx('anim.webp'))).toMatchObject({ format: 'webp', width: 48, height: 32, animated: true })
  })
  it('BMP size', () => {
    expect(readImageHeader(fx('tiny.bmp'))).toMatchObject({ format: 'bmp', width: 64, height: 48 })
  })
  it('sniffs by content, not by file name', () => {
    expect(sniffFormat(fx('fake-named.png'))).toBe('jpeg')
    expect(sniffFormat(fx('tiny.avif'))).toBe('avif')
    expect(sniffFormat(fx('phone.heic'))).toBe('heic')
  })
  it('recognises things that are not pictures', () => {
    expect(sniffFormat(fx('doc.pdf'))).toBe('pdf')
    expect(sniffFormat(fx('clip.mp4'))).toBe('video')
    expect(sniffFormat(fx('song.mp3'))).toBe('audio')
    expect(sniffFormat(fx('drawing.svg'))).toBe('svg')
    expect(sniffFormat(fx('not-an-image.jpg'))).toBe('unknown')
    expect(sniffFormat(Buffer.alloc(0))).toBe('unknown')
  })
  it('never throws on damaged or tiny input', () => {
    for (const b of [Buffer.alloc(0), Buffer.from([0xff, 0xd8, 0xff]), fx('truncated.jpg').subarray(0, 20), Buffer.from('RIFF....WEBP'), Buffer.from('GIF89a')]) {
      expect(() => readImageHeader(b)).not.toThrow()
    }
  })
})
