import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(__dirname, '../../renderer/src/components/BrowsePanel.css'), 'utf8').replace(/\r\n/g, '\n')
const block = (sel: string): string => {
  const m = css.match(new RegExp('\\n' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}'))
  return m ? m[1] : ''
}

describe('Browse → Date fits a short window', () => {
  it('the sermons for the picked date keep a minimum height, so on a 1366×768 screen they are not squeezed to nothing under the calendar (the panel scrolls instead)', () => {
    expect(block('.browse-date-results')).toMatch(/min-height:\s*\d{3}px/)
  })
})
