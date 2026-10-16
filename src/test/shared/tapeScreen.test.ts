import { describe, it, expect } from 'vitest'
import { tapeScreenView, pageAt, lowerThirdSpec, lowerThirdNow, LOWER_THIRD_CHARS, clampLead, describeView, MIN_PAGE_SECONDS, type TapeScreenSpec } from '../../shared/tapeScreen'

const items = [
  { n: 1, marker: '1', text: 'one' },
  { n: 2, marker: '2a', text: 'two a' }, { n: 2, marker: '2b', text: 'two b' }, { n: 2, marker: '2c', text: 'two c' },
  { n: 3, marker: '3', text: 'three' },
  { n: 4, marker: '4', text: 'four' }
]
const spec = (o: Partial<TapeScreenSpec> = {}): TapeScreenSpec => ({
  v: 1, recordingId: 'r', sermonId: 1, title: 'T', mode: 'highlight', leadSec: 4, pinned: null, items,
  marks: [{ n: 1, t: 10, kind: 'start' }, { n: 2, t: 30, kind: 'start' }, { n: 3, t: 90, kind: 'start' }, { n: 4, t: 100, kind: 'start' }],
  regions: [], ...o
})

describe('which page a long paragraph is on', () => {
  it('moves through the pages in proportion to the time', () => {
    expect([0, 19, 21, 40, 41, 59].map((e) => pageAt(3, e, 60))).toEqual([0, 0, 1, 2, 2, 2])
  })
  it('never flips faster than the floor, however short the paragraph', () => {
    expect(pageAt(3, 3, 6)).toBe(0)
    expect(pageAt(3, MIN_PAGE_SECONDS + 0.1, 6)).toBe(1)
    expect(pageAt(3, 100, 6)).toBe(2)
  })
  it('the last paragraph (no end time) pages on a fixed pace; one page is always page 0; time before the start is page 0', () => {
    expect(pageAt(3, 5, null)).toBe(0)
    expect(pageAt(3, 10, null)).toBe(1)
    expect(pageAt(1, 500, 10)).toBe(0)
    expect(pageAt(3, -5, 60)).toBe(0)
  })
})

describe('the highlight view', () => {
  it('shows the paragraph being spoken, and the page of it', () => {
    const v = tapeScreenView(spec(), 12)
    expect(v).toMatchObject({ speaking: 1, shown: 1, index: 0, page: 0, pages: 1 })
    const w = tapeScreenView(spec(), 55)
    expect(w).toMatchObject({ speaking: 2, shown: 2, page: 1, pages: 3, index: 2 })
    expect(w.next).toMatchObject({ n: 3, index: 4 })
    expect(w.next!.inSec).toBeCloseTo(35)
  })
  it('before the first timed paragraph there is nothing to show, but the first is coming', () => {
    const v = tapeScreenView(spec(), 3)
    expect(v.index).toBeNull()
    expect(v.next).toMatchObject({ n: 1 })
    expect(describeView(v)).toMatch(/Waiting/)
  })
  it('a "no text here" stretch holds what is on screen', () => {
    expect(tapeScreenView(spec({ regions: [{ kind: 'gap', start: 60, end: 80 }] }), 70).hold).toBe(true)
    expect(tapeScreenView(spec({ regions: [{ kind: 'gap', start: 60, end: 80 }] }), 85).hold).toBe(false)
  })
  it('a paragraph the text does not have shows nothing rather than the wrong one', () => {
    const v = tapeScreenView(spec({ marks: [{ n: 99, t: 5, kind: 'start' }] }), 20)
    expect(v.index).toBeNull()
    expect(v.shown).toBe(99)
  })
  it('the "projector follows" switch off holds one paragraph whatever the tape does', () => {
    const a = tapeScreenView(spec({ pinned: 3 }), 12)
    const b = tapeScreenView(spec({ pinned: 3 }), 500)
    expect(a.index).toBe(4)
    expect(b.index).toBe(4)
    expect(a.hold).toBe(false)
    expect(a.speaking).toBe(1) // the tape itself is still known
  })
})

describe('one at a time, with the next paragraph shown early', () => {
  const one = (lead: number, pos: number) => tapeScreenView(spec({ mode: 'one', leadSec: lead }), pos)
  it('switches `lead` seconds before the speaker starts the next paragraph', () => {
    expect(one(4, 25).shown).toBe(1)
    expect(one(4, 26).shown).toBe(2)
    expect(one(4, 26).speaking).toBe(1)
  })
  it('lead 0 switches exactly when the speaker does', () => {
    expect(one(0, 29.9).shown).toBe(1)
    expect(one(0, 30).shown).toBe(2)
  })
  it('the first page of the new paragraph is up at the early switch, and paging then follows the speaker', () => {
    expect(one(4, 27).page).toBe(0)
    expect(one(4, 27).index).toBe(1)
    // paragraph 2 lasts 60 s over 3 pages = 20 s each; 41 s after the start is page 2
    expect(one(4, 30 + 41 - 4).page).toBe(2)
  })
  it('the lead is clamped to 0–10 s and bad values fall back to 4', () => {
    expect(clampLead(-3)).toBe(0)
    expect(clampLead(99)).toBe(10)
    expect(clampLead(NaN)).toBe(4)
  })
  it('the highlight view ignores the lead (the highlight is the speaker)', () => {
    expect(tapeScreenView(spec({ mode: 'highlight', leadSec: 10 }), 26).shown).toBe(1)
  })
})

describe('the lower third / Graphics output', () => {
  const long = 'Alpha sentence one is here. Bravo sentence two follows it. Charlie sentence three comes next. Delta sentence four ends it. '.repeat(3).trim()
  const big = spec({ items: [{ n: 1, marker: '1', text: 'Short one.' }, { n: 2, marker: '2a', text: long }, { n: 3, marker: '3', text: 'Short three.' }] })
  it('re-cuts a long paragraph into short pages (sentence ends first), keeping its number', () => {
    const lt = lowerThirdSpec(big)
    const two = lt.items.filter((i) => i.n === 2)
    expect(two.length).toBeGreaterThan(2)
    expect(two.every((p) => p.text.length <= LOWER_THIRD_CHARS)).toBe(true)
    expect(two[0].marker).toBe('2')
    expect(two[1].marker).toBe('2b')
    expect(two.map((p) => p.text).join(' ')).toBe(long)
    expect(lt.mode).toBe('lower-third')
  })
  it('pages through a long paragraph as the tape moves, no faster than the floor', () => {
    const early = lowerThirdNow(big, 31)!
    const late = lowerThirdNow(big, 85)!
    expect(early.marker).toBe('2')
    expect(late.marker).not.toBe('2')
    expect(late.marker.startsWith('2')).toBe(true)
    // the floor: a few seconds in is still the first page
    expect(lowerThirdNow(big, 33)!.marker).toBe('2')
  })
  it('nothing yet before the first timed paragraph', () => {
    expect(lowerThirdNow(big, 2)).toBeNull()
  })
})
