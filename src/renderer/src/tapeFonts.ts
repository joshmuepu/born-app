import { scriptsIn, type ScriptName } from '../../shared/tapeLanguage'

/** Draws a character and returns a fingerprint of the pixels (null when the page cannot draw at all, e.g. a test). */
export type Fingerprint = (char: string) => string | null

/** The real one: a small canvas. A character the computer has no font for is drawn as an empty box (or nothing); we compare with such a box. */
export const canvasFingerprint: Fingerprint = (char) => {
  try {
    const c = document.createElement('canvas')
    c.width = 64; c.height = 64
    const g = c.getContext('2d', { willReadFrequently: true })
    if (!g) return null
    g.font = '40px sans-serif'
    g.textBaseline = 'top'
    g.fillText(char, 4, 4)
    return Array.from(g.getImageData(0, 0, 64, 64).data).join(',')
  } catch {
    return null
  }
}

/** Scripts in `text` the computer cannot draw (it would show boxes). Empty when it can, or when it cannot be tested. */
export function missingScripts(text: string, fp: Fingerprint = canvasFingerprint): ScriptName[] {
  const blank = fp('\u{10FFFF}')
  const out: ScriptName[] = []
  for (const { script, sample } of scriptsIn(text)) {
    const a = fp(sample)
    if (a === null) continue
    // nothing drawn, or the same picture as the "no such character" box
    const empty = fp(' ')
    if (a === empty || (blank !== null && a === blank)) out.push(script)
  }
  return out
}
