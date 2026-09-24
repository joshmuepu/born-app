import { describe, it, expect } from 'vitest'
import { STANDARD_KEYS, MAJOR_KEYS, MINOR_KEYS, isStandardKey } from '../../shared/songKeys'

describe('songKeys', () => {
  it('has exactly 24 keys — 12 chromatic roots × major/minor', () => {
    expect(MAJOR_KEYS).toHaveLength(12)
    expect(MINOR_KEYS).toHaveLength(12)
    expect(STANDARD_KEYS).toHaveLength(24)
  })

  it('has no duplicate keys', () => {
    expect(new Set(STANDARD_KEYS).size).toBe(24)
  })

  it('accepts every standard key', () => {
    for (const k of STANDARD_KEYS) expect(isStandardKey(k)).toBe(true)
  })

  it('rejects free-text and malformed input — the whole point of a constrained picker', () => {
    expect(isStandardKey('Bb')).toBe(false) // flat spelling not offered — sharps only
    expect(isStandardKey('B-flat')).toBe(false)
    expect(isStandardKey('c')).toBe(false) // case-sensitive
    expect(isStandardKey('H')).toBe(false) // not a note name in this system
    expect(isStandardKey('')).toBe(false)
    expect(isStandardKey('Cmaj7')).toBe(false)
  })
})
