import { describe, it, expect } from 'vitest'
import { projectionPlacementAfterChange as place } from '../../main/displays'

// Unplugging the projector mid-service moved the full-screen projection onto the operator's own screen, covering every control.
describe('the projection window after the screens change', () => {
  it('projector unplugged while projecting: a normal window on the operator screen, not full-screen over it', () => {
    expect(place({ automaticFallback: true, wasOnProjector: true, displaced: false })).toBe('windowed')
  })
  it('it stays a normal window while there is still no projector', () => {
    expect(place({ automaticFallback: true, wasOnProjector: false, displaced: true })).toBe('windowed')
  })
  it('projector plugged back in: full-screen on it again', () => {
    expect(place({ automaticFallback: false, wasOnProjector: false, displaced: true })).toBe('fullscreen')
  })
  it('opened with no projector at all (or the operator screen chosen by name): full-screen as before', () => {
    expect(place({ automaticFallback: true, wasOnProjector: false, displaced: false })).toBe('fullscreen')
    expect(place({ automaticFallback: false, wasOnProjector: true, displaced: false })).toBe('fullscreen')
  })
})
