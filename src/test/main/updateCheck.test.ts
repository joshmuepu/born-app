import { describe, it, expect } from 'vitest'
import { cmpVersion } from '../../main/updateCheck'

describe('cmpVersion', () => {
  it('detects a newer version', () => {
    expect(cmpVersion('1.0.3', '1.0.2')).toBeGreaterThan(0)
    expect(cmpVersion('1.1.0', '1.0.9')).toBeGreaterThan(0)
    expect(cmpVersion('2.0.0', '1.9.9')).toBeGreaterThan(0)
  })

  it('detects an older or equal version', () => {
    expect(cmpVersion('1.0.2', '1.0.3')).toBeLessThan(0)
    expect(cmpVersion('1.0.3', '1.0.3')).toBe(0)
  })

  it('ignores a leading v', () => {
    expect(cmpVersion('v1.0.3', '1.0.2')).toBeGreaterThan(0)
    expect(cmpVersion('1.0.3', 'v1.0.3')).toBe(0)
  })

  it('treats missing segments as zero', () => {
    expect(cmpVersion('1.1', '1.1.0')).toBe(0)
    expect(cmpVersion('1.2', '1.1.9')).toBeGreaterThan(0)
  })
})
