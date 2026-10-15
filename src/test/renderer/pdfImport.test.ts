import { describe, it, expect } from 'vitest'
import { pdfPageScale, mapPdfError, PDF_LIMITS, PDF_MESSAGES, importPdf } from '../../renderer/src/pdfImport'

describe('pdf import: geometry and messages', () => {
  it('fits a slide-shaped page in the render box', () => {
    const s = pdfPageScale(720, 405) // 16:9 PowerPoint export, in points
    expect(720 * s).toBeLessThanOrEqual(PDF_LIMITS.boxW + 0.5)
    expect(405 * s).toBeLessThanOrEqual(PDF_LIMITS.boxH + 0.5)
    expect(720 * s).toBeCloseTo(PDF_LIMITS.boxW, 0)
  })
  it('fits a portrait letter page by height', () => {
    const s = pdfPageScale(612, 792)
    expect(792 * s).toBeCloseTo(PDF_LIMITS.boxH, 0)
    expect(612 * s).toBeLessThan(PDF_LIMITS.boxW)
  })
  it('a huge poster-sized page stays inside the pixel budget', () => {
    const w = 5000, h = 5000
    const s = pdfPageScale(w, h)
    expect(w * s * h * s).toBeLessThanOrEqual(PDF_LIMITS.maxPixels * 1.01)
  })
  it('nonsense sizes cannot produce a zero or infinite scale', () => {
    for (const [w, h] of [[0, 0], [-1, 5], [NaN, 3]] as Array<[number, number]>) {
      const s = pdfPageScale(w, h)
      expect(Number.isFinite(s) && s > 0).toBe(true)
    }
  })
  it('maps pdf.js errors to plain messages', () => {
    expect(mapPdfError({ name: 'PasswordException', message: 'No password given' })).toBe('password')
    expect(mapPdfError({ name: 'InvalidPDFException', message: 'Invalid PDF structure.' })).toBe('invalid')
    expect(mapPdfError(new Error('something odd'))).toBe('invalid')
    expect(PDF_MESSAGES.password).toMatch(/password/i)
  })
  it('refuses a non-PDF and an oversized buffer without touching pdf.js or the library', async () => {
    const deps = { importBuffer: async () => { throw new Error('must not be called') }, remove: async () => undefined, createFolder: async () => null }
    const notPdf = await importPdf(new TextEncoder().encode('hello').buffer as ArrayBuffer, 'x.pdf', deps as never)
    expect(notPdf).toMatchObject({ ok: false, code: 'invalid' })
    const big = await importPdf({ byteLength: PDF_LIMITS.maxBytes + 1, slice: () => new ArrayBuffer(0) } as unknown as ArrayBuffer, 'big.pdf', deps as never)
    expect(big).toMatchObject({ ok: false, code: 'too-large' })
  })
})
