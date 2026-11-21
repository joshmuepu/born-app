import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { currentFitLimits, SMALLER_TEXT_STEP, STAGE_TEXT_MIN_PX } from '../../renderer/src/stageRoom'

// The stage monitor's root text size is never under 12 px. Measured in the real app for every bundled song page and the 3,000 longest Bible pages,
// at screen heights from 720 to 2160 lines, that floor never makes any stage text small: it applies only below 810 lines, where it makes the
// root larger (12 px instead of 10.7 px at 720 lines), the current text is never under 23.7 px and the Next text never under 13.5 px. These pin
// that arithmetic, so a change that could bring stage text under 12 px is seen.
const tsx = readFileSync(join(__dirname, '../../renderer/src/StageApp.tsx'), 'utf8').replace(/\r\n/g, '\n')
const css = readFileSync(join(__dirname, '../../renderer/src/StageApp.css'), 'utf8').replace(/\r\n/g, '\n')
const num = (re: RegExp): number[] => (tsx.match(re) ?? []).slice(1).map(Number)

describe('the stage monitor text floor', () => {
  it('the root is the screen height / 67.5, never under 12 px', () => {
    expect(css).toMatch(/html \{\s*font-size: max\(12px, calc\(100vh \/ 67\.5\)\);/)
    expect(tsx).toMatch(/const rootPx = Math\.max\(12, screen\.h \/ 67\.5\)/)
  })
  it('the 12 px root floor only applies below 810 lines', () => {
    expect(Math.max(12, 720 / 67.5)).toBe(12)
    expect(Math.max(12, 810 / 67.5)).toBe(12)
    expect(Math.max(12, 900 / 67.5)).toBeGreaterThan(12)
  })
  it('the current text can never be fitted under 12 px on a stage from 720 to 2160 lines, 4:3 to 21:9', () => {
    const [pct, minRem, maxRem] = num(/const currentBase = clampRem\(([\d.]+), ([\d.]+), ([\d.]+)\)/)
    expect([pct, minRem, maxRem]).toEqual([0.042, 2, 5])
    expect(currentFitLimits(0, 3, 16)).toEqual({ minRem: 0.9, floorRatio: 0.55 })
    let smallest = Infinity
    for (let h = 720; h <= 2160; h += 12) for (const aspect of [4 / 3, 16 / 10, 16 / 9, 21 / 9]) {
      const root = Math.max(12, h / 67.5)
      const base = Math.min(Math.max((h * aspect * pct) / root, minRem), maxRem)
      const usual = currentFitLimits(0, base, root), last = currentFitLimits(SMALLER_TEXT_STEP, base, root)
      smallest = Math.min(smallest, Math.max(usual.minRem, base * usual.floorRatio) * root)
      // a page that needs more room still never goes under 16 px
      expect(Math.max(last.minRem, base * last.floorRatio) * root).toBeCloseTo(STAGE_TEXT_MIN_PX, 5)
    }
    expect(smallest).toBeGreaterThanOrEqual(12)
    expect(smallest).toBeCloseTo(22.2, 1) // a 4:3 stage at 720 lines: 55% of 4.2% of 960 px
  })
  it('the Next text keeps its own smallest size (0.9 rem, 10.8 px under 810 lines), which no bundled page reaches', () => {
    expect(tsx).toMatch(/useAutoFitFontSize\(nextRef, [^\n]*Math\.min\(clampRem\(0\.024, 1\.1, 2\.6\), currentRem\), 0\.9, 0\.3\)/)
  })
})
