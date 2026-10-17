/**
 * tapeAlign.ts — turn "what a speech recogniser heard, with times" and "the sermon text, by numbered paragraph" into PROPOSED paragraph start
 * times, with a confidence for each (pure functions, no Electron; the recogniser itself is a separate, optional add-on).
 *
 * How: both word lists are lower-cased and stripped of punctuation. Words (three in a row) that occur exactly once in the heard text AND exactly
 * once in the sermon text are anchors; the longest increasing chain of anchors is the skeleton (the tape and the text agree there). Each
 * paragraph's start is then found near that skeleton — by an anchor in its first words, else by the best fuzzy match of its first words in
 * the stretch between the surrounding anchors, else (low confidence) by interpolation. Nothing here is ever applied by itself: the result is a
 * PROPOSAL the operator reviews in the sync editor, lowest confidence first.
 */
import type { SyncMark, SyncRegion } from './tape'

export interface HeardWord {
  w: string
  /** seconds: when the word starts (as best the recogniser knows) */
  t: number
}
export interface AlignParagraph {
  n: number
  text: string
}
export interface AlignStats {
  paragraphs: number
  located: number
  lowConfidence: number
  /** share of the sermon's words that matched what was heard */
  matchedWordsPct: number
  anchors: number
}
export interface AlignResult {
  marks: SyncMark[]
  regions: SyncRegion[]
  stats: AlignStats
  /** paragraph numbers whose start was NOT found in what was heard (their time is a guess between neighbours, or none): the ones to listen to first */
  unlocated?: number[]
}

/** One comparable word: letters and digits of any script (and an apostrophe), lower-cased; empty for pure punctuation. */
export function normWord(s: string): string {
  return s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}'’]+/gu, '').replace(/’/g, "'")
}
export const tokenize = (text: string): string[] => text.split(/\s+/).map(normWord).filter(Boolean)

const K_ANCHOR = 3
const FIRST_WORDS = 8
const WINDOW = 16

/** Longest increasing subsequence of `a` (indices into a), O(n log n). */
function lis(a: number[]): number[] {
  const tails: number[] = []
  const tailIdx: number[] = []
  const prev: number[] = new Array(a.length).fill(-1)
  for (let i = 0; i < a.length; i++) {
    let lo = 0, hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tails[mid] < a[i]) lo = mid + 1
      else hi = mid
    }
    tails[lo] = a[i]
    tailIdx[lo] = i
    prev[i] = lo > 0 ? tailIdx[lo - 1] : -1
  }
  const out: number[] = []
  let k = tailIdx[tails.length - 1]
  while (k >= 0) { out.push(k); k = prev[k] }
  return out.reverse()
}

