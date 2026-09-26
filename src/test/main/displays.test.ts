import { describe, it, expect } from 'vitest'
import {
  pickProjectionDisplay,
  pickStageDisplay,
  describeDisplay,
  fingerprintAndOrdinal,
  matchNamedDisplay,
  nameForDisplay,
  type DisplayLike,
  type NamedDisplay
} from '../../main/displays'

const mk = (id: number, over: Partial<DisplayLike> = {}): DisplayLike => ({
  id,
  bounds: { x: id * 1000, y: 0, width: 1920, height: 1080 },
  workArea: { x: id * 1000, y: 0, width: 1920, height: 1040 },
  ...over
})

/** Names `target` the way ensureNamedDisplay/displays:rename would, for
 *  tests that need an actual NamedDisplay entry rather than a raw id. */
function nameIt(displays: DisplayLike[], target: DisplayLike, name: string): NamedDisplay {
  const { fingerprint, ordinal } = fingerprintAndOrdinal(displays, target)
  return { name, fingerprint, ordinal }
}

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

  it('honours a valid named override', () => {
    const internal = mk(1, { internal: true })
    const projector = mk(2, { internal: false })
    const named = nameIt([internal, projector], internal, 'My Screen')
    const t = pickProjectionDisplay([internal, projector], 1, 'My Screen', [named])
    expect(t.display.id).toBe(1)
    expect(t.isOverride).toBe(true)
    expect(t.isFallback).toBe(true) // override points at the primary
    expect(t.missingOverrideName).toBeNull()
  })

  it('falls back to auto-pick and reports the name when the override is unmatched', () => {
    const internal = mk(1, { internal: true })
    const projector = mk(2, { internal: false })
    const t = pickProjectionDisplay([internal, projector], 1, 'Sanctuary Projector', [])
    expect(t.display.id).toBe(2)
    expect(t.isOverride).toBe(false)
    expect(t.missingOverrideName).toBe('Sanctuary Projector')
  })

  it('treats the projector as external even when the OS marks it primary', () => {
    const projector = mk(2, { internal: false })
    const internal = mk(1, { internal: true })
    const t = pickProjectionDisplay([projector, internal], 2)
    // primary is the projector (id 2); the only non-primary is the internal panel
    expect(t.display.id).toBe(1)
  })

  it('disambiguates two identical monitors by left-to-right ordinal', () => {
    const internal = mk(1, { internal: true })
    const twinA = mk(2, { internal: false, label: 'PA278QV', bounds: { x: 1000, y: 0, width: 2560, height: 1440 } })
    const twinB = mk(3, { internal: false, label: 'PA278QV', bounds: { x: 2000, y: 0, width: 2560, height: 1440 } })
    const displays = [internal, twinA, twinB]
    const namedB = nameIt(displays, twinB, 'Stage Monitor')
    const t = pickProjectionDisplay(displays, 1, 'Stage Monitor', [namedB])
    expect(t.display.id).toBe(3)
    expect(t.isOverride).toBe(true)
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

  it('honours a valid named override', () => {
    const named = nameIt([internal, projector, stageTv], projector, 'Congregation Screen')
    const t = pickStageDisplay([internal, projector, stageTv], 1, 2, 'Congregation Screen', [named])
    expect(t.display?.id).toBe(2)
    expect(t.isOverride).toBe(true)
  })

  it('falls back to the spare screen and reports the name when the override is unmatched', () => {
    const t = pickStageDisplay([internal, projector, stageTv], 1, 2, 'Stage Monitor', [])
    expect(t.display?.id).toBe(3)
    expect(t.isOverride).toBe(false)
    expect(t.missingOverrideName).toBe('Stage Monitor')
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

  it('prefers the operator-given name when one is attached to this display', () => {
    const internal = mk(1, { internal: true })
    const external = mk(2, { internal: false })
    const named = nameIt([internal, external], external, 'Sanctuary Projector')
    expect(describeDisplay(external, 1, [named], [internal, external])).toMatch(/^Sanctuary Projector/)
  })
})

describe('fingerprintAndOrdinal / matchNamedDisplay round trip', () => {
  it('finds the same display back after being renamed and reconnected in a different id order', () => {
    const displays = [mk(1, { internal: true }), mk(2, { internal: false, label: 'ViewSonic' })]
    const named = nameIt(displays, displays[1], 'Sanctuary Projector')

    // Simulate a reboot where Windows reassigns ids (2 -> 7) but the physical
    // display (same label/resolution/internal flag) is otherwise unchanged.
    const reconnected = [mk(1, { internal: true }), mk(7, { internal: false, label: 'ViewSonic' })]
    const match = matchNamedDisplay(reconnected, named)
    expect(match?.id).toBe(7)
    expect(nameForDisplay(reconnected, reconnected[1], [named])).toBe('Sanctuary Projector')
  })

  it('reports no match when nothing connected has the saved fingerprint', () => {
    const displays = [mk(1, { internal: true }), mk(2, { internal: false, label: 'ViewSonic' })]
    const named = nameIt(displays, displays[1], 'Sanctuary Projector')
    const withoutIt = [mk(1, { internal: true })]
    expect(matchNamedDisplay(withoutIt, named)).toBeNull()
  })
})
