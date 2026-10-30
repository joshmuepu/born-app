import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
const css = readFileSync(join(__dirname, '../../renderer/src/components/SermonPanel.css'), 'utf8').replace(/\r\n/g, '\n')

describe('sermon result cards: + Queue and Project sit on the title line', () => {
  it('the buttons are placed at the top right of the card, not in a band under the text', () => {
    expect(css).toMatch(/\.result-item \.result-actions \{[^}]*position: absolute;[^}]*top: 8px;[^}]*right: 10px;/)
  })
  it('the title line keeps their room, so nothing jumps when they appear, and the text has no empty band under it', () => {
    expect(css).toMatch(/\.result-item:has\(\.result-actions\) \.result-head \{ padding-right:/)
    expect(css).toMatch(/\.result-item:has\(\.result-actions\) \.result-text \{ margin-bottom: 0; \}/)
  })
})
