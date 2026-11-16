import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Opening, re-opening or moving the congregation screen or the stage monitor must not take the keyboard from the operator window: they are shown
// with showInactive (inside keepOperatorFocus), never show() or focus().
const src = readFileSync(join(__dirname, '../../main/index.ts'), 'utf8').replace(/\r\n/g, '\n')

describe('output windows never take the keyboard', () => {
  it('are never shown with show() or given focus()', () => {
    expect(src).not.toMatch(/(projectionWindow|stageWindow)\??!?\.(show|focus)\(\)/)
  })
  it('are shown inactive, with the keyboard given back to the operator window', () => {
    expect((src.match(/keepOperatorFocus\(\(\) => (projectionWindow|stageWindow)\??!?\.showInactive\(\)\)/g) ?? []).length).toBeGreaterThanOrEqual(5)
  })
  it('the windowed stage monitor is made hidden and shown inactive', () => {
    const i = src.indexOf("No spare screen: a floating monitor")
    expect(src.slice(i, i + 900)).toMatch(/show: false/)
  })
})
