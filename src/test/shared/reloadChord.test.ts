import { describe, it, expect } from 'vitest'
import { isReloadChord } from '../../shared/reloadChord'

describe('isReloadChord', () => {
  it('matches Ctrl+R, Cmd+R and the shifted force-reload forms', () => {
    expect(isReloadChord({ type: 'keyDown', key: 'r', control: true })).toBe(true)
    expect(isReloadChord({ type: 'keyDown', key: 'R', meta: true })).toBe(true)
    expect(isReloadChord({ type: 'keyDown', key: 'R', control: true })).toBe(true)
  })
  it('ignores plain R, other keys, Alt combos and key-up', () => {
    expect(isReloadChord({ type: 'keyDown', key: 'r' })).toBe(false)
    expect(isReloadChord({ type: 'keyDown', key: 'f', control: true })).toBe(false)
    expect(isReloadChord({ type: 'keyDown', key: 'r', control: true, alt: true })).toBe(false)
    expect(isReloadChord({ type: 'keyUp', key: 'r', control: true })).toBe(false)
  })
})
