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
  it('the stage Next band is not height-capped (a cap cut its reference line in half; the text is line-clamped already)', () => {
    const b = block(read('StageApp.css'), '.stage-next')
    expect(b).not.toMatch(/max-height/)
    expect(b).not.toMatch(/overflow:\s*hidden/)
  })
})
