import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// The congregation screen's side margins were a fixed 100 px: a tenth of the width each side on a 1024x768 projector, 2.6% on a 4K
// screen. They are now 5% of the width at every resolution, for the text, the label and the reference line, which share one column.
// The drawn margins are measured in the real app by scripts/qa/screen-sizes.cjs (ONLY=congregation-margins).
const css = readFileSync(join(__dirname, '../../renderer/src/ProjectionApp.css'), 'utf8').replace(/\r\n/g, '\n')
const block = (sel: string): string => css.match(new RegExp('(?:^|\\n)' + sel.replace('.', '\\.') + ' \\{([^}]*)\\}'))?.[1] ?? ''

describe('congregation screen side margins', () => {
  it('the label, text and reference keep 5% of the width each side', () => {
    expect(block('.projection-active')).toMatch(/padding:\s*5vh 5vw;/)
  })
  it('no fixed 100 px margin is left', () => { expect(css).not.toMatch(/100px/) })
})
