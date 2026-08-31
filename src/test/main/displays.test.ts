import { describe, it, expect } from 'vitest'
import {
  pickProjectionDisplay,
  pickStageDisplay,
  describeDisplay,
  type DisplayLike
} from '../../main/displays'

const mk = (id: number, over: Partial<DisplayLike> = {}): DisplayLike => ({
  id,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  ...over
})

describe('pickProjectionDisplay', () => {
  it('falls back to the primary display when there is only one', () => {
    const only = mk(1, { internal: true })
    const t = pickProjectionDisplay([only], 1)
    expect(t.display.id).toBe(1)
    expect(t.isFallback).toBe(true)
    expect(t.isOverride).toBe(false)
  })

  it('picks the external (non-primary) display in a two-display setup', () => {
    const internal = mk(1, { internal: true })
    const projector = mk(2, { internal: false })
    const t = pickProjectionDisplay([internal, projector], 1)
    expect(t.display.id).toBe(2)
    expect(t.isFallback).toBe(false)
  })

  it('prefers a non-internal panel when the laptop lid is closed and 2 externals exist', () => {
    const primaryExternal = mk(2, { internal: false })
    const secondExternal = mk(3, { internal: false })
    const t = pickProjectionDisplay([primaryExternal, secondExternal], 2)
    expect(t.display.id).toBe(3)
  })

  it('honours a valid operator override', () => {
    const internal = mk(1, { internal: true })
    const projector = mk(2, { internal: false })
    const t = pickProjectionDisplay([internal, projector], 1, 1)
    expect(t.display.id).toBe(1)
    expect(t.isOverride).toBe(true)
    expect(t.isFallback).toBe(true) // override points at the primary
  })

  it('ignores a stale override id that is no longer connected', () => {
    const internal = mk(1, { internal: true })
    const projector = mk(2, { internal: false })
    const t = pickProjectionDisplay([internal, projector], 1, 99)
    expect(t.display.id).toBe(2)
    expect(t.isOverride).toBe(false)
  })

  it('treats the projector as external even when the OS marks it primary', () => {
    const projector = mk(2, { internal: false })
    const internal = mk(1, { internal: true })
    const t = pickProjectionDisplay([projector, internal], 2)
    // primary is the projector (id 2); the only non-primary is the internal panel
    expect(t.display.id).toBe(1)
  })
})

describe('pickStageDisplay', () => {
  const internal = mk(1, { internal: true })
  const projector = mk(2, { internal: false })
  const stageTv = mk(3, { internal: false })

  it('stays a normal window when only the operator + projector screens exist', () => {
    const t = pickStageDisplay([internal, projector], 1, 2)
    expect(t.display).toBeNull()
    expect(t.isFallback).toBe(true)
  })

  it('uses the spare screen when there is a third display', () => {
    const t = pickStageDisplay([internal, projector, stageTv], 1, 2)
    expect(t.display?.id).toBe(3)
    expect(t.isFallback).toBe(false)
    expect(t.isOverride).toBe(false)
  })

  it('honours a valid operator override', () => {
    const t = pickStageDisplay([internal, projector, stageTv], 1, 2, 2)
    expect(t.display?.id).toBe(2)
    expect(t.isOverride).toBe(true)
  })

  it('ignores a stale override and falls back to the spare screen', () => {
    const t = pickStageDisplay([internal, projector, stageTv], 1, 2, 99)
    expect(t.display?.id).toBe(3)
    expect(t.isOverride).toBe(false)
  })

  it('never picks the operator or projection screen automatically', () => {
    const t = pickStageDisplay([internal, projector], 1, 2)
    expect(t.display).toBeNull()
  })
})

describe('describeDisplay', () => {
  it('labels the primary internal display', () => {
    expect(describeDisplay(mk(1, { internal: true, label: 'Built-in Retina Display' }), 1)).toMatch(
      /Built-in Retina Display.*primary.*internal/
    )
  })

  it('labels an unnamed external display by size', () => {
    expect(describeDisplay(mk(2, { internal: false }), 1)).toBe('Display (1920×1080)')
  })
})
