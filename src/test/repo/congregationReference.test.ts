import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// The congregation screen's reference line was capped at 48 px and its label at 25.6 px, so on a 4K screen the reference was 2.2% of
// the screen height (3.2% on a 1080-line one). Both now keep their share of the screen height at every resolution, with no cap.
// The drawn sizes are measured in the real app by scripts/qa/screen-sizes.cjs (ONLY=congregation-ref).
const css = readFileSync(join(__dirname, '../../renderer/src/ProjectionApp.css'), 'utf8').replace(/\r\n/g, '\n')
const block = (sel: string): string => css.match(new RegExp('(?:^|\\n)' + sel.replace('.', '\\.') + ' \\{([^}]*)\\}'))?.[1] ?? ''

describe('congregation screen reference line and label', () => {
  it('the reference line is 3.2% of the screen height, never less than before, with no cap', () => {
    expect(block('.projection-reference')).toMatch(/font-size:\s*max\(1\.5rem,\s*3\.2vh\);/)
  })
  it('the label is at least 2.4% of the screen height, never less than before, with no cap', () => {
    expect(block('.projection-label')).toMatch(/font-size:\s*max\(clamp\(1rem,\s*1\.8vw,\s*1\.6rem\),\s*2\.4vh\);/)
  })
})
