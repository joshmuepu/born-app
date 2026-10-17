import { describe, it, expect } from 'vitest'
import { formatRanges, checkAgreement, applyOverrides, decideUse, cleanOverrides, scriptsIn, type Override } from '../../shared/tapeLanguage'
import type { SyncMark } from '../../shared/tape'

const marks = (ns: number[]): SyncMark[] => ns.map((n) => ({ n, t: n * 10, kind: 'start' as const, confidence: null }))
const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i)

describe('number ranges', () => {
  it('writes runs as ranges', () => {
    expect(formatRanges([1, 2, 3, 5, 7, 8, 9, 20])).toBe('1–3, 5, 7–9, 20')
    expect(formatRanges([])).toBe('')
    expect(formatRanges([4, 4, 3])).toBe('3–4')
  })
})

describe('does the text agree with the timing?', () => {
  it('identical numbering is fine and says nothing', () => {
    const a = checkAgreement(range(1, 50), marks(range(1, 50)))
    expect(a).toMatchObject({ ok: true, message: '', common: 50, firstDifference: null })
  })
  it('two merged paragraphs: names where it goes wrong, in plain words', () => {
    // the Spanish text merged 113+114, so it has one paragraph fewer and the numbers after shift
    const text = [...range(1, 112), ...range(113, 205)]
    const a = checkAgreement(text, marks(range(1, 207)), [], { map: 'English', text: 'the Spanish text' })
    expect(a.ok).toBe(false)
    expect(a.textCount).toBe(205)
    expect(a.mapCount).toBe(207)
    expect(a.mapOnly).toEqual([206, 207])
    expect(a.message).toBe('English has 207 timed paragraphs, the Spanish text has 205. 205 numbers match. Only in the timing: 206–207. From ¶206 the numbers may be off.')
    expect(a.firstDifference).toBe(206)
  })
  it('a text with an extra paragraph in the middle', () => {
    const a = checkAgreement([...range(1, 10), 10.5 as number, ...range(11, 20)].filter(Number.isInteger), marks(range(1, 20)))
    expect(a.ok).toBe(true)
    const b = checkAgreement([...range(1, 10), ...range(12, 21)], marks(range(1, 20)))
    expect(b.textOnly).toEqual([21])
    expect(b.mapOnly).toEqual([11])
    expect(b.firstDifference).toBe(11)
  })
  it('skipped paragraphs (not on this tape) are not "timed", so a text that has them is flagged', () => {
    const m: SyncMark[] = [...marks(range(1, 4)), { n: 5, t: null, kind: 'skip', confidence: null }]
    expect(checkAgreement(range(1, 5), m).textOnly).toEqual([5])
  })
})

describe('the override table', () => {
  it('"French ¶113 = English ¶115": the text paragraph takes the other one\'s time, and the map\'s own 113 no longer applies', () => {
    const out = applyOverrides(marks(range(1, 5)), [{ textN: 3, mapN: 5 }])
    expect(out.find((m) => m.n === 3)!.t).toBe(50)
    expect(out.filter((m) => m.n === 3)).toHaveLength(1)
    expect(out.find((m) => m.n === 5)).toBeUndefined() // consumed: it is now the text's ¶3
    expect(out.map((m) => m.n).sort()).toEqual([1, 2, 3, 4])
  })
  it('two paragraphs swapped by the translation swap their times', () => {
    const out = applyOverrides(marks([1, 2, 3, 4]), [{ textN: 2, mapN: 3 }, { textN: 3, mapN: 2 }])
    expect(out.find((m) => m.n === 2)!.t).toBe(30)
    expect(out.find((m) => m.n === 3)!.t).toBe(20)
  })
  it('lining up the differences makes the agreement check pass', () => {
    const text = [1, 2, 3, 4] // the text has no ¶5 but its 4 is the tape's 5
    const map = marks([1, 2, 3, 5])
    expect(checkAgreement(text, map).ok).toBe(false)
    const ov: Override[] = [{ textN: 4, mapN: 5 }]
    const a = checkAgreement(text, map, ov)
    expect(a.textOnly).toEqual([])
    expect(a.mapOnly).toEqual([])
    expect(a.ok).toBe(true)
  })
  it('an override to a paragraph the timing does not have changes nothing', () => {
    expect(applyOverrides(marks([1, 2]), [{ textN: 2, mapN: 9 }]).map((m) => m.n)).toEqual([1])
  })
  it('bad override lists are cleaned: whole numbers, in range, one per text paragraph, never to itself', () => {
    expect(cleanOverrides([{ textN: 3, mapN: 5 }, { textN: 3, mapN: 6 }, { textN: 4, mapN: 4 }, { textN: 'x', mapN: 1 }, { textN: 0, mapN: 1 }, null, { textN: 1, mapN: 2 }])).toEqual([{ textN: 1, mapN: 2 }, { textN: 3, mapN: 5 }])
    expect(cleanOverrides('nope')).toEqual([])
  })
})

describe('the policy for a mismatching text', () => {
  const bad = checkAgreement([1, 2], marks([1, 2, 3]))
  const good = checkAgreement([1, 2, 3], marks([1, 2, 3]))
  it('agreement is always used; otherwise the operator\'s choice wins, then the setting', () => {
    expect(decideUse('never', good, null)).toBe('use')
    expect(decideUse('ask', bad, null)).toBe('ask')
    expect(decideUse('never', bad, null)).toBe('never')
    expect(decideUse('matching', bad, null)).toBe('matching')
    expect(decideUse('never', bad, 'matching')).toBe('matching')
    expect(decideUse('matching', bad, 'never')).toBe('never')
  })
})

describe('which scripts need a font', () => {
  it('finds the non-Latin scripts in a text, each with a sample character', () => {
    expect(scriptsIn('Hello world')).toEqual([])
    const r = scriptsIn('ሰላም world مرحبا и 你好')
    expect(r.map((x) => x.script).sort()).toEqual(['Arabic', 'Cyrillic', 'Ethiopic', 'Han'])
    expect(r.find((x) => x.script === 'Ethiopic')!.sample).toBe('ሰ')
  })
})