export function alignParagraphs(heard: HeardWord[], paragraphs: AlignParagraph[]): AlignResult {
  const H = heard.map((h) => ({ w: normWord(h.w), t: h.t })).filter((h) => h.w)
  const refWords: string[] = []
  const owner: number[] = []
  const firstIdx: number[] = []
  paragraphs.forEach((p, pi) => {
    firstIdx.push(refWords.length)
    for (const w of tokenize(p.text)) { refWords.push(w); owner.push(pi) }
  })
  const total = refWords.length
  const empty: AlignResult = { marks: [], regions: [], stats: { paragraphs: paragraphs.length, located: 0, lowConfidence: 0, matchedWordsPct: 0, anchors: 0 } }
  if (H.length < K_ANCHOR || total < K_ANCHOR) return empty

  // ── anchors: three-word groups that appear exactly once on each side ──
  const key = (arr: string[], i: number): string => `${arr[i]} ${arr[i + 1]} ${arr[i + 2]}`
  const hCount = new Map<string, number[]>()
  const hw = H.map((h) => h.w)
  for (let i = 0; i + K_ANCHOR <= hw.length; i++) {
    const k = key(hw, i)
    const l = hCount.get(k)
    if (l) l.push(i); else hCount.set(k, [i])
  }
  const rCount = new Map<string, number[]>()
  for (let i = 0; i + K_ANCHOR <= total; i++) {
    const k = key(refWords, i)
    const l = rCount.get(k)
    if (l) l.push(i); else rCount.set(k, [i])
  }
  const pairs: Array<{ h: number; r: number }> = []
  for (const [k, rs] of rCount) {
    const hs = hCount.get(k)
    if (rs.length === 1 && hs && hs.length === 1) pairs.push({ h: hs[0], r: rs[0] })
  }
  pairs.sort((a, b) => a.h - b.h)
  const chain = lis(pairs.map((p) => p.r)).map((i) => pairs[i])
  // every word inside an anchored group counts as matched
  const matchedRef = new Uint8Array(total)
  const refToHeard = new Int32Array(total).fill(-1)
  for (const a of chain) for (let k = 0; k < K_ANCHOR; k++) { matchedRef[a.r + k] = 1; refToHeard[a.r + k] = a.h + k }

  // between consecutive anchors, match remaining words greedily in order (the stretch is short, so this is cheap and local)
  for (let c = 0; c <= chain.length; c++) {
    const rLo = c === 0 ? 0 : chain[c - 1].r + K_ANCHOR
    const rHi = c === chain.length ? total : chain[c].r
    const hLo = c === 0 ? 0 : chain[c - 1].h + K_ANCHOR
    const hHi = c === chain.length ? H.length : chain[c].h
    if (rHi - rLo <= 0 || hHi - hLo <= 0 || (rHi - rLo) * (hHi - hLo) > 4_000_000) continue
    let hp = hLo
    for (let r = rLo; r < rHi; r++) {
      // the next heard word (within a small look-ahead) equal to this sermon word
      for (let j = hp; j < Math.min(hHi, hp + 6); j++) {
        if (hw[j] === refWords[r]) { matchedRef[r] = 1; refToHeard[r] = j; hp = j + 1; break }
      }
    }
  }

  // ── each paragraph's start ──
  const marks: SyncMark[] = []
  const unlocated: number[] = []
  const startHeard: number[] = []
  const quality: number[] = []
  const reaction = 0 // the heard word's time is the word's own start
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const r0 = firstIdx[pi]
    const r1 = pi + 1 < paragraphs.length ? firstIdx[pi + 1] : total
    const len = r1 - r0
    let h = -1
    let q = 0
    // 1. a matched word among the paragraph's first few words
    for (let r = r0; r < Math.min(r1, r0 + 4); r++) {
      if (matchedRef[r]) { h = refToHeard[r] - (r - r0); q = r === r0 ? 1 : 0.9; break }
    }
    // 2. the best fuzzy match of its first words, in the stretch between the neighbouring matches
    if (h < 0 && len > 0) {
      let rPrev = r0 - 1
      while (rPrev >= 0 && !matchedRef[rPrev]) rPrev--
      let rNext = r0
      while (rNext < total && !matchedRef[rNext]) rNext++
      const hFrom = rPrev >= 0 ? refToHeard[rPrev] + 1 : 0
      const hTo = rNext < total ? refToHeard[rNext] : H.length
      const want = refWords.slice(r0, Math.min(r1, r0 + FIRST_WORDS))
      if (hTo - hFrom >= 2 && want.length >= 3 && hTo - hFrom < 6000) {
        const wantSet = new Map<string, number>()
        for (const w of want) wantSet.set(w, (wantSet.get(w) ?? 0) + 1)
        let best = -1, bestScore = 0
        for (let j = hFrom; j < hTo; j++) {
          const seen = new Map<string, number>()
          let score = 0
          for (let k = j; k < Math.min(hTo, j + WINDOW); k++) {
            const need = wantSet.get(hw[k]) ?? 0
            const have = seen.get(hw[k]) ?? 0
            if (have < need) { score++; seen.set(hw[k], have + 1) }
          }
          if (score > bestScore) { bestScore = score; best = j }
        }
        if (best >= 0 && bestScore >= Math.ceil(want.length * 0.5)) {
          // the paragraph starts at the first window word that is one of its opening words
          let j = best
          while (j < hTo && !wantSet.has(hw[j])) j++
          h = j
          q = 0.5 + 0.3 * (bestScore / want.length)
        }
      }
    }
    startHeard.push(h)
    quality.push(q)
  }

  // paragraphs with no evidence are interpolated between their neighbours (low confidence); times must never go backwards
  const times: Array<number | null> = startHeard.map((h) => (h >= 0 ? H[Math.min(h, H.length - 1)].t - reaction : null))
  for (let pi = 0; pi < times.length; pi++) {
    if (times[pi] !== null) continue
    let a = pi - 1
    while (a >= 0 && times[a] === null) a--
    let b = pi + 1
    while (b < times.length && times[b] === null) b++
    if (a >= 0 && b < times.length) {
      // by the paragraphs' share of the words between the two known ones
      const wa = firstIdx[a], wb = firstIdx[b], wp = firstIdx[pi]
      times[pi] = (times[a] as number) + ((wp - wa) / Math.max(1, wb - wa)) * ((times[b] as number) - (times[a] as number))
      quality[pi] = 0.25
    } else if (a >= 0) { times[pi] = times[a] as number; quality[pi] = 0.15 } else if (b < times.length) { times[pi] = times[b] as number; quality[pi] = 0.15 }
  }
  // monotone: a time that goes backwards is pulled up to the previous one
  let last = 0
  for (let pi = 0; pi < times.length; pi++) {
    if (times[pi] === null) continue
    if ((times[pi] as number) < last) { times[pi] = last; quality[pi] = Math.min(quality[pi], 0.2) }
    last = times[pi] as number
  }

  // confidence: how sure the start is × how much of the paragraph was heard
  let matched = 0
  let lowConf = 0
  let located = 0
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const r0 = firstIdx[pi]
    const r1 = pi + 1 < paragraphs.length ? firstIdx[pi + 1] : total
    let m = 0
    for (let r = r0; r < r1; r++) m += matchedRef[r]
    matched += m
    const coverage = r1 > r0 ? m / (r1 - r0) : 0
    const t = times[pi]
    if (t === null) continue
    if (quality[pi] < 0.5) unlocated.push(paragraphs[pi].n)
    // a paragraph with practically nothing heard and no start evidence is "not on this tape"
    if (quality[pi] <= 0.25 && coverage < 0.1 && r1 - r0 >= 4) {
      marks.push({ n: paragraphs[pi].n, t: null, kind: 'skip', confidence: 0.2 })
      lowConf++
      continue
    }
    const conf = Math.max(0, Math.min(1, 0.55 * quality[pi] + 0.45 * Math.min(1, coverage / 0.8)))
    marks.push({ n: paragraphs[pi].n, t: Math.round(t * 100) / 100, kind: 'start', confidence: Math.round(conf * 100) / 100 })
    if (quality[pi] >= 0.5) located++
    if (conf < 0.7) lowConf++
  }

  // long stretches where nothing was heard (a song, a long silence) are proposed as "no text here" regions
  const regions: SyncRegion[] = []
  for (let i = 1; i < H.length; i++) {
    if (H[i].t - H[i - 1].t > 30) regions.push({ kind: 'gap', start: Math.round((H[i - 1].t + 1) * 100) / 100, end: Math.round((H[i].t - 0.5) * 100) / 100, note: 'nothing was recognised here' })
  }
  if (H[0].t > 30) regions.unshift({ kind: 'gap', start: 0, end: Math.round((H[0].t - 0.5) * 100) / 100, note: 'nothing was recognised here' })

  return { marks, regions, unlocated, stats: { paragraphs: paragraphs.length, located, lowConfidence: lowConf, matchedWordsPct: total ? Math.round((matched / total) * 1000) / 10 : 0, anchors: chain.length } }
}

