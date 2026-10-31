import { describe, it, expect } from 'vitest'
import { pickProjectionDisplay, pickStageDisplay, nameForDisplay, fingerprintAndOrdinal, type NamedDisplay } from '../../main/displays'

// A display was recognised by its model name AND its size. Changing the projector's resolution, or Windows display scaling (which
// changes the size Electron reports), made it a stranger: the saved choice fell back to Automatic and its name vanished from the
// Screens panel. The size now only tells apart identical screens; the same model is still found after a resolution change.

const laptop = { id: 1, label: 'Built-in Retina Display', internal: true, bounds: { x: 0, y: 0, width: 1512, height: 982 } }
const projector = (width: number, height: number, x = 1512) => ({ id: 7, label: 'EPSON PJ', internal: false, bounds: { x, y: 0, width, height } })
const monitor = { id: 9, label: 'DELL U2720Q', internal: false, bounds: { x: 4000, y: 0, width: 2560, height: 1440 } }
const named = (d: Parameters<typeof fingerprintAndOrdinal>[1], all: Parameters<typeof fingerprintAndOrdinal>[0], name: string): NamedDisplay => ({ name, ...fingerprintAndOrdinal(all, d) })

describe('a named projector whose resolution changed', () => {
  const before = [laptop, projector(1920, 1080), monitor]
  const saved = [named(projector(1920, 1080), before, 'Sanctuary Projector')]
  const after = [laptop, projector(1280, 720), monitor]

  it('is still the congregation screen', () => {
    const t = pickProjectionDisplay(after, 1, 'Sanctuary Projector', saved)
    expect(t.display.id).toBe(7)
    expect(t.isOverride).toBe(true)
    expect(t.missingOverrideName).toBeNull()
  })
  it('keeps its name in the Screens panel', () => {
    expect(nameForDisplay(after, projector(1280, 720), saved)).toBe('Sanctuary Projector')
  })
  it('is still the stage monitor when that is what it was chosen for', () => {
    const stage = [named(monitor, before, 'Platform Screen')]
    const monitorLow = { ...monitor, bounds: { ...monitor.bounds, width: 1920, height: 1080 } }
    const t = pickStageDisplay([laptop, projector(1920, 1080), monitorLow], 1, 7, 'Platform Screen', stage)
    expect(t.display?.id).toBe(9)
    expect(t.isOverride).toBe(true)
    expect(t.missingOverrideName).toBeNull()
  })
  it('is still reported missing when it is really unplugged', () => {
    const t = pickProjectionDisplay([laptop, monitor], 1, 'Sanctuary Projector', saved)
    expect(t.missingOverrideName).toBe('Sanctuary Projector')
  })
})

describe('two identical screens', () => {
  const left = { id: 3, label: 'LG TV', internal: false, bounds: { x: 1512, y: 0, width: 1920, height: 1080 } }
  const right = { id: 4, label: 'LG TV', internal: false, bounds: { x: 3432, y: 0, width: 1920, height: 1080 } }
  const all = [laptop, left, right]
  const saved = [named(left, all, 'Left TV'), named(right, all, 'Right TV')]
  it('keep their own names, and the right one keeps its name after its resolution changes', () => {
    const rightLow = { ...right, bounds: { ...right.bounds, width: 1280, height: 720 } }
    const now = [laptop, left, rightLow]
    expect(nameForDisplay(now, left, saved)).toBe('Left TV')
    expect(nameForDisplay(now, rightLow, saved)).toBe('Right TV')
    expect(pickProjectionDisplay(now, 1, 'Right TV', saved).display.id).toBe(4)
    expect(pickProjectionDisplay(now, 1, 'Left TV', saved).display.id).toBe(3)
  })
})

describe('a screen with no model name', () => {
  it('is not guessed at by name alone', () => {
    const blank = { id: 5, label: '', internal: false, bounds: { x: 1512, y: 0, width: 1920, height: 1080 } }
    const saved = [named(blank, [laptop, blank], 'Hall')]
    const other = { ...blank, id: 6, bounds: { ...blank.bounds, width: 1024, height: 768 } }
    expect(pickProjectionDisplay([laptop, other], 1, 'Hall', saved).missingOverrideName).toBe('Hall')
  })
})
