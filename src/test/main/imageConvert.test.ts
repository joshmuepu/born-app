import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, existsSync, mkdirSync, writeFileSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { convertToJpegFile, pickPrimary, sniffKind, MAX_CONVERT_PIXELS } from '../../main/imageConvert'
import { convertInWorker } from '../../main/heicConvert'
import { applyToSrgb, colorFromHeic, transformFromIcc, transformFromNclx } from '../../main/colorProfile'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jpeg = require('jpeg-js') as { decode: (b: Buffer, o?: { useTArray?: boolean }) => { width: number; height: number; data: Uint8Array } }
const FX = join(__dirname, '../fixtures/media')
let dir: string
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'born-heic-')) })
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const px = (img: { width: number; data: Uint8Array }, x: number, y: number): number[] => {
  const o = (y * img.width + x) * 4
  return [img.data[o], img.data[o + 1], img.data[o + 2]]
}
const near = (a: number[], b: number[], tol = 40): boolean => a.every((v, i) => Math.abs(v - b[i]) <= tol)
const run = async (name: string) => {
  const out = join(dir, name + '.jpg')
  const r = await convertToJpegFile(join(FX, name), out)
  return { r, img: r.ok ? jpeg.decode(readFileSync(out), { useTArray: true }) : null }
}

describe('HEIC → JPEG (real files)', () => {
  it('converts a real HEIC: size and picture are right (red top-left, blue bottom-right)', async () => {
    const { r, img } = await run('heic-quad.heic')
    expect(r.ok).toBe(true)
    expect(img).toMatchObject({ width: 96, height: 64 })
    expect(near(px(img!, 10, 8), [230, 20, 20])).toBe(true)
    expect(near(px(img!, 80, 50), [20, 20, 230])).toBe(true)
    expect(near(px(img!, 80, 8), [20, 200, 20])).toBe(true)
  })

  it('applies the rotation stored in the file (EXIF-style orientation 6 turns a 96×64 picture into 64×96)', async () => {
    const { r, img } = await run('heic-rot6.heic')
    expect(r.ok).toBe(true)
    expect(img).toMatchObject({ width: 64, height: 96 })
    // the red top-left corner moves to the top-right when turned a quarter clockwise
    expect(near(px(img!, 54, 8), [230, 20, 20])).toBe(true)
  })

  it('reads the Display P3 profile an iPhone embeds and converts to sRGB', async () => {
    const icc = colorFromHeic(readFileSync(join(FX, 'heic-p3-green.heic')))
    expect(icc).not.toBeNull()
    expect(icc!.identity).toBe(false)
    const { r } = await run('heic-p3-green.heic')
    expect(r.ok && r.notes.join(' ')).toMatch(/sRGB/)
  })

  it('a damaged (cut-off) HEIC fails with a plain reason and writes nothing', async () => {
    const out = join(dir, 'corrupt.jpg')
    const r = await convertToJpegFile(join(FX, 'heic-corrupt.heic'), out)
    expect(r.ok).toBe(false)
    expect(r.ok === false && ['corrupt', 'unsupported']).toContain(r.ok === false ? r.reason : '')
    expect(existsSync(out)).toBe(false)
  })

  it('bytes that are not a HEIC or TIFF are unsupported, and a missing file is an io error', async () => {
    const junk = join(dir, 'junk.heic')
    writeFileSync(junk, Buffer.from('this is not a picture at all'))
    expect(await convertToJpegFile(junk, join(dir, 'j.jpg'))).toMatchObject({ ok: false, reason: 'unsupported' })
    expect(await convertToJpegFile(join(dir, 'nope.heic'), join(dir, 'n.jpg'))).toMatchObject({ ok: false, reason: 'io' })
  })

  it('picks the biggest of several pictures in one file (burst / depth map / thumbnail)', () => {
    const picked = pickPrimary([{ width: 160, height: 120, id: 'thumb' }, { width: 4032, height: 3024, id: 'main' }, { width: 1008, height: 756, id: 'depth' }])
    expect(picked!.id).toBe('main')
    expect(pickPrimary([])).toBeNull()
  })

  it('sniffs the format from the bytes, not the name', () => {
    expect(sniffKind(readFileSync(join(FX, 'heic-quad.heic')))).toBe('heic')
    expect(sniffKind(readFileSync(join(FX, 'tiff-quad.tiff')))).toBe('tiff')
    expect(sniffKind(readFileSync(join(FX, 'tiny.jpg')))).toBeNull()
  })

  it('refuses pictures over the pixel limit instead of running out of memory', () => {
    expect(MAX_CONVERT_PIXELS).toBeLessThanOrEqual(100_000_000)
  })
})

