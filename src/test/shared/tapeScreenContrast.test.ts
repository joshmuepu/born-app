import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(__dirname, '../../renderer/src/components/TapeScreen.css'), 'utf8')
const lin = (c: number): number => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
type RGB = [number, number, number]
const lum = ([r, g, b]: RGB): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const hex = (h: string): RGB => { const f = h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h; return [1, 3, 5].map((i) => parseInt(f.slice(i, i + 2), 16)) as RGB }
const ratio = (a: RGB, b: RGB): number => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const blend = (fg: RGB, bg: RGB, a: number): RGB => fg.map((f, i) => Math.round(a * f + (1 - a) * bg[i])) as RGB

/** the variables a palette sets (the base rule is the dark palette) */
function palette(name: 'dark' | 'light' | 'contrast'): { bg: RGB; fg: RGB; no: RGB; dim: number } {
  const base = /\.tapescreen \{[^}]*?--pj-bg: (#[0-9a-f]{3,6}); --pj-fg: (#[0-9a-f]{3,6}); --pj-dim: ([\d.]+); --pj-no: (#[0-9a-f]{3,6});/.exec(css)!
  let v = { bg: base[1], fg: base[2], dim: base[3], no: base[4] }
  if (name !== 'dark') {
    const rule = new RegExp(`\\.tapescreen--${name} \\{([^}]*)\\}`).exec(css)![1]
    const get = (k: string): string | undefined => new RegExp(`--pj-${k}: ([^;]+);`).exec(rule)?.[1]
    v = { bg: get('bg') ?? v.bg, fg: get('fg') ?? v.fg, dim: get('dim') ?? v.dim, no: get('no') ?? v.no }
  }
  return { bg: hex(v.bg), fg: hex(v.fg), no: hex(v.no), dim: Number(v.dim) }
}

describe('screen palettes: contrast on the colours that are really drawn', () => {
  it.each([['dark', 7], ['light', 7], ['contrast', 7]] as const)('%s: the spoken text and the number are at least AAA (7:1)', (name, min) => {
    const p = palette(name)
    expect(ratio(p.fg, p.bg)).toBeGreaterThanOrEqual(min)
    expect(ratio(p.no, p.bg)).toBeGreaterThanOrEqual(min)
  })
  it.each([['dark', 3], ['light', 3], ['contrast', 7]] as const)('%s: DIMMED text still meets its target (%s:1; the text is large)', (name, min) => {
    const p = palette(name)
    expect(ratio(blend(p.fg, p.bg, p.dim), p.bg)).toBeGreaterThanOrEqual(min)
  })
  it('the other pages of the paragraph being spoken (60 %) are never dimmer than the rest', () => {
    for (const n of ['dark', 'light', 'contrast'] as const) expect(palette(n).dim).toBeLessThanOrEqual(0.6)
    expect(css).toMatch(/\.is-same \{ opacity: 0\.6; \}/)
  })
})
