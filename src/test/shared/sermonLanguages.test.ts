import { describe, it, expect } from 'vitest'
import { SERMON_LANGUAGES } from '../../shared/sermonLanguages'

describe('SERMON_LANGUAGES', () => {
  it('includes English as the default', () => {
    expect(SERMON_LANGUAGES.find((l) => l.code === 'en')).toEqual({ code: 'en', name: 'English' })
  })

  it('has no duplicate codes', () => {
    const codes = SERMON_LANGUAGES.map((l) => l.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('has no duplicate names', () => {
    const names = SERMON_LANGUAGES.map((l) => l.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('every code is a lowercase ISO 639-1 two-letter code', () => {
    for (const { code } of SERMON_LANGUAGES) {
      expect(code).toMatch(/^[a-z]{2}$/)
    }
  })

  it('every entry has a non-empty name', () => {
    for (const { name } of SERMON_LANGUAGES) {
      expect(name.trim().length).toBeGreaterThan(0)
    }
  })
})
