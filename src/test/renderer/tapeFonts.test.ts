import { describe, it, expect } from 'vitest'
import { missingScripts, type Fingerprint } from '../../renderer/src/tapeFonts'

/** a fake "computer": it can draw Latin, Cyrillic and Arabic; anything else comes out as the empty box */
const drawable = (ok: RegExp): Fingerprint => (ch) => (ch === ' ' ? 'blank' : ch === '\u{10FFFF}' ? 'box' : ok.test(ch) ? `glyph-${ch}` : 'box')

describe('font preflight for non-Latin text', () => {
  it('reports the scripts the computer would draw as boxes, and none for scripts it has', () => {
    const fp = drawable(/[Ѐ-ӿ؀-ۿ]/u)
    expect(missingScripts('ሰላም world مرحبا и', fp)).toEqual(['Ethiopic'])
    expect(missingScripts('Hello', fp)).toEqual([])
    expect(missingScripts('مرحبا', fp)).toEqual([])
  })
  it('a script that draws nothing at all counts as missing', () => {
    expect(missingScripts('ሰ', (ch) => (ch === ' ' ? 'blank' : ch === '\u{10FFFF}' ? 'box' : 'blank'))).toEqual(['Ethiopic'])
  })
  it('when drawing cannot be tested (no canvas) nothing is claimed', () => {
    expect(missingScripts('ሰላም', () => null)).toEqual([])
  })
})
