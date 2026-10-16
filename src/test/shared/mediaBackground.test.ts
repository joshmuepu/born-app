import { describe, it, expect } from 'vitest'
import { resolveBackground, clampDim, DEFAULT_BACKGROUND_DIM, type BackgroundSettings } from '../../shared/media'

const none = (): string | null => null
const follows = (map: Record<string, string>) => (c: string): string | null => map[c] ?? null

describe('still background resolution', () => {
  it('nothing set → no background', () => {
    expect(resolveBackground(undefined, 'congregation', 'main', none)).toBeNull()
    expect(resolveBackground({ destinations: {}, channels: {} }, 'congregation', 'main', none)).toBeNull()
  })
  it('a destination setting wins over its channel default', () => {
    const s: BackgroundSettings = { destinations: { congregation: { mediaId: 'm_a', dim: 20 } }, channels: { main: { mediaId: 'm_b', dim: 50 } } }
    expect(resolveBackground(s, 'congregation', 'main', none)).toEqual({ mediaId: 'm_a', dim: 20 })
    expect(resolveBackground(s, 'graphics-1', 'main', none)).toEqual({ mediaId: 'm_b', dim: 50 })
  })
  it('an explicit "none" on a destination beats the channel default', () => {
    const s: BackgroundSettings = { destinations: { congregation: { mediaId: null, dim: 35 } }, channels: { main: { mediaId: 'm_b', dim: 50 } } }
    expect(resolveBackground(s, 'congregation', 'main', none)).toBeNull()
  })
  it('a following channel uses the channel it follows unless it has its own', () => {
    const s: BackgroundSettings = { destinations: {}, channels: { main: { mediaId: 'm_b', dim: 40 } } }
    expect(resolveBackground(s, 'graphics-es', 'es', follows({ es: 'main' }))).toEqual({ mediaId: 'm_b', dim: 40 })
    const own: BackgroundSettings = { destinations: {}, channels: { main: { mediaId: 'm_b', dim: 40 }, es: { mediaId: 'm_c', dim: 10 } } }
    expect(resolveBackground(own, 'graphics-es', 'es', follows({ es: 'main' }))).toEqual({ mediaId: 'm_c', dim: 10 })
  })
  it('a follow loop cannot hang', () => {
    const s: BackgroundSettings = { destinations: {}, channels: {} }
    expect(resolveBackground(s, 'x', 'a', follows({ a: 'b', b: 'a' }))).toBeNull()
  })
  it('dim is kept within 0–80 and defaults sensibly', () => {
    expect(clampDim(-5)).toBe(0)
    expect(clampDim(500)).toBe(80)
    expect(clampDim('x')).toBe(DEFAULT_BACKGROUND_DIM)
    expect(clampDim(34.6)).toBe(35)
  })
})
