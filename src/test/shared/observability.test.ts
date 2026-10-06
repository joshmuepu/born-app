import { describe, it, expect } from 'vitest'
import { describeDestinationStatus } from '../../shared/observability'

describe('describeDestinationStatus', () => {
  describe('congregation', () => {
    it('is connected, never a warning, when ready', () => {
      expect(describeDestinationStatus('congregation', { role: 'congregation', ready: true })).toEqual({
        id: 'congregation',
        kind: 'window',
        label: 'Congregation Screen',
        connected: true,
        warning: null
      })
    })
    it('is simply off — not a warning — when not ready', () => {
      const r = describeDestinationStatus('congregation', { role: 'congregation', ready: false })
      expect(r.connected).toBe(false)
      expect(r.warning).toBeNull()
    })
  })

  describe('stage', () => {
    it('is connected with no warning when open on a real display', () => {
      const r = describeDestinationStatus('stage', { role: 'stage', ready: true, windowed: false })
      expect(r).toEqual({ id: 'stage', kind: 'window', label: 'Stage Monitor', connected: true, warning: null })
    })
    it('warns when open but running windowed (no external display)', () => {
      const r = describeDestinationStatus('stage', { role: 'stage', ready: true, windowed: true })
      expect(r.connected).toBe(true)
      expect(r.warning).toBe('No external display — running windowed')
    })
    it('does not warn about being windowed while simply off', () => {
      const r = describeDestinationStatus('stage', { role: 'stage', ready: false, windowed: true })
      expect(r.connected).toBe(false)
      expect(r.warning).toBeNull()
    })
  })

  describe('graphics', () => {
    it('warns when nobody is connected', () => {
      const r = describeDestinationStatus('graphics-1', { role: 'graphics', clientCount: 0, profileName: 'Full-Screen' })
      expect(r).toEqual({
        id: 'graphics-1',
        kind: 'browser',
        label: 'Graphics — Full-Screen',
        connected: false,
        warning: 'No viewer connected'
      })
    })
    it('is connected with no warning once at least one viewer is attached', () => {
      const r = describeDestinationStatus('graphics-1', { role: 'graphics', clientCount: 2, profileName: 'Lower Third' })
      expect(r.connected).toBe(true)
      expect(r.warning).toBeNull()
      expect(r.label).toBe('Graphics — Lower Third')
    })
  })

  it('reports an unknown destination as disconnected without a warning', () => {
    const r = describeDestinationStatus('ghost', { role: 'unknown' })
    expect(r).toEqual({ id: 'ghost', kind: 'window', label: 'ghost', connected: false, warning: null })
  })
})
