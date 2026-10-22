import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(__dirname, '../../renderer/src/App.css'), 'utf8').replace(/\r\n/g, '\n')
const block = (sel: string): string => {
  const m = css.match(new RegExp('\\n' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}'))
  return m ? m[1] : ''
}

describe('dialogs fit a short window', () => {
  it('.modal is capped to the window height and scrolls inside, so the Keyboard shortcuts dialog is not cut off at 150% scale', () => {
    const b = block('.modal')
    expect(b).toMatch(/max-height:\s*calc\(100vh - 32px\)/)
    expect(b).toMatch(/overflow-y:\s*auto/)
  })

  it('.screens-popover is capped to the window and scrolls inside, so every screen row and the Smaller/Larger text buttons stay reachable at 150% scale', () => {
    const b = block('.screens-popover')
    expect(b).toMatch(/max-height:\s*calc\(100vh - \d+px\)/)
    expect(b).toMatch(/overflow-y:\s*auto/)
  })
})
