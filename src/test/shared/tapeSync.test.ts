import { describe, it, expect } from 'vitest'
import { paragraphAt, tickTimes, validateMap, editorReduce, emptyEditor, nextTarget, tapTime, toTimingFile, parseTimingFile, timedCount, startOf, MAX_GAP_WARN_SEC, prevParagraphTime, nextParagraphTime } from '../../shared/tapeSync'
import type { SyncMark, SyncRegion } from '../../shared/tape'

const m = (n: number, t: number | null, kind: 'start' | 'skip' = 'start', confidence: number | null = null): SyncMark => ({ n, t, kind, confidence })
const marks = [m(1, 26.5), m(2, 71), m(3, 138), m(4, null, 'skip'), m(5, 262), m(41, 400)]
const regions: SyncRegion[] = [{ kind: 'gap', start: 200, end: 260 }, { kind: 'differs', start: 300, end: 320 }]

describe('which paragraph is being spoken', () => {
  it('before the first timed paragraph there is none (the intro), and it says what comes next', () => {
    expect(paragraphAt(marks, [], 10)).toMatchObject({ n: null, start: null, next: { n: 1, t: 26.5 }, progress: null })
    expect(paragraphAt(marks, [], 0).n).toBeNull()
  })
  it('exactly at a start the paragraph has begun; one moment before it has not', () => {
    expect(paragraphAt(marks, [], 71).n).toBe(2)
    expect(paragraphAt(marks, [], 70.999).n).toBe(1)
  })
  it('progress through a paragraph runs 0 to 1 up to the next start', () => {
    const p = paragraphAt(marks, [], 104.5)
    expect(p).toMatchObject({ n: 2, start: 71, next: { n: 3, t: 138 } })
    expect(p.progress).toBeCloseTo(0.5, 2)
  })
  it('a paragraph marked "skip" is never the current one, and its time slot belongs to the one before', () => {
    expect(paragraphAt(marks, [], 200).n).toBe(3)
    expect(paragraphAt(marks, [], 262).n).toBe(5)
  })
  it('the last paragraph has no end: progress is unknown, never invented', () => {
    expect(paragraphAt(marks, [], 5000)).toMatchObject({ n: 41, next: null, progress: null })
  })
  it('works for range rows: paragraph numbers 41… are single paragraphs, in time order whatever the number order', () => {
    const odd = [m(10, 100), m(9, 50), m(11, 150)]
    expect(paragraphAt(odd, [], 120).n).toBe(10)
  })
  it('knows when the tape is inside a "no text here" or a "tape differs" region', () => {
    expect(paragraphAt(marks, regions, 220)).toMatchObject({ n: 3, inGap: true, inDiffers: false })
    expect(paragraphAt(marks, regions, 310)).toMatchObject({ n: 5, inGap: false, inDiffers: true })
    expect(paragraphAt(marks, regions, 260).inGap).toBe(false) // the end is exclusive
  })
  it('an empty map says nothing is timed', () => {
    expect(paragraphAt([], [], 50)).toMatchObject({ n: null, next: null })
  })
  it('lookups are fast on a real-sized sermon (400 paragraphs, 20 000 lookups)', () => {
    const big = Array.from({ length: 400 }, (_, i) => m(i + 1, i * 21.7))
    const t0 = performance.now()
    for (let i = 0; i < 20000; i++) paragraphAt(big, [], (i % 8680) + 0.3)
    expect(performance.now() - t0).toBeLessThan(200)
  })
  it('tick marks for the seek bar are the timed starts, in time order, without skipped ones', () => {
    expect(tickTimes(marks)).toEqual([26.5, 71, 138, 262, 400])
    expect(timedCount(marks)).toBe(5)
    expect(startOf(marks, 3)).toBe(138)
    expect(startOf(marks, 4)).toBeNull()
  })
})