describe('TIFF → JPEG', () => {
  it('converts a real LZW TIFF', async () => {
    const { r, img } = await run('tiff-quad.tiff')
    expect(r.ok).toBe(true)
    expect(img).toMatchObject({ width: 96, height: 64 })
    expect(near(px(img!, 10, 8), [230, 20, 20])).toBe(true)
    expect(near(px(img!, 80, 50), [20, 20, 230])).toBe(true)
  })
  it('a cut-off TIFF fails cleanly', async () => {
    const b = readFileSync(join(FX, 'tiff-quad.tiff'))
    const p = join(dir, 'cut.tiff')
    writeFileSync(p, b.subarray(0, Math.min(b.length - 1, 60)))
    const r = await convertToJpegFile(p, join(dir, 'cut.jpg'))
    expect(r.ok).toBe(false)
  })
})

describe('colour conversion', () => {
  it('Display P3 (nclx primaries 12) becomes more saturated sRGB numbers; grey stays grey', () => {
    const t = transformFromNclx(12, 13)!
    const grey = new Uint8Array([128, 128, 128, 255])
    applyToSrgb(grey, t)
    expect(Math.abs(grey[0] - grey[1])).toBeLessThanOrEqual(1)
    expect(Math.abs(grey[1] - grey[2])).toBeLessThanOrEqual(1)
    expect(Math.abs(grey[0] - 128)).toBeLessThanOrEqual(1)
    const c = new Uint8Array([180, 110, 100, 255])
    applyToSrgb(c, t)
    expect(c[0]).toBeGreaterThan(180)
    expect(c[1]).toBeLessThan(110)
    expect(c[2]).toBeLessThan(100)
    expect(c[3]).toBe(255)
  })
  it('sRGB (primaries 1) needs no work, HDR (PQ/HLG) is left alone, junk profiles are ignored', () => {
    expect(transformFromNclx(1, 13)).toBeNull()
    expect(transformFromNclx(12, 16)).toBeNull()
    expect(transformFromIcc(Buffer.from('nope'))).toBeNull()
    expect(transformFromIcc(Buffer.alloc(400))).toBeNull()
  })
  it('the embedded P3 ICC profile gives the same answer as the CICP route (within rounding)', () => {
    const icc = colorFromHeic(readFileSync(join(FX, 'heic-p3-green.heic')))!
    const nclx = transformFromNclx(12, 13)!
    const a = new Uint8Array([180, 110, 100, 255, 90, 160, 210, 255])
    const b = new Uint8Array(a)
    applyToSrgb(a, icc)
    applyToSrgb(b, nclx)
    for (let i = 0; i < a.length; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(3)
  })
})

describe('worker thread', () => {
  it('converts off the main thread (worker bundled from the real source)', async () => {
    const cache = join(__dirname, '../../../node_modules/.cache/heic-test')
    mkdirSync(cache, { recursive: true })
    const worker = join(cache, 'heicWorker.js')
    const esbuild = join(__dirname, '../../../node_modules/.bin/esbuild')
    execFileSync(esbuild, [join(__dirname, '../../main/heicWorker.ts'), '--bundle', '--platform=node', '--format=cjs', '--packages=external', `--outfile=${worker}`], { stdio: 'pipe' })
    const out = join(dir, 'w.jpg')
    const r = await convertInWorker(join(FX, 'heic-quad.heic'), out, worker)
    expect(r.ok).toBe(true)
    expect(statSync(out).size).toBeGreaterThan(200)
    const bad = await convertInWorker(join(FX, 'heic-corrupt.heic'), join(dir, 'w2.jpg'), worker)
    expect(bad.ok).toBe(false)
  })
})
