import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/** Guards the colour tokens (src/renderer/src/App.css) against contrast
 *  regressions: every text/background and UI-component pair the app actually
 *  uses must meet WCAG 2.1 AA (AAA for the high-contrast overlay's text). */

const css = readFileSync(resolve(__dirname, '../../renderer/src/App.css'), 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector + ' {')
  if (start < 0) throw new Error(`token block not found: ${selector}`)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) out[m[1]] = m[2].trim()
  return out
}

const dark = block(":root,\n:root[data-theme='dark']")
const light = block(":root[data-theme='light']")
// The first high-contrast selector (:root[data-contrast='true']) matches BOTH base
// themes, so it sits under the light overrides in the real cascade too.
const contrastGeneric = block(":root[data-contrast='true'],\n:root[data-contrast='true'][data-theme='dark']")
const contrastDark = { ...dark, ...contrastGeneric }
const contrastLight = { ...light, ...contrastGeneric, ...block(":root[data-contrast='true'][data-theme='light']") }

type RGB = [number, number, number]
function hex(v: string): RGB {
  const m = /^#([0-9a-f]{6})$/i.exec(v)
  if (!m) throw new Error(`not a #rrggbb colour: ${v}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function lum([r, g, b]: RGB): number {
  const f = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function ratio(a: string, b: string): number {
  const la = lum(hex(a))
  const lb = lum(hex(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const themes: Array<[string, Record<string, string>, boolean]> = [
  ['dark', dark, false],
  ['light', light, false],
  ['high-contrast dark', contrastDark, true],
  ['high-contrast light', contrastLight, true]
]

const SURFACES = ['bg-primary', 'bg-secondary', 'bg-panel', 'bg-hover']
const SURFACES_ALL = [...SURFACES, 'bg-active']
const CONTENT = ['sermons', 'bible', 'songs', 'screens', 'media']

describe.each(themes)('%s theme contrast', (_name, t, strong) => {
  const min = (aa: number, aaa: number): number => (strong ? aaa : aa)

  it.each(SURFACES)('primary and secondary text on %s', (bg) => {
    expect(ratio(t['text-primary'], t[bg])).toBeGreaterThanOrEqual(min(7, 12))
    expect(ratio(t['text-secondary'], t[bg])).toBeGreaterThanOrEqual(min(4.5, 7))
  })

  it.each(SURFACES)('tertiary text on %s', (bg) => {
    expect(ratio(t['text-tertiary'], t[bg])).toBeGreaterThanOrEqual(min(4.5, 7))
  })

  it.each(['bg-primary', 'bg-secondary', 'bg-panel'])('accent text on %s', (bg) => {
    expect(ratio(t['accent'], t[bg])).toBeGreaterThanOrEqual(min(4.5, 7))
  })

  it('text on a filled accent button', () => {
    expect(ratio(t['on-accent'], t['accent'])).toBeGreaterThanOrEqual(min(4.5, 7))
    expect(ratio(t['on-accent'], t['accent-hover'])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(CONTENT)('%s identity colour as text on every surface', (c) => {
    for (const bg of SURFACES) {
      expect(ratio(t[c], t[bg])).toBeGreaterThanOrEqual(min(4.5, 7))
    }
  })

  it.each(CONTENT)('%s filled-badge text', (c) => {
    expect(ratio(t['on-' + c], t[c])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['live', 'danger', 'ok', 'warn'])('%s status colour as text', (c) => {
    for (const bg of SURFACES) {
      expect(ratio(t[c], t[bg])).toBeGreaterThanOrEqual(min(4.5, 7))
    }
  })

  it('live is readable on a selected (bg-active) row', () => {
    expect(ratio(t['live'], t['bg-active'])).toBeGreaterThanOrEqual(min(3, 4.5))
    expect(ratio(t['text-secondary'], t['bg-active'])).toBeGreaterThanOrEqual(4.5)
  })

  it('danger button text', () => {
    expect(ratio(t['on-danger'], t['danger'])).toBeGreaterThanOrEqual(4.5)
  })

  it('component boundaries and focus ring are at least 3:1', () => {
    for (const bg of ['bg-primary', 'bg-secondary', 'bg-panel']) {
      expect(ratio(t['border-strong'], t[bg])).toBeGreaterThanOrEqual(3)
      expect(ratio(t['accent'], t[bg])).toBeGreaterThanOrEqual(3)
    }
  })

  it('live is distinguishable from the OK and warning colours by hue, not just shade', () => {
    const [lr, lg] = hex(t['live'])
    expect(lr).toBeGreaterThan(lg + 40) // red-dominant
    const [, og] = hex(t['ok'])
    expect(og).toBeGreaterThan(lr * 0.5) // ok is not red-dominant
  })
})

// ── The phone remote ships its own tokens (src/main/remoteAssets.ts) ──────────
const remoteSrc = readFileSync(resolve(__dirname, '../../main/remoteAssets.ts'), 'utf8')
function remoteTokens(from: number): Record<string, string> {
  const open = remoteSrc.indexOf(':root{', from)
  const body = remoteSrc.slice(open, remoteSrc.indexOf('}', open))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2]
  return out
}
const remoteDark = remoteTokens(remoteSrc.indexOf('APP_CSS'))
const remoteLight = { ...remoteDark, ...remoteTokens(remoteSrc.indexOf('prefers-color-scheme: light')) }

describe.each([
  ['remote dark', remoteDark],
  ['remote light', remoteLight]
] as Array<[string, Record<string, string>]>)('%s contrast', (_n, t) => {
  it.each(['bg', 'surface', 'surface2'])('text tiers on %s', (bg) => {
    expect(ratio(t['text'], t[bg])).toBeGreaterThanOrEqual(7)
    expect(ratio(t['text2'], t[bg])).toBeGreaterThanOrEqual(4.5)
    expect(ratio(t['text3'], t[bg])).toBeGreaterThanOrEqual(4.5)
  })
  it.each(['bg', 'surface', 'surface2'])('accent, status and identity colours on %s', (bg) => {
    for (const c of ['accent', 'live', 'ok', 'warn', 'sage', 'amber', 'stone']) {
      expect(ratio(t[c], t[bg])).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('text on the filled accent (Next) button', () => {
    expect(ratio(t['accent-ink'], t['accent'])).toBeGreaterThanOrEqual(4.5)
  })
})
