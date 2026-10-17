import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(__dirname, '../../renderer/src/App.css'), 'utf8')

describe('target sizes (P-09)', () => {
  it('defines the three tiers', () => {
    expect(css).toMatch(/--target-min: 32px; --target-live: 40px; --target-touch: 44px;/)
  })
  it('every kind of button, the sub-tabs and the small icon buttons have the minimum', () => {
    const rule = css.match(/:root \.app :is\(\.btn-sm[^)]*\) \{[^}]*\}/)?.[0] ?? ''
    for (const c of ['.btn-sm', '.btn-quiet', '.btn-secondary', '.btn-primary', '.btn-danger', '.panel-subtab', '.media-mini', '.browse-view-toggle button', 'select.language-select']) expect(rule, c).toContain(c)
    expect(rule).toContain('min-height: var(--target-min)')
    expect(css).toMatch(/:root \.app \.btn-icon \{ min-width: var\(--target-min\); min-height: var\(--target-min\);/)
  })
  it('the live-critical controls (Show, Hide screen, Open/Close projection, Play) are the larger tier', () => {
    expect(css).toMatch(/\.plp-take, \.plp-clear, \.gtb-play\) \{ min-height: var\(--target-live\); \}/)
    expect(css).toMatch(/\.app-header > \.header-actions > \.btn-danger/)
  })
  it('touch screens get the largest tier', () => {
    expect(css).toMatch(/@media \(pointer: coarse\) \{\s*:root \.app :is\([^)]*\) \{ min-height: var\(--target-touch\); \}/)
  })
})
