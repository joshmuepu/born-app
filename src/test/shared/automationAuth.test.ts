import { describe, it, expect } from 'vitest'
import { automationRequestAuthorized } from '../../shared/automationAuth'

describe('automationRequestAuthorized', () => {
  it('allows everything when no token is configured', () => {
    expect(automationRequestAuthorized(null, undefined, null)).toBe(true)
    expect(automationRequestAuthorized(null, 'anything', 'anything')).toBe(true)
  })

  it('rejects a request with no credentials once a token is configured', () => {
    expect(automationRequestAuthorized('secret', undefined, null)).toBe(false)
  })

  it('accepts a matching header token', () => {
    expect(automationRequestAuthorized('secret', 'secret', null)).toBe(true)
  })

  it('accepts a matching query token', () => {
    expect(automationRequestAuthorized('secret', undefined, 'secret')).toBe(true)
  })

  it('rejects a mismatched header or query token', () => {
    expect(automationRequestAuthorized('secret', 'wrong', null)).toBe(false)
    expect(automationRequestAuthorized('secret', undefined, 'wrong')).toBe(false)
  })
})