describe('what is wrong with a map', () => {
  it('a good map has no errors', () => {
    expect(validateMap(marks, regions, 8688).filter((i) => i.level === 'error')).toEqual([])
  })
  it('times that go backwards as paragraph numbers go up are an error naming the paragraph', () => {
    const issues = validateMap([m(1, 100), m(2, 50)], [], 8688)
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', code: 'order', n: 2 }))
  })
  it('a time beyond the tape, a negative time and a duplicate paragraph are errors', () => {
    expect(validateMap([m(1, 9000)], [], 8688)[0]).toMatchObject({ level: 'error', code: 'range' })
    expect(validateMap([m(1, -2)], [], 8688)[0]).toMatchObject({ level: 'error', code: 'range' })
    expect(validateMap([m(1, 5), m(1, 6)], [], 8688).some((i) => i.code === 'duplicate')).toBe(true)
  })
  it('a long silence between paragraphs is a warning, not an error', () => {
    const i = validateMap([m(1, 0), m(2, MAX_GAP_WARN_SEC + 60)], [], 8688)
    expect(i.find((x) => x.code === 'gap')).toMatchObject({ level: 'warn' })
    expect(i.filter((x) => x.level === 'error')).toEqual([])
  })
  it('says how many paragraphs still have no time', () => {
    const i = validateMap([m(1, 1)], [], 100, [1, 2, 3])
    expect(i.find((x) => /2 paragraphs have no time/.test(x.message))).toBeTruthy()
  })
  it('an empty or backwards region is an error', () => {
    expect(validateMap([], [{ kind: 'gap', start: 50, end: 40 }], 100)[0]).toMatchObject({ level: 'error' })
  })
})

describe('the editor: tap, nudge, undo', () => {
  it('a tap places the paragraph\'s start and the next target moves on', () => {
    const nums = [1, 2, 3, 4]
    let s = emptyEditor()
    expect(nextTarget(s.marks, nums)).toBe(1)
    s = editorReduce(s, { type: 'tap', n: 1, t: 26.504 })
    expect(s.marks).toEqual([m(1, 26.5)])
    expect(s.dirty).toBe(true)
    expect(nextTarget(s.marks, nums)).toBe(2)
    s = editorReduce(s, { type: 'tap', n: 2, t: 71 })
    s = editorReduce(s, { type: 'skip', n: 3 })
    expect(nextTarget(s.marks, nums)).toBe(4) // a skipped paragraph is dealt with
  })
  it('after a correction the next target is the first number after the LATEST timed one (the operator taps forward in time)', () => {
    const nums = [1, 2, 3, 4, 5]
    const marksNow = [m(1, 10), m(2, 20), m(4, 40)]
    expect(nextTarget(marksNow, nums)).toBe(5)
    expect(nextTarget([m(1, 10), m(2, 20), m(3, 30), m(4, 40), m(5, 50)], nums)).toBeNull()
  })
  it('the reaction time is taken off the tap, never below zero, and is bounded', () => {
    expect(tapTime(100, 0.25)).toBe(99.75)
    expect(tapTime(0.1, 0.25)).toBe(0)
    expect(tapTime(100, 9)).toBe(98) // at most 2 s
    expect(tapTime(100, -3)).toBe(100)
  })
  it('nudge moves a mark by tenths, clears its auto-proposed confidence, never goes below 0, and ignores a paragraph with no time', () => {
    let s = emptyEditor([m(1, 0.05, 'start', 0.4), m(2, 71)])
    s = editorReduce(s, { type: 'nudge', n: 2, by: 0.1 })
    expect(startOf(s.marks, 2)).toBe(71.1)
    s = editorReduce(s, { type: 'nudge', n: 1, by: -0.1 })
    expect(s.marks.find((x) => x.n === 1)).toMatchObject({ t: 0, confidence: null })
    const before = s
    expect(editorReduce(s, { type: 'nudge', n: 99, by: 1 })).toBe(before)
  })
  it('UNDO takes back each change in turn, down to the saved state, and the editor is clean again', () => {
    let s = emptyEditor([m(1, 10)])
    s = editorReduce(s, { type: 'tap', n: 2, t: 20 })
    s = editorReduce(s, { type: 'nudge', n: 2, by: 0.5 })
    s = editorReduce(s, { type: 'region-add', region: { kind: 'gap', start: 0, end: 9 } })
    expect(s.marks).toHaveLength(2)
    s = editorReduce(s, { type: 'undo' })
    expect(s.regions).toEqual([])
    s = editorReduce(s, { type: 'undo' })
    expect(startOf(s.marks, 2)).toBe(20)
    s = editorReduce(s, { type: 'undo' })
    expect(s.marks).toEqual([m(1, 10)])
    expect(s.dirty).toBe(false)
    expect(editorReduce(s, { type: 'undo' })).toBe(s) // nothing left to undo
  })
  it('regions can be added (sorted) and removed; clear removes a mark; saving clears the history', () => {
    let s = emptyEditor([m(1, 10)])
    s = editorReduce(s, { type: 'region-add', region: { kind: 'gap', start: 300, end: 360, note: 'song' } })
    s = editorReduce(s, { type: 'region-add', region: { kind: 'differs', start: 100, end: 130 } })
    expect(s.regions.map((r) => r.start)).toEqual([100, 300])
    s = editorReduce(s, { type: 'region-remove', index: 0 })
    expect(s.regions).toHaveLength(1)
    s = editorReduce(s, { type: 'clear', n: 1 })
    expect(s.marks).toEqual([])
    s = editorReduce(s, { type: 'saved' })
    expect(s).toMatchObject({ dirty: false, past: [] })
  })
  it('history is bounded', () => {
    let s = emptyEditor()
    for (let i = 0; i < 500; i++) s = editorReduce(s, { type: 'tap', n: 1, t: i })
    expect(s.past.length).toBeLessThanOrEqual(200)
  })
})

