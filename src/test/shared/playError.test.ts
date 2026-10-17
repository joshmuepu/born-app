import { describe, it, expect } from 'vitest'
import { plainPlayError } from '../../shared/playError'

describe('a play() failure in plain words', () => {
  it('never shows the browser text', () => {
    for (const e of [new DOMException('Failed to load because no supported source was found.', 'NotSupportedError'), new DOMException('play() failed because the user didn\'t interact with the document first.', 'NotAllowedError'), new DOMException('The play() request was interrupted', 'AbortError'), new Error('boom'), 'weird', null]) {
      const t = plainPlayError(e)
      expect(t).not.toMatch(/DOMException|Error|play\(\)|supported source|boom|weird/)
    }
  })
  it('says what to do about the common ones', () => {
    expect(plainPlayError(new DOMException('x', 'NotSupportedError'))).toBe('this computer cannot play this file')
    expect(plainPlayError(new DOMException('x', 'NotAllowedError'))).toBe('the computer would not let it start')
    expect(plainPlayError(new DOMException('x', 'AbortError'))).toBe('it was interrupted')
    expect(plainPlayError(new Error('???'))).toBe('it could not be played')
  })
})
