import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (f: string): string => readFileSync(join(__dirname, '../../renderer/src', f), 'utf8').replace(/\r\n/g, '\n')
const block = (css: string, sel: string): string => {
  const m = css.match(new RegExp('(?:^|\\n)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}'))
  return m ? m[1] : ''
}

describe('the projector and stage monitor keep long text on screen', () => {
  it('a line with no spaces wraps on the projector', () => {
    expect(block(read('ProjectionApp.css'), '.projection-text-inner')).toMatch(/overflow-wrap:\s*anywhere/)
  })
  it('a line with no spaces wraps on the stage monitor (current, next and congregation view)', () => {
    expect(read('StageApp.css')).toMatch(/\.stage-current-text, \.stage-next-text, \.stage-cg-text \{ overflow-wrap: anywhere; \}/)
  })
  it('the stage Next band is a fifth of the screen height, with its text fitted in a box of its own so the reference line stays whole', () => {
    expect(block(read('StageApp.css'), '.stage-next')).toMatch(/height:\s*20vh/)
    expect(block(read('StageApp.css'), '.stage-next-fit')).toMatch(/min-height:\s*0/)
    expect(read('StageApp.tsx')).toMatch(/<div className="stage-next-fit" ref=\{nextRef\}/)
  })
})
