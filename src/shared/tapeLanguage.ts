/**
 * tapeLanguage.ts — using one tape's timing with text in another language (docs/design/sermon-audio/02 §2). Pure.
 *
 * A sync map belongs to a recording and is keyed by NUMBERED PARAGRAPH, so it fits any text whose numbering matches. Translations may not number
 * identically (a merged or split paragraph shifts everything after it), so we compare the two sets of numbers, say plainly where they differ, and let
 * the operator line up the differences with an override table ("French ¶113 is English ¶115").
 */
import type { SyncMark } from './tape'

export interface Override { textN: number; mapN: number }

/** "1–112, 114, 116–120": runs of consecutive numbers written as ranges. */
export function formatRanges(nums: number[], maxItems?: number): string {
  const s = [...new Set(nums)].sort((a, b) => a - b)
  const out: string[] = []
  for (let i = 0; i < s.length;) {
    let j = i
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++
    out.push(j > i ? `${s[i]}–${s[j]}` : String(s[i]))
    i = j + 1
  }
  if (maxItems !== undefined && out.length > maxItems) return `${out.slice(0, maxItems).join(', ')} and ${out.length - maxItems} more`
  return out.join(', ')
}

export interface Agreement {
  ok: boolean
  textCount: number
  mapCount: number
  /** in the text but not the map / in the map but not the text, AFTER the overrides are applied */
  textOnly: number[]
  mapOnly: number[]
  common: number
  /** the first number at which they stop agreeing (null when they agree) */
  firstDifference: number | null
  /** plain-language summary for the banner; '' when ok */
  message: string
}

/**
 * Apply the override table: text paragraph `textN` takes the time of map paragraph `mapN`. The map's own mark for `textN` no longer applies to this text,
 * and `mapN` is consumed (it is now the text's `textN`, so it is not also a paragraph of its own).
 */
export function applyOverrides(marks: SyncMark[], overrides: Override[]): SyncMark[] {
  if (overrides.length === 0) return marks
  const byN = new Map(marks.map((m) => [m.n, m]))
  const removed = new Set(overrides.flatMap((o) => [o.textN, o.mapN]))
  const out = marks.filter((m) => !removed.has(m.n))
  for (const o of overrides) {
    const src = byN.get(o.mapN)
    if (src) out.push({ ...src, n: o.textN })
  }
  return out
}

/**
 * Compare a text's paragraph numbers with a map's. `names` = how the two are called in the message ("English" / "the Spanish text").
 * Overrides are applied first, so a number the operator has lined up no longer counts as a difference.
 */
export function checkAgreement(textNumbers: number[], marks: SyncMark[], overrides: Override[] = [], names: { map: string; text: string } = { map: 'The recording', text: 'the text' }): Agreement {
  const effective = applyOverrides(marks, overrides)
  const T = new Set(textNumbers)
  const M = new Set(effective.filter((m) => m.kind === 'start' && m.t !== null).map((m) => m.n))
  const textOnly = [...T].filter((n) => !M.has(n)).sort((a, b) => a - b)
  const mapOnly = [...M].filter((n) => !T.has(n)).sort((a, b) => a - b)
  let common = 0
  for (const n of T) if (M.has(n)) common++
  const diff = [...textOnly, ...mapOnly].sort((a, b) => a - b)
  const ok = diff.length === 0
  const message = ok
    ? ''
    : `${names.map} has ${M.size} timed paragraphs, ${names.text} has ${T.size}. ${common} numbers match.` +
      (textOnly.length ? ` Only in the text: ${formatRanges(textOnly, 4)}.` : '') +
      (mapOnly.length ? ` Only in the timing: ${formatRanges(mapOnly, 4)}.` : '') +
      (diff[0] !== undefined ? ` From ¶${diff[0]} the numbers may be off.` : '')
  return { ok, textCount: T.size, mapCount: M.size, textOnly, mapOnly, common, firstDifference: diff[0] ?? null, message }
}

export type MismatchPolicy = 'ask' | 'never' | 'matching'
export type MismatchDecision = 'use' | 'ask' | 'never' | 'matching'

/** What to do about a (possibly) mismatching text. `choice` is what the operator already decided for this recording and text language. */
export function decideUse(policy: MismatchPolicy, agreement: Agreement, choice: 'matching' | 'never' | null): MismatchDecision {
  if (agreement.ok) return 'use'
  if (choice) return choice
  return policy === 'never' ? 'never' : policy === 'matching' ? 'matching' : 'ask'
}

/** Validate an override list from outside (storage, import): whole numbers, no duplicates in the text column, never mapped to itself. */
export function cleanOverrides(x: unknown): Override[] {
  const seen = new Set<number>()
  const out: Override[] = []
  for (const o of Array.isArray(x) ? x : []) {
    if (!o || !Number.isInteger(o.textN) || !Number.isInteger(o.mapN)) continue
    if (o.textN < 1 || o.mapN < 1 || o.textN > 99999 || o.mapN > 99999 || o.textN === o.mapN || seen.has(o.textN)) continue
    seen.add(o.textN)
    out.push({ textN: o.textN, mapN: o.mapN })
  }
  return out.sort((a, b) => a.textN - b.textN)
}

/** Scripts that need a font the computer may not have. */
export type ScriptName = 'Arabic' | 'Hebrew' | 'Ethiopic' | 'Devanagari' | 'Bengali' | 'Tamil' | 'Thai' | 'Khmer' | 'Myanmar' | 'Georgian' | 'Armenian' | 'Cyrillic' | 'Greek' | 'Han' | 'Hangul' | 'Kana'
const SCRIPT_RANGES: Array<[ScriptName, RegExp]> = [
  ['Arabic', /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/u],
  ['Hebrew', /[֐-׿]/u],
  ['Ethiopic', /[ሀ-፿]/u],
  ['Devanagari', /[ऀ-ॿ]/u],
  ['Bengali', /[ঀ-৿]/u],
  ['Tamil', /[஀-௿]/u],
  ['Thai', /[฀-๿]/u],
  ['Khmer', /[ក-៿]/u],
  ['Myanmar', /[က-႟]/u],
  ['Georgian', /[Ⴀ-ჿ]/u],
  ['Armenian', /[԰-֏]/u],
  ['Cyrillic', /[Ѐ-ӿ]/u],
  ['Greek', /[Ͱ-Ͽ]/u],
  ['Han', /[一-鿿]/u],
  ['Hangul', /[가-힯]/u],
  ['Kana', /[぀-ヿ]/u]
]
export const RTL_SCRIPTS: ScriptName[] = ['Arabic', 'Hebrew']

/** The non-Latin scripts used in `text`, with one example character of each (to test whether the computer can draw it). */
export function scriptsIn(text: string): Array<{ script: ScriptName; sample: string }> {
  const out: Array<{ script: ScriptName; sample: string }> = []
  for (const [script, re] of SCRIPT_RANGES) {
    const m = re.exec(text)
    if (m) out.push({ script, sample: m[0] })
  }
  return out
}
