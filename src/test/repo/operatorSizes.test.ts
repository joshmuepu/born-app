import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// The operator window had text down to 9.9 px (two size tokens below 12 px) and buttons and sub-tabs 22 px high. Nothing the
// operator reads is now under 12 px and nothing to click is under 32 px high. The drawn sizes are measured in the real app at
// 1366x768, 1440x900, 1920x1080 and 150% by scripts/qa/operator-sizes.cjs.
const dir = join(__dirname, '../../renderer/src')
const files = ['App.css', ...readdirSync(join(dir, 'components')).filter((f) => f.endsWith('.css')).map((f) => join('components', f))]
const css = Object.fromEntries(files.map((f) => [f, readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n')]))
const app = css['App.css']

describe('operator text is at least 12 px', () => {
  it('the two smallest size tokens are 12 px', () => {
    expect(app).toMatch(/--text-2xs:\s*0\.75rem;/)
    expect(app).toMatch(/--text-xs:\s*0\.75rem;/)
  })
  it('no fixed text size in the operator window is under 12 px', () => {
    const small: string[] = []
    for (const [f, s] of Object.entries(css)) {
      for (const m of s.matchAll(/font-size:\s*(?:var\(--[a-z0-9-]+,\s*)?([\d.]+)(px|rem)/g)) {
        const px = m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1])
        if (px < 12) small.push(`${f}: ${m[0]}`)
      }
    }
    expect(small).toEqual([])
  })
})

describe('operator controls are at least 32 px high', () => {
  const floor = app.slice(app.lastIndexOf('/* Size floors for the operator window'))
  it('buttons, sub-tabs, the preview switch, the screens rows, the status button and the language list', () => {
    for (const sel of ['button[class*="btn-"]', '.app-logo-born', '.panel-subtab', '.monitor-switch-tab', '.display-row-select', '.status-trigger', '.language-select', '.songs-inline-link']) {
      expect(floor).toContain(sel)
    }
    expect(floor).toMatch(/min-height:\s*32px/)
  })
  it('icon buttons are at least 32 x 32', () => {
    for (const sel of ['.btn-icon', '.display-row-btn', '.search-clear', '.remote-copy', '.screens-refresh']) expect(floor).toContain(sel)
    expect(floor).toMatch(/min-width:\s*32px;\s*min-height:\s*32px/)
  })
  it('the status bar has room for its 32 px button', () => {
    expect(app).toMatch(/\.status-bar \{\n\s*height:\s*34px/)
  })
})
