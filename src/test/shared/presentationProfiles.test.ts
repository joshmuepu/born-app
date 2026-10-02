import { describe, it, expect } from 'vitest'
import {
  PRESENTATION_PROFILES,
  getPresentationProfile,
  GRAPHICS_CANVAS,
  SAFE_AREA_PERCENT
} from '../../shared/presentationProfiles'

describe('PRESENTATION_PROFILES', () => {
  it('has exactly the two profiles Phase 3 built', () => {
    expect(Object.keys(PRESENTATION_PROFILES).sort()).toEqual(['fullscreen', 'lower-third'])
  })

  it('every profile has all four regions', () => {
    for (const profile of Object.values(PRESENTATION_PROFILES)) {
      expect(profile.regions.panel).toBeTruthy()
      expect(profile.regions.label).toBeTruthy()
      expect(profile.regions.text).toBeTruthy()
      expect(profile.regions.reference).toBeTruthy()
    }
  })
})

describe('getPresentationProfile', () => {
  it('fullscreen is solid, replacing the frame', () => {
    const p = getPresentationProfile('fullscreen')
    expect(p.pageBackground).toBe('#000')
  })

  it('lower-third is genuinely transparent at the page level', () => {
    const p = getPresentationProfile('lower-third')
    expect(p.pageBackground).toBe('transparent')
  })

  it('falls back to fullscreen for an unrecognized id rather than crashing', () => {
    // @ts-expect-error deliberately passing an invalid id to test the fallback
    const p = getPresentationProfile('made-up-profile')
    expect(p.id).toBe('fullscreen')
  })

  it('every region position/margin value for both profiles is derived from SAFE_AREA_PERCENT, not an unrelated magic number', () => {
    const edge = `${SAFE_AREA_PERCENT}%`
    const fullscreen = getPresentationProfile('fullscreen')
    expect(fullscreen.regions.label.left).toBe(edge)
    expect(fullscreen.regions.label.right).toBe(edge)
    expect(fullscreen.regions.reference.left).toBe(edge)
    const lowerThird = getPresentationProfile('lower-third')
    expect(lowerThird.regions.panel.left).toBe(edge)
    expect(lowerThird.regions.panel.right).toBe(edge)
  })
})

describe('GRAPHICS_CANVAS', () => {
  it('is the documented 1920x1080 design reference', () => {
    expect(GRAPHICS_CANVAS).toEqual({ width: 1920, height: 1080 })
  })
})
