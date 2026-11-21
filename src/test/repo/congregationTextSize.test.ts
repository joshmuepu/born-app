import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// The congregation screen's text started at 6.2% of the screen height, capped at 132 px, so it was smaller than the stage monitor's
// current text on most screens (67 px against 80 px on a 1080p screen, 132 px against 160 px on a 4K one). It now starts at the
// stage's size, with the operator's Projected text size still scaling it. The drawn sizes are compared in the real app by
// scripts/qa/screen-sizes.cjs.
const src = (f: string): string => readFileSync(join(__dirname, '../../renderer/src', f), 'utf8').replace(/\r\n/g, '\n')

describe('congregation screen text size', () => {
  const proj = src('ProjectionApp.tsx')
  it('starts from the stage monitor current-text size', () => {
    expect(proj).toMatch(/const rootPx = Math\.max\(12, viewport\.h \/ 67\.5\)/)
    expect(proj).toMatch(/const basePx = Math\.min\(Math\.max\(viewport\.w \* 0\.042, 2 \* rootPx\), 5 \* rootPx\)/)
    expect(src('StageApp.tsx')).toMatch(/const currentBase = clampRem\(0\.042, 2, 5\)/)
  })
  it('the operator text size still scales it', () => {
    expect(proj).toMatch(/const baseRem = \(basePx \/ 16\) \* \(fontSize \/ 4\.5\)/)
  })
  it('has no pixel cap', () => {
    expect(proj).not.toMatch(/Math\.min\(Math\.max\(viewport\.h/)
  })
})
