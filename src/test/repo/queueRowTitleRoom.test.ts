import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// A queue row's Project / Remove buttons only show on hover. In the row's flow they still took their full
// width while hidden, so in the usual 300 px queue a title was cut to three or four letters ("Doo…").
const css = readFileSync(join(__dirname, '../../renderer/src/components/ServiceQueue.css'), 'utf8').replace(/\r\n/g, '\n')
const block = (sel: string): string => { const i = css.indexOf('\n' + sel + ' {'); return css.slice(i, css.indexOf('}', i)) }

describe('queue row titles get the row width', () => {
  it('the hover-only actions are out of the flow', () => {
    expect(block('.queue-row-actions')).toMatch(/position:\s*absolute/)
    expect(block('.queue-row-actions')).toMatch(/opacity:\s*0/)
  })
  it('the row is their positioning box', () => {
    expect(block('.queue-row')).toMatch(/position:\s*relative/)
  })
})