/** Read whisper.cpp's JSON output (`-oj` with `-ml 1 -sow`: one word per entry) into timed words. */
export function heardFromWhisperJson(json: unknown): HeardWord[] {
  const out: HeardWord[] = []
  const list = (json as { transcription?: Array<{ offsets?: { from: number; to: number }; text?: string }> } | null)?.transcription
  if (!Array.isArray(list)) return out
  for (const s of list) {
    const text = (s.text ?? '').trim()
    if (!text || !s.offsets) continue
    // a word's start time is what the recogniser says, but it sometimes includes the silence before it: never earlier than 0.4 s before its end
    const from = s.offsets.from / 1000, to = s.offsets.to / 1000
    for (const w of text.split(/\s+/)) if (/[\p{L}\p{N}]/u.test(w)) out.push({ w, t: Math.max(from, to - 0.4) })
  }
  return out
}

/** The loudness of a recording as short frames (root-mean-square), for snapping proposed starts to real speech. */
export interface Envelope {
  frameSec: number
  rms: Float32Array
}

export interface RefineStats { moved: number; maxMoveSec: number; medianMoveSec: number }

/**
 * A recogniser's word times are unreliable around silence (it can put the first words of a paragraph INTO the pause before it, or let the last word of
 * the previous paragraph swallow the pause). A paragraph cannot start in silence, so: if there is no speech right at a proposed start, move it forward
 * to the first sustained speech after it — never past the next paragraph's start, never more than `maxForwardSec`. Starts already on speech, and anything
 * on a tape too noisy to tell speech from room (no clear quiet), are left alone.
 */
