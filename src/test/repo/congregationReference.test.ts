import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// The congregation screen's reference line is what people copy into their notes from the back of the room. It was capped at 48 px
// (2.2% of a 4K screen's height), then 3.2% of the height; it is now 5% with no cap, and the label 3.2%. Both have their own row
// above and below the text, so a reference that wraps never runs over the text. The drawn sizes are measured in the real app by
// scripts/qa/screen-sizes.cjs (ONLY=congregation-ref).
const css = readFileSync(join(__dirname, '../../renderer/src/ProjectionApp.css'), 'utf8').replace(/\r\n/g, '\n')
const block = (sel: string): string => css.match(new RegExp('(?:^|\\n)' + sel.replace('.', '\\.') + ' \\{([^}]*)\\}'))?.[1] ?? ''

describe('congregation screen reference line and label', () => {
  it('the reference line is 5% of the screen height, with no cap', () => {
    expect(block('.projection-reference')).toMatch(/font-size:\s*max\(1\.5rem,\s*5vh\);/)
  })
  it('the label is 3.2% of the screen height, with no cap', () => {
    expect(block('.projection-label')).toMatch(/font-size:\s*max\(1rem,\s*3\.2vh\);/)
  })
  it('the label, text and reference are rows of a column, so none can cover another', () => {
    expect(block('.projection-active')).toMatch(/flex-direction:\s*column;/)
    for (const sel of ['.projection-label', '.projection-reference']) {
      expect(block(sel)).toMatch(/flex:\s*0 0 auto;/)
      expect(block(sel)).not.toMatch(/position:\s*absolute/)
    }
    expect(block('.projection-text')).toMatch(/flex:\s*1 1 auto;/)
    expect(block('.projection-text')).toMatch(/min-height:\s*0;/)
  })
})
