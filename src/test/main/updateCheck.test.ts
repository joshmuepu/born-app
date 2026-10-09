import { describe, it, expect } from 'vitest'
import { cmpVersion, sameMajor } from '../../main/updateCheck'

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

describe('sameMajor', () => {
  it('is true within the same major version', () => {
    expect(sameMajor('1.12.0', '1.0.0')).toBe(true)
    expect(sameMajor('2.0.0-dev.1', '2.3.4')).toBe(true)
  })

  it('is false across a major version — a v1 release is not an "update" for a v2 build, or vice versa', () => {
    expect(sameMajor('1.12.0', '2.0.0-dev.1')).toBe(false)
    expect(sameMajor('2.0.0-dev.1', '1.12.0')).toBe(false)
  })

  it('ignores a leading v and any pre-release suffix', () => {
    expect(sameMajor('v1.5.0', '1.0.0')).toBe(true)
  })
})
