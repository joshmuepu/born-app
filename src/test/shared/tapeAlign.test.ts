import { describe, it, expect } from 'vitest'
import { alignParagraphs, heardFromWhisperJson, normWord, tokenize, type HeardWord } from '../../shared/tapeAlign'

/** deterministic pseudo-words: a small seeded generator, so a "sermon" of any size can be built without any real text */
function rng(seed: number): () => number { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 } }
const SYL = ['ba', 'lo', 'mi', 'ra', 'to', 'ne', 'ku', 'sa', 'vi', 'de', 'pho', 'lun', 'ger', 'wil', 'dar', 'tos']
function makeSermon(paragraphs: number, seed = 1): Array<{ n: number; text: string }> {
  const r = rng(seed)
  const word = (): string => Array.from({ length: 2 + Math.floor(r() * 2) }, () => SYL[Math.floor(r() * SYL.length)]).join('')
  const common = ['the', 'and', 'of', 'to', 'in', 'that', 'is', 'was', 'he', 'for']
  return Array.from({ length: paragraphs }, (_, i) => ({ n: i + 1, text: Array.from({ length: 25 + Math.floor(r() * 60) }, () => (r() < 0.35 ? common[Math.floor(r() * common.length)] : word())).join(' ') }))
}
interface Truth { n: number; t: number }
/** "Speak" the sermon at ~2.6 words/s with pauses, drop/replace/insert words like a recogniser does; return what was heard + the true starts. */
function speak(paras: Array<{ n: number; text: string }>, o: { drop?: number; sub?: number; ins?: number; skip?: number[]; music?: Array<{ after: number; sec: number }>; seed?: number } = {}): { heard: HeardWord[]; truth: Truth[] } {
  const r = rng(o.seed ?? 9)
  let t = 22
  const heard: HeardWord[] = []
  const truth: Truth[] = []
  for (const p of paras) {
    if (o.skip?.includes(p.n)) continue
    t += 0.8 + r() * 3
    truth.push({ n: p.n, t })
    for (const w of p.text.split(' ')) {
      t += 0.35 + r() * 0.1
      const x = r()
      if (x < (o.drop ?? 0)) continue
      heard.push({ w: x < (o.drop ?? 0) + (o.sub ?? 0) ? 'zzq' + Math.floor(r() * 50) : w, t })
      if (r() < (o.ins ?? 0)) { t += 0.3; heard.push({ w: 'uh' + Math.floor(r() * 9), t }) }
    }
    const m = o.music?.find((x) => x.after === p.n)
    if (m) t += m.sec
  }
  return { heard, truth }
}
const errs = (res: ReturnType<typeof alignParagraphs>, truth: Truth[]): number[] =>
  truth.flatMap((tr) => { const m = res.marks.find((x) => x.n === tr.n && x.kind === 'start'); return m && m.t !== null ? [Math.abs(m.t - tr.t)] : [] }).sort((a, b) => a - b)

describe('words', () => {
  it('normalises punctuation, case, curly apostrophes and other scripts', () => {
    expect(normWord('“Hello,”')).toBe('hello')
    expect(normWord("Lord’s")).toBe("lord's")
    expect(normWord('—')).toBe('')
    expect(normWord('ΑΛΦΑ')).toBe('αλφα')
    expect(tokenize('Hello — world! 12:3')).toEqual(['hello', 'world', '123'])
  })
})

