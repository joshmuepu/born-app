import { describe, it, expect, vi } from 'vitest'
vi.mock('electron', () => ({ BrowserWindow: class {}, Menu: { getApplicationMenu: () => null }, ipcMain: { on: vi.fn() }, screen: { on: vi.fn(), removeListener: vi.fn() } }))
import { fitZoom, largestFittingFactor, nextChosenLevel, levelToFactor, factorToLevel, LAYOUT_MIN } from '../../main/operatorZoom'

// Zoomed in on a small operator window, the header's buttons ran off the right edge (from about 158% on a 1040x640 window). The window now
// shows the largest zoom, up to the chosen one, that still gives the layout 1040x640, and never less than 100%.
const MAX = factorToLevel(5)

describe('operator window zoom fitted to the window', () => {
  it('the largest fitting zoom leaves the layout at least 1040x640, and is never under 100%', () => {
    for (const [w, h] of [[1040, 640], [1280, 800], [1600, 900], [1920, 1080], [2560, 1440], [960, 600]]) {
      const f = largestFittingFactor({ width: w, height: h })
      expect(f).toBeGreaterThanOrEqual(1)
      if (f > 1) {
        expect(w / f).toBeGreaterThanOrEqual(LAYOUT_MIN.width - 0.01)
        expect(h / f).toBeGreaterThanOrEqual(LAYOUT_MIN.height - 0.01)
      }
    }
  })
  it('on the smallest window the largest zoom is shown at 100% and said to be reduced', () => {
    expect(fitZoom(MAX, { width: 1040, height: 640 })).toEqual({ level: 0, reduced: true })
  })
  it('on larger windows the largest zoom is reduced to what fits', () => {
    const r = fitZoom(MAX, { width: 1920, height: 1080 })
    expect(r.reduced).toBe(true)
    expect(levelToFactor(r.level)).toBeCloseTo(1080 / 640, 5)
  })
  it('a zoom that fits is shown as chosen, with no notice', () => {
    expect(fitZoom(1, { width: 1920, height: 1080 })).toEqual({ level: 1, reduced: false })
    expect(fitZoom(0, { width: 1040, height: 640 })).toEqual({ level: 0, reduced: false })
  })
  it('zooming out below 100% is left as it is', () => {
    expect(fitZoom(-2, { width: 1040, height: 640 })).toEqual({ level: -2, reduced: false })
  })
  it('only the window size in screen points counts, so moving to a display with other scaling keeps the same fit', () => {
    expect(fitZoom(3, { width: 1280, height: 800 })).toEqual(fitZoom(3, { width: 1280, height: 800 }))
  })
  it('a menu step while reduced moves the chosen zoom, Actual Size resets it, and no change keeps it', () => {
    expect(nextChosenLevel(4, 1.2, 1.7)).toBeCloseTo(4.5)
    expect(nextChosenLevel(4, 1.2, 0.7)).toBeCloseTo(3.5)
    expect(nextChosenLevel(4, 1.2, 0)).toBe(0)
    expect(nextChosenLevel(4, 1.2, 1.2)).toBe(4)
    expect(nextChosenLevel(MAX, 1.2, 1.7)).toBeCloseTo(MAX)
  })
})