describe('the times-only timing file', () => {
  const file = () => toTimingFile({ marks, regions, source: 'tap', textLanguage: null }, { hash: 'a'.repeat(64), durationSec: 8687.9, language: 'en' }, { id: 1115, dateCode: '65-0418M' })
  it('holds only numbers: no sermon text, no audio, no file path', () => {
    const text = JSON.stringify(file())
    expect(text).toMatch(/born-sync/)
    expect(text.length).toBeLessThan(600)
    expect(text).not.toMatch(/Users|\.m4a|text"/)
  })
  it('round-trips exactly', () => {
    const r = parseTimingFile(JSON.stringify(file()))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.marks.map((x) => [x.n, x.t, x.kind])).toEqual(marks.map((x) => [x.n, x.t, x.kind]))
    expect(r.regions).toEqual(regions)
    expect(r.file.sermon).toEqual({ id: 1115, dateCode: '65-0418M' })
  })
  it('refuses, in plain words, anything that is not a BORN timing file or is damaged or newer — and never throws', () => {
    for (const bad of ['', 'not json', '[]', '{}', '{"format":"other"}', JSON.stringify({ ...file(), v: 99 }), JSON.stringify({ ...file(), marks: 'x' }), JSON.stringify({ ...file(), marks: [[0, 5, null, 'start']] }), JSON.stringify({ ...file(), marks: [[1, 'no', null, 'start']] }), JSON.stringify({ ...file(), recording: null })]) {
      const r = parseTimingFile(bad)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message.length).toBeGreaterThan(10)
    }
  })
  it('drops a malformed region but keeps the rest', () => {
    const f = JSON.parse(JSON.stringify(file()))
    f.regions.push({ kind: 'gap', start: 50, end: 40 }, { kind: 'x', start: 1, end: 2 })
    const r = parseTimingFile(JSON.stringify(f))
    expect(r.ok && r.regions).toHaveLength(2)
  })
})

describe('previous and next paragraph', () => {
  const marks = [m(1, 10), m(2, 100), m(3, 200)]
  it('next goes to the next timed start; none in the last paragraph or without timing', () => {
    expect(nextParagraphTime(marks, [], 50)).toBe(100)
    expect(nextParagraphTime(marks, [], 150)).toBe(200)
    expect(nextParagraphTime(marks, [], 250)).toBeNull()
    expect(nextParagraphTime([], [], 5)).toBeNull()
  })
  it('previous: more than 3 s in goes to the start of this paragraph, otherwise to the one before, and at the very start to 0', () => {
    expect(prevParagraphTime(marks, [], 150)).toBe(100)
    expect(prevParagraphTime(marks, [], 101.5)).toBe(10)
    expect(prevParagraphTime(marks, [], 5)).toBe(0)
    expect(prevParagraphTime(marks, [], 11)).toBe(0)
    expect(prevParagraphTime([], [], 5)).toBeNull()
  })
  it('skipped paragraphs (no time) are never a destination', () => {
    const withSkip = [m(1, 10), m(2, null, 'skip'), m(3, 200)]
    expect(nextParagraphTime(withSkip, [], 50)).toBe(200)
    expect(prevParagraphTime(withSkip, [], 201)).toBe(10)
  })
})

