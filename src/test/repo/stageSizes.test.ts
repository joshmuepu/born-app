import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// The stage monitor's sizes were pixel caps made for 1080-line screens: on a 4K TV the text was a small share of the screen. Its root
// text size now grows with the screen height, every stage size is in rem (or a share of the screen), and its captions are 1 rem.
// The real drawn sizes and colours are measured in the app by scripts/qa/screen-sizes.cjs.
const css = readFileSync(join(__dirname, '../../renderer/src/StageApp.css'), 'utf8').replace(/\r\n/g, '\n')
const block = (sel: string): string => {
  const m = css.match(new RegExp('(?:^|\\n)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}'))
  return m ? m[1] : ''
}
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