describe('proposing paragraph starts from what was heard', () => {
  it('a perfect hearing puts every paragraph start within the tolerance, with high confidence', () => {
    const s = makeSermon(40)
    const { heard, truth } = speak(s)
    const res = alignParagraphs(heard, s)
    const e = errs(res, truth)
    expect(e).toHaveLength(40)
    expect(e[e.length - 1]).toBeLessThan(0.5)
    expect(res.marks.every((m) => (m.confidence ?? 0) >= 0.8)).toBe(true)
    expect(res.stats.located).toBe(40)
    expect(res.stats.matchedWordsPct).toBeGreaterThan(95)
  })
  it('a noisy hearing (15 % dropped, 8 % wrong, 5 % extra) still finds every paragraph, median error under 0.5 s', () => {
    const s = makeSermon(120, 3)
    const { heard, truth } = speak(s, { drop: 0.15, sub: 0.08, ins: 0.05 })
    const res = alignParagraphs(heard, s)
    const e = errs(res, truth)
    expect(e.length).toBeGreaterThanOrEqual(118)
    expect(e[Math.floor(e.length / 2)]).toBeLessThan(0.5)
    expect(e[Math.floor(e.length * 0.9)]).toBeLessThan(5)
    expect(res.stats.matchedWordsPct).toBeGreaterThan(70)
  })
  it('a very noisy hearing lowers the confidence of the paragraphs it is unsure about (so they are reviewed first)', () => {
    const s = makeSermon(60, 5)
    const clean = alignParagraphs(speak(s).heard, s)
    const noisy = alignParagraphs(speak(s, { drop: 0.45, sub: 0.2 }).heard, s)
    const mean = (r: typeof clean): number => r.marks.reduce((a, m) => a + (m.confidence ?? 0), 0) / r.marks.length
    expect(mean(noisy)).toBeLessThan(mean(clean))
    expect(noisy.stats.lowConfidence).toBeGreaterThan(clean.stats.lowConfidence)
  })
  it('a paragraph that is in the text but NOT on the tape is proposed as "not on this tape", never given an invented time', () => {
    const s = makeSermon(40, 7)
    const { heard } = speak(s, { skip: [20, 21] })
    const res = alignParagraphs(heard, s)
    for (const n of [20, 21]) {
      const m = res.marks.find((x) => x.n === n)!
      expect(m.kind === 'skip' || (m.confidence ?? 1) < 0.5).toBe(true)
    }
    // and its neighbours are still right
    const t19 = res.marks.find((x) => x.n === 19)!.t as number, t22 = res.marks.find((x) => x.n === 22)!.t as number
    expect(t22).toBeGreaterThan(t19)
  })
  it('a long song (no words heard) is proposed as a "no text here" region, and does not confuse the paragraphs after it', () => {
    const s = makeSermon(40, 11)
    const { heard, truth } = speak(s, { music: [{ after: 15, sec: 140 }] })
    const res = alignParagraphs(heard, s)
    expect(res.regions.some((r) => r.kind === 'gap' && r.end - r.start > 100)).toBe(true)
    expect(errs(res, truth).pop()).toBeLessThan(1)
  })
  it('times never go backwards', () => {
    const s = makeSermon(80, 13)
    const res = alignParagraphs(speak(s, { drop: 0.3, sub: 0.15 }).heard, s)
    const ts = res.marks.filter((m) => m.kind === 'start').map((m) => m.t as number)
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThanOrEqual(ts[i - 1])
  })
  it('repeated phrases (a chorus said three times) do not pull paragraphs to the wrong place', () => {
    const s = makeSermon(30, 17)
    const refrain = 'amen amen hallelujah praise the lord'
    s[4].text = refrain + ' ' + s[4].text
    s[14].text = refrain + ' ' + s[14].text
    s[24].text = refrain + ' ' + s[24].text
    const { heard, truth } = speak(s, { drop: 0.1, sub: 0.05 })
    expect(errs(alignParagraphs(heard, s), truth).length).toBeGreaterThanOrEqual(28)
    const e = errs(alignParagraphs(heard, s), truth)
    expect(e[Math.floor(e.length * 0.9)]).toBeLessThan(5)
  })
  it('a long tape is fast: 400 paragraphs (~20 000 words) align in well under 2 seconds', () => {
    const s = makeSermon(400, 19)
    const { heard } = speak(s, { drop: 0.12, sub: 0.06, ins: 0.04 })
    const t0 = performance.now()
    const res = alignParagraphs(heard, s)
    expect(performance.now() - t0).toBeLessThan(2000)
    expect(res.marks.length).toBe(400)
  })
  it('nothing heard or nothing to align yields nothing, never an exception', () => {
    expect(alignParagraphs([], makeSermon(5)).marks).toEqual([])
    expect(alignParagraphs([{ w: 'a', t: 1 }], []).marks).toEqual([])
    expect(alignParagraphs([{ w: 'hello', t: 1 }, { w: 'there', t: 2 }, { w: 'friend', t: 3 }], [{ n: 1, text: '' }]).marks).toEqual([])
  })
  it('non-Latin text works (Cyrillic, with punctuation)', () => {
    const base = 'Господь пастырь мой я ни в чём не буду нуждаться на пажитях злачных покоит меня'.split(' ')
    const paras = [{ n: 1, text: base.join(' ') + '.' }, { n: 2, text: 'Он водит меня к водам тихим, подкрепляет душу мою и направляет меня на стези правды' }]
    const heard: HeardWord[] = []
    let t = 5
    for (const p of paras) for (const w of p.text.split(' ')) { heard.push({ w, t }); t += 0.5 }
    const res = alignParagraphs(heard, paras)
    expect(res.marks.map((m) => m.n)).toEqual([1, 2])
    expect(res.marks[1].t).toBeCloseTo(5 + 0.5 * base.length, 1)
  })
})

describe('reading whisper.cpp output', () => {
  it('one word per entry, timed, punctuation-only entries dropped, early starts pulled up to 0.4 s before the word ends', () => {
    const j = { transcription: [
      { offsets: { from: 0, to: 0 }, text: '' },
      { offsets: { from: 0, to: 28080 }, text: ' The' },
      { offsets: { from: 28080, to: 28320 }, text: ' Lord' },
      { offsets: { from: 28320, to: 28500 }, text: ' —' }
    ] }
    expect(heardFromWhisperJson(j)).toEqual([{ w: 'The', t: 27.68 }, { w: 'Lord', t: 28.08 }])
    expect(heardFromWhisperJson(null)).toEqual([])
    expect(heardFromWhisperJson({ transcription: 'x' })).toEqual([])
  })
})
