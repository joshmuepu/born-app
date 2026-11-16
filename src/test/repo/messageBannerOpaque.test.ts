import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// The Message banner sits over the bottom of the congregation screen and the stage monitor, where the
// reference line is. A see-through background let that line show through the message.
const css = (f: string): string => readFileSync(join(__dirname, '../../renderer/src', f), 'utf8').replace(/\r\n/g, '\n')
const block = (src: string, sel: string): string => { const i = src.indexOf(sel + ' {'); return src.slice(i, src.indexOf('}', i)) }

describe('Message banner', () => {
  for (const [file, sel] of [['ProjectionApp.css', '.projection-alert'], ['StageApp.css', '.stage-alert']]) {
    it(`${sel} has an opaque background`, () => {
      const b = block(css(file), sel)
      const bg = b.match(/background(?:-color)?:\s*([^;]+);/)?.[1].trim() ?? ''
      expect(bg).toMatch(/^#[0-9a-f]{6}$/i)
    })
  }
})