export function refineToSpeech(marks: SyncMark[], env: Envelope, opts: { maxForwardSec?: number } = {}): { marks: SyncMark[]; stats: RefineStats } {
  const maxForward = opts.maxForwardSec ?? 8
  const n = env.rms.length
  if (n < 50) return { marks, stats: { moved: 0, maxMoveSec: 0, medianMoveSec: 0 } }
  const sorted = Float32Array.from(env.rms).sort()
  const loud = sorted[Math.floor(n * 0.95)]
  const quiet = sorted[Math.floor(n * 0.05)] // a sermon is mostly speech: look at its quietest 5 %, not 20 %
  // no clear difference between speech and the quiet parts: do nothing rather than guess
  if (!(loud > 0) || quiet > loud * 0.25) return { marks, stats: { moved: 0, maxMoveSec: 0, medianMoveSec: 0 } }
  const thr = Math.max(loud * 0.08, quiet * 3)
  const sp = (i: number): boolean => i >= 0 && i < n && env.rms[i] > thr
  const win = Math.max(1, Math.round(0.1 / env.frameSec))
  const hold = Math.max(1, Math.round(0.25 / env.frameSec))
  const starts = marks.filter((m) => m.kind === 'start' && typeof m.t === 'number').sort((a, b) => (a.t as number) - (b.t as number))
  const nextOf = new Map<number, number | null>()
  starts.forEach((m, i) => nextOf.set(m.n, i + 1 < starts.length ? (starts[i + 1].t as number) : null))
  const moves: number[] = []
  const out = marks.map((m) => {
    if (m.kind !== 'start' || typeof m.t !== 'number') return m
    const t = m.t
    const i0 = Math.floor(t / env.frameSec)
    let hit = 0
    for (let k = 0; k < hold; k++) if (sp(i0 + k)) hit++
    if (hit >= hold * 0.4) return m // already on speech
    const limit = Math.min(t + maxForward, (nextOf.get(m.n) ?? Infinity) - 0.1)
    for (let j = i0; j * env.frameSec <= limit && j < n; j++) {
      let c = 0
      for (let k = 0; k < win; k++) if (sp(j + k)) c++
      if (c >= win * 0.8) {
        const nt = Math.round(j * env.frameSec * 100) / 100
        if (nt > t) { moves.push(nt - t); return { ...m, t: nt } }
        return m
      }
    }
    return m
  })
  moves.sort((a, b) => a - b)
  return { marks: out, stats: { moved: moves.length, maxMoveSec: moves.length ? Math.round(moves[moves.length - 1] * 100) / 100 : 0, medianMoveSec: moves.length ? Math.round(moves[Math.floor(moves.length / 2)] * 100) / 100 : 0 } }
}

/** RMS envelope of 16-bit mono PCM samples. */
export function envelopeOf(samples: Int16Array, sampleRate: number, frameSec = 0.02): Envelope {
  const per = Math.max(1, Math.round(sampleRate * frameSec))
  const frames = Math.floor(samples.length / per)
  const rms = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let s = 0
    for (let i = f * per; i < (f + 1) * per; i++) s += samples[i] * samples[i]
    rms[f] = Math.sqrt(s / per) / 32768
  }
  return { frameSec: per / sampleRate, rms }
}
