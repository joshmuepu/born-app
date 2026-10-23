import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('song slide head', () => {
  it('the "On screen" tag does not make the live slide taller than the others (hiding the screen would shift the list)', () => {
    const css = readFileSync(join(__dirname, '../../renderer/src/components/SongsPanel.css'), 'utf8')
    const rule = /\.song-slide-head \.on-screen-tag\s*\{([^}]*)\}/.exec(css)
    expect(rule).not.toBeNull()
    expect(rule![1]).toMatch(/margin-top:\s*-2px/)
    expect(rule![1]).toMatch(/margin-bottom:\s*-2px/)
  })
})
