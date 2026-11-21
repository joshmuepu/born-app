// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import StageApp from '../../renderer/src/StageApp'
import { nextRoomStep, currentFitLimits, SMALLER_TEXT_STEP } from '../../renderer/src/stageRoom'

// With a Next verse showing, the stage cut the end off the current text of long song pages (231 of the 5,219 bundled pages on a 16:9 stage):
// the current text stopped at 55% of its size and the Next band kept a fifth of the screen. Now a page that does not fit gets room for itself
// only: a smaller Next band, then no Next band, then smaller current text, never under 16 px. A page that fits is shown as before.

// jsdom has no layout, so a small model of the stage at 1024x768 (root 12 px): the current box is the screen less the top bar and the Next
// band; the current text is its lines at 1.5 line height plus a label and a reference line; the Next text shows at most 4 lines.
const W = 1024, H = 768, ROOT = 12
const vh = (v: number): number => (H * v) / 100
const band = (): HTMLElement | null => document.querySelector('.stage-next')
const bandPx = (): number => { const b = band(); if (!b) return 0; return vh(parseFloat(b.style.height || '20')) }
const fontPx = (el: Element | null): number => parseFloat((el as HTMLElement | null)?.style.fontSize || '1') * ROOT
const lines = (sel: string): number => (document.querySelector(sel)?.textContent ?? '').split('\n').length
beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: W })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: H })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) {
    if (this.classList.contains('stage-current')) return H - 100 - (band() ? bandPx() + 20 : 0)
    if (this.classList.contains('stage-next')) return bandPx()
    if (this.classList.contains('stage-next-fit')) return bandPx() - 60
    return 10000
  } })
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get(this: HTMLElement) {
    const parent = this.parentElement
    if (parent?.classList.contains('stage-current')) { const f = fontPx(parent); return lines('.stage-current-text') * f * 1.5 + 2 * f }
    if (parent?.classList.contains('stage-next-fit')) { const f = fontPx(parent); return Math.min(4, lines('.stage-next-text')) * f * 1.45 + 16 }
    return this.clientHeight
  } })
})
afterEach(() => cleanup())

const text = (n: number): string => Array.from({ length: n }, (_, i) => `Placeholder line ${i + 1}`).join('\n')
async function show(currentLines: number, withNext = true): Promise<{ box: HTMLElement; px: number; cut: boolean }> {
  localStorage.setItem('born.stageView', 'stage')
  let push: (d: { current: unknown; next: unknown }) => void = () => {}
  Object.assign(window.electronAPI, {
    onStageUpdate: vi.fn((cb) => { push = cb; return () => {} }), onStageSetBlank: vi.fn(() => () => {}), onStageAlert: vi.fn(() => () => {}), notifyStageReady: vi.fn()
  })
  render(<StageApp />)
  await act(async () => {
    push({ current: { kind: 'song', label: 'Verse 1', text: text(currentLines), reference: 'Invented Song' }, next: withNext ? { kind: 'song', label: 'Verse 2', text: text(4), reference: 'Invented Song' } : null })
  })
  const box = document.querySelector('.stage-current') as HTMLElement
  return { box, px: fontPx(box), cut: (box.firstElementChild as HTMLElement).scrollHeight > box.clientHeight + 1 }
}
const start = Math.min(Math.max((W * 0.042) / ROOT, 2), 5) * ROOT // 43 px

describe('the stage current text is never cut', () => {
  it('a page that fits is shown as before: full Next band, the usual fit', async () => {
    const r = await show(6)
    expect(r.cut).toBe(false)
    expect(band()).not.toBeNull()
    expect(band()!.getAttribute('style')).toBeNull()
    const fit = document.querySelector('.stage-next-fit') as HTMLElement
    expect(parseFloat(fit.style.fontSize)).toBeLessThanOrEqual(parseFloat(r.box.style.fontSize))
  })
  it('a page that fits at 55% keeps the Next band and stops at 55%', async () => {
    const r = await show(11)
    expect(r.cut).toBe(false)
    expect(band()).not.toBeNull()
    expect(r.px).toBeGreaterThanOrEqual(start * 0.55 - 0.01)
  })
  it('a 15-line page, cut before, fits once the Next band is hidden, at no less than 55%', async () => {
    const r = await show(15)
    expect(r.cut).toBe(false)
    expect(band()).toBeNull()
    expect(r.px).toBeGreaterThanOrEqual(start * 0.55 - 0.01)
  })
  it('a 20-line page goes smaller than 55%, only as far as it needs, and is not cut', async () => {
    const r = await show(20)
    expect(r.cut).toBe(false)
    expect(band()).toBeNull()
    expect(r.px).toBeLessThan(start * 0.55)
    expect(r.px).toBeGreaterThanOrEqual(16)
  })
  it('the last page (no Next) goes smaller only if it must', async () => {
    expect((await show(15, false)).px).toBeGreaterThanOrEqual(start * 0.55 - 0.01)
    cleanup()
    const r = await show(20, false)
    expect(r.cut).toBe(false)
    expect(r.px).toBeGreaterThanOrEqual(16)
  })
  it('never under 16 px: a page too long even at 16 px stays at 16 px', async () => {
    const r = await show(40)
    expect(r.px).toBeCloseTo(16, 1)
    expect(r.cut).toBe(true)
  })
})

describe('the steps', () => {
  it('step 0 moves on only for cut current text', () => {
    expect(nextRoomStep(0, true, false, true)).toBeNull()
    expect(nextRoomStep(0, true, true, false)).toBe(1)
    expect(nextRoomStep(0, false, true, false)).toBe(SMALLER_TEXT_STEP)
  })
  it('a smaller Next band that cuts its own text moves on too, and the last step is the last', () => {
    expect(nextRoomStep(1, true, false, true)).toBe(2)
    expect(nextRoomStep(SMALLER_TEXT_STEP, true, true, false)).toBeNull()
  })
  it('the usual limits until the last step, then 16 px at any root size', () => {
    expect(currentFitLimits(0, 3, 16)).toEqual({ minRem: 0.9, floorRatio: 0.55 })
    for (const root of [12, 16, 32]) {
      const l = currentFitLimits(SMALLER_TEXT_STEP, 5, root)
      expect(Math.max(l.minRem, 5 * l.floorRatio) * root).toBeCloseTo(16, 5)
    }
  })
})
