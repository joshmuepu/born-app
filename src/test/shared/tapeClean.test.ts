import { describe, it, expect } from 'vitest'
import { cleanSyncMarks, cleanSyncRegions, cleanTextLanguage, cleanTapeSettingsPatch } from '../../shared/tapeClean'
import { TAPE_DEFAULTS } from '../../shared/tape'

describe('marks that arrive from outside', () => {
  it('keeps good ones exactly', () => {
    expect(cleanSyncMarks([{ n: 3, t: 12.5, kind: 'start', confidence: 0.8 }, { n: 4, t: null, kind: 'skip' }])).toEqual([
      { n: 3, t: 12.5, kind: 'start', confidence: 0.8 }, { n: 4, t: null, kind: 'skip', confidence: null }
    ])
  })
  it('drops what is not a mark: wrong shapes, fractional / zero / negative / huge numbers, unknown kinds', () => {
    const bad = [null, undefined, 7, 'x', [], { n: 1.5, kind: 'start', t: 1 }, { n: 0, kind: 'start', t: 1 }, { n: -2, kind: 'start', t: 1 }, { n: 100000, kind: 'start', t: 1 }, { n: '3', kind: 'start', t: 1 }, { n: 3, kind: 'jump', t: 1 }, { n: 3 }]
    expect(cleanSyncMarks(bad)).toEqual([])
  })
  it('never lets a non-finite time through (NaN, Infinity, strings become "no time"), and a skip never has a time', () => {
    const r = cleanSyncMarks([{ n: 1, t: NaN, kind: 'start' }, { n: 2, t: Infinity, kind: 'start' }, { n: 3, t: '5', kind: 'start' }, { n: 4, t: 9, kind: 'skip' }])
    expect(r.map((m) => m.t)).toEqual([null, null, null, null])
  })
  it('confidence is clamped to 0–1, and junk confidence is none', () => {
    const r = cleanSyncMarks([{ n: 1, t: 1, kind: 'start', confidence: 7 }, { n: 2, t: 1, kind: 'start', confidence: -3 }, { n: 3, t: 1, kind: 'start', confidence: NaN }, { n: 4, t: 1, kind: 'start', confidence: '0.5' }])
    expect(r.map((m) => m.confidence)).toEqual([1, 0, null, null])
  })
  it('anything that is not a list is an empty list', () => {
    for (const x of [null, undefined, 5, 'a', {}, { length: 3 }]) expect(cleanSyncMarks(x)).toEqual([])
  })
  it('keeps prototype tricks out (an object with __proto__ is just a bad mark)', () => {
    const evil = JSON.parse('[{"n":1,"kind":"start","t":1,"__proto__":{"polluted":true}}]')
    const r = cleanSyncMarks(evil)
    expect(r).toHaveLength(1)
    expect(Object.keys(r[0]).sort()).toEqual(['confidence', 'kind', 'n', 't'])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('regions that arrive from outside', () => {
  it('keeps good ones, trims long notes to 200 characters', () => {
    const r = cleanSyncRegions([{ kind: 'gap', start: 1, end: 5, note: 'x'.repeat(500) }, { kind: 'differs', start: 9, end: 12 }])
    expect(r[0].note).toHaveLength(200)
    expect(r[1]).toEqual({ kind: 'differs', start: 9, end: 12, note: undefined })
  })
  it('drops unknown kinds and non-finite or non-number times', () => {
    expect(cleanSyncRegions([{ kind: 'song', start: 1, end: 2 }, { kind: 'gap', start: NaN, end: 2 }, { kind: 'gap', start: 1, end: Infinity }, { kind: 'gap', start: '1', end: 2 }, null, 3])).toEqual([])
    expect(cleanSyncRegions('nope')).toEqual([])
  })
  it('a note that is not text is dropped, not carried', () => {
    expect(cleanSyncRegions([{ kind: 'gap', start: 1, end: 2, note: { a: 1 } }])[0].note).toBeUndefined()
  })
})

describe('text language codes', () => {
  it('two or three lower-case letters only; everything else — paths, markup, other cases — is null', () => {
    for (const ok of ['es', 'fr', 'fra', 'am']) expect(cleanTextLanguage(ok)).toBe(ok)
    for (const bad of ['', 'E', 'ES', 'english', 'es-MX', '../x', '<b>', 'e s', null, undefined, 5, ['es']]) expect(cleanTextLanguage(bad)).toBeNull()
  })
})

describe('settings changes from a window', () => {
  it('accepts real options with valid values', () => {
    expect(cleanTapeSettingsPatch({ escRule: 'pause', leadSec: 6, view: 'single', speedRange: 'narrow', videoRule: 'stop', deviceLoss: 'default', mismatchPolicy: 'never' }))
      .toEqual({ escRule: 'pause', leadSec: 6, view: 'single', speedRange: 'narrow', videoRule: 'stop', deviceLoss: 'default', mismatchPolicy: 'never' })
  })
  it('refuses values outside an option\'s list (right type, wrong choice)', () => {
    expect(cleanTapeSettingsPatch({ escRule: 'explode', view: 'cinema', speedRange: 'fast', videoRule: 'ignore', deviceLoss: 'panic', mismatchPolicy: 'always' })).toEqual({})
  })
  it('refuses values of the wrong type, and keys that are not options', () => {
    expect(cleanTapeSettingsPatch({ leadSec: '4', escRule: 3, outputDeviceId: 5, evil: 'x', __proto__: { a: 1 }, constructor: 'x' })).toEqual({})
  })
  it('the lead is clamped to 0–10 s and NaN is refused', () => {
    expect(cleanTapeSettingsPatch({ leadSec: 99 })).toEqual({ leadSec: 10 })
    expect(cleanTapeSettingsPatch({ leadSec: -4 })).toEqual({ leadSec: 0 })
    expect(cleanTapeSettingsPatch({ leadSec: NaN })).toEqual({})
  })
  it('paths for the recogniser are kept as text but an absurdly long one is refused', () => {
    expect(cleanTapeSettingsPatch({ whisperPath: '/opt/whisper/whisper-cli' })).toEqual({ whisperPath: '/opt/whisper/whisper-cli' })
    expect(cleanTapeSettingsPatch({ whisperPath: 'x'.repeat(5000) })).toEqual({})
  })
  it('anything that is not an object changes nothing', () => {
    for (const p of [null, undefined, 3, 'escRule', [], true]) expect(cleanTapeSettingsPatch(p)).toEqual({})
  })
  it('every key it can set exists in the defaults (so a new option cannot be forgotten here)', () => {
    const all = cleanTapeSettingsPatch({ ...TAPE_DEFAULTS })
    expect(Object.keys(all).sort()).toEqual(Object.keys(TAPE_DEFAULTS).sort())
  })
})
