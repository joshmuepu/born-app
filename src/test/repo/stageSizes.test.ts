import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// The stage monitor's sizes were pixel caps made for 1080-line screens: on a 4K TV the text was a small share of the screen. Its root
// text size now grows with the screen height, every stage size is in rem (or a share of the screen), and its captions are 1 rem.
// Three of its colours were too faint to read from the platform (3.05:1 and less); every stage colour now reaches 4.5:1.
// The real drawn sizes and colours are measured in the app by scripts/qa/screen-sizes.cjs.
const css = readFileSync(join(__dirname, '../../renderer/src/StageApp.css'), 'utf8').replace(/\r\n/g, '\n')
const block = (sel: string): string => {
  const m = css.match(new RegExp('(?:^|\\n)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}'))
  return m ? m[1] : ''
}
const lum = (hex: string): number => {
  const c = hex.replace('#', '')
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c
  const f = (v: number): number => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const [r, g, b] = [0, 2, 4].map((i) => f(parseInt(full.slice(i, i + 2), 16)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string): number => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('stage monitor sizes are a share of the screen height', () => {
  it('the root text size is the screen height / 67.5 (16 px at 1080 lines, 32 px at 2160), at least 12 px', () => {
    expect(block('html')).toMatch(/font-size:\s*max\(12px,\s*calc\(100vh \/ 67\.5\)\)/)
  })
  it('no stage size is a pixel cap (borders, corners and the hairline gaps excepted)', () => {
    const sizes = css.match(/(?:font-size|padding|margin[a-z-]*|gap):[^;]*\d+px/g) ?? []
    expect(sizes.filter((d) => !/^font-size:\s*max\(12px/.test(d) && !/^(gap|padding):\s*[23]px$/.test(d))).toEqual([])
  })
  it('the captions (the current label, Next, the view switch) are 1 rem', () => {
    for (const sel of ['.stage-current-label', '.stage-next-label', '.stage-viewpick button']) expect(block(sel)).toMatch(/font-size:\s*1rem;/)
  })
})

describe('stage colours', () => {
  const bg = '#0a0a0a'
  const colours = [...css.matchAll(/(?:^|\n)([^{}\n]+) \{[^}]*?\n\s*color:\s*(#[0-9a-fA-F]{3,6});/g)].map((m) => [m[1].trim(), m[2]] as const)
  it('found the stage text colours', () => { expect(colours.length).toBeGreaterThan(8) })
  for (const sel of ['.stage-current-label', '.stage-current-ref', '.stage-next-label', '.stage-next-ref', '.stage-marker', '.stage-next-text--empty']) {
    it(`${sel} reaches 6.6:1 on the stage background`, () => {
      const c = colours.find(([s]) => s === sel)?.[1]
      expect(c).toBeDefined()
      expect(contrast(c!, bg)).toBeGreaterThanOrEqual(6.6)
    })
  }
  it('the three faint colours are gone', () => {
    expect(css).not.toMatch(/color:\s*(#3a6186|#5a5a5a|#666);/i)
  })
})
