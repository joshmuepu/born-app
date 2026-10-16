import { describe, it, expect } from 'vitest'
import { parseTapeName, matchSermon, durationPlausible, titleSimilarity } from '../../shared/tapeMatch'
import { numberedParagraphs, numberAgreement } from '../../shared/tapeParagraphs'
import type { Quote } from '../../shared/queueItem'

const S = [
  { id: 1114, date_code: '65-0418E', title: 'Does God Ever Change His Mind About His Word?', duration_min: 126 },
  { id: 1115, date_code: '65-0418M', title: 'It Is The Rising Of The Sun', duration_min: 145 },
  { id: 900, date_code: '63-0901M', title: 'Seven Seals Introduction', duration_min: 90 }
]

describe('reading a tape file name', () => {
  it('reads the date code and cleans the title', () => {
    expect(parseTapeName('65-0418M It Is The Rising Of The Sun VGR.m4a')).toEqual({ dateCode: '65-0418M', title: 'It Is The Rising Of The Sun' })
  })
  it.each([
    ['65-0418M.m4a', '65-0418M'],
    ['VGR_65-0418M_It-Is-The-Rising-Of-The-Sun.mp3', '65-0418M'],
    ['65-0418m - It is the rising of the sun (VGR).m4a', '65-0418M'],
    ['650418M It Is.m4a', '65-0418M'],
    ['/Users/me/Downloads/65-0418E Does God Ever Change.m4a', '65-0418E'],
    ['65-0418 It Is The Rising Of The Sun.m4a', '65-0418']
  ])('tolerates the variation %s', (name, code) => {
    expect(parseTapeName(name).dateCode).toBe(code)
  })
  it('does not mistake other numbers for a code', () => {
    expect(parseTapeName('track 12.m4a').dateCode).toBeNull()
    expect(parseTapeName('IMG_2024-1399.m4a').dateCode).toBeNull() // month 13 is not a date
    expect(parseTapeName('').dateCode).toBeNull()
  })
})

describe('matching a file to a sermon', () => {
  it('an exact code with its letter is an exact match', () => {
    const m = matchSermon(parseTapeName('65-0418M It Is The Rising Of The Sun VGR.m4a'), S)
    expect(m.confidence).toBe('exact')
    expect(m.best?.id).toBe(1115)
  })
  it('a code with no letter can mean two sermons: ask, best guess by title', () => {
    const m = matchSermon(parseTapeName('65-0418 It Is The Rising Of The Sun.m4a'), S)
    expect(m.confidence).toBe('ambiguous')
    expect(m.best?.id).toBe(1115)
    expect(m.candidates.map((c) => c.id)).toEqual([1114])
  })
  it('a single sermon that day is exact even without the letter', () => {
    expect(matchSermon(parseTapeName('63-0901 anything.m4a'), S)).toMatchObject({ confidence: 'exact', best: { id: 900 } })
  })
  it('no code: a clear title match is offered (never applied silently)', () => {
    const m = matchSermon(parseTapeName('It Is The Rising Of The Sun.m4a'), S)
    expect(m.confidence).toBe('ambiguous')
    expect(m.best?.id).toBe(1115)
  })
  it('nothing recognisable: no match', () => {
    expect(matchSermon(parseTapeName('voice memo.m4a'), S).confidence).toBe('none')
    expect(matchSermon(parseTapeName('99-0101M x.m4a'), S).confidence).toBe('none')
  })
  it('title similarity is word overlap', () => {
    expect(titleSimilarity('It Is The Rising Of The Sun', 'it is the rising of the sun!')).toBe(1)
    expect(titleSimilarity('', 'abc')).toBe(0)
  })
})

describe('does the length fit the sermon?', () => {
  it('real numbers: a 2:24:48 tape for a sermon listed at 145 minutes fits', () => {
    expect(durationPlausible(8687.9, 145).ok).toBe(true)
  })
  it('a much shorter file does not, and the note says why', () => {
    const r = durationPlausible(48 * 60 + 10, 112)
    expect(r.ok).toBe(false)
    expect(r.note).toMatch(/48 minutes.*112/)
  })
  it('an unknown sermon length never blocks', () => {
    expect(durationPlausible(100, undefined).ok).toBe(true)
    expect(durationPlausible(100, 0).ok).toBe(true)
  })
})

const row = (ref: string, text: string): Quote => ({ text, sermonTitle: 'T', dateCode: '00-0000', sermonId: 1, paragraphIndex: 0, paragraphRef: ref })
describe('numbered paragraphs (the unit a tape is synchronised to)', () => {
  it('splits a range row into its numbered paragraphs, so "41-47" is seven paragraphs, not one', () => {
    const rows = [row('header', 'A HEADING'), row('1-3', '1 First paragraph of the placeholder text. 2 Second paragraph of the placeholder text. 3 Third one here.'), row('4', '4 Fourth.')]
    const p = numberedParagraphs(rows)
    expect(p.map((x) => x.n)).toEqual([1, 2, 3, 4])
    expect(p[1].text).toMatch(/^Second paragraph/)
  })
  it('long paragraphs stay ONE numbered paragraph with several pages', () => {
    const long = '7 ' + 'This is a sentence of placeholder words for paging. '.repeat(20)
    const p = numberedParagraphs([row('7', long)])
    expect(p).toHaveLength(1)
    expect(p[0].n).toBe(7)
    expect(p[0].pages.length).toBeGreaterThan(1)
    expect(p[0].markers[0]).toBe('7a')
  })
  it('agreement check finds the numbers two texts disagree on', () => {
    expect(numberAgreement([1, 2, 3, 4], [1, 2, 3, 4])).toMatchObject({ ok: true, common: 4 })
    const a = numberAgreement([1, 2, 3, 4, 5], [1, 2, 4, 5, 6])
    expect(a).toMatchObject({ ok: false, textOnly: [3], mapOnly: [6], common: 4 })
  })
})
