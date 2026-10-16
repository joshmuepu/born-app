/**
 * tapeMatch.ts — which sermon is this audio file? Sermon recordings are named by their date code ("65-0418M …"). People rename
 * them ("65-0418M It Is The Rising Of The Sun VGR", "VGR_65-0418M_It-Is…", "650418M"), so the match tolerates those and always lets the
 * operator confirm: a code alone can mean two sermons (a morning and an evening), and a file with no code at all can only be guessed.
 */

export interface ParsedTapeName {
  /** "65-0418M", upper-cased; the letter is '' when the name has none */
  dateCode: string | null
  /** the part that looks like a title, cleaned of the date code, "VGR", extension, separators */
  title: string
}

// the suffix letter (M, E, A…) must be attached to the digits: "65-0418 It Is" has no letter, "65-0418M It Is" has M
const CODE = /(?:^|[^0-9])(\d{2})-?(\d{4})([A-Za-z])?(?![A-Za-z0-9])/

export function parseTapeName(fileName: string): ParsedTapeName {
  const base = (fileName.split(/[\\/]/).pop() ?? '').replace(/\.[A-Za-z0-9]{2,5}$/, '')
  const m = CODE.exec(base)
  let dateCode: string | null = null
  let rest = base
  if (m) {
    const month = parseInt(m[2].slice(0, 2), 10)
    const day = parseInt(m[2].slice(2), 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      dateCode = `${m[1]}-${m[2]}${(m[3] ?? '').toUpperCase()}`
      rest = base.slice(0, m.index + (m[0].startsWith(m[1]) ? 0 : 1)) + ' ' + base.slice(m.index + m[0].length)
    }
  }
  const title = rest
    .replace(/[_\-.]+/g, ' ')
    .replace(/\b(VGR|VOGR|M4A|MP3)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { dateCode, title }
}

export interface SermonRef {
  id: number
  date_code: string
  title: string
  duration_min?: number
}

export interface TapeMatch {
  best: SermonRef | null
  /** other plausible sermons, best first (the operator picks) */
  candidates: SermonRef[]
  /** 'exact' = code and (if given) letter agree and only one sermon fits; 'ambiguous' = ask; 'none' */
  confidence: 'exact' | 'ambiguous' | 'none'
}

const words = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
export function titleSimilarity(a: string, b: string): number {
  const A = new Set(words(a)), B = new Set(words(b))
  if (!A.size || !B.size) return 0
  let hit = 0
  for (const w of A) if (B.has(w)) hit++
  return hit / Math.max(A.size, B.size)
}

export function matchSermon(parsed: ParsedTapeName, sermons: SermonRef[]): TapeMatch {
  const none: TapeMatch = { best: null, candidates: [], confidence: 'none' }
  if (parsed.dateCode) {
    const letter = /[A-Z]{1,2}$/.exec(parsed.dateCode.slice(7))?.[0] ?? ''
    const day = parsed.dateCode.slice(0, 7)
    const sameDay = sermons.filter((s) => s.date_code.toUpperCase().startsWith(day))
    if (letter) {
      const exact = sameDay.filter((s) => s.date_code.toUpperCase() === parsed.dateCode)
      if (exact.length === 1) return { best: exact[0], candidates: sameDay.filter((s) => s !== exact[0]), confidence: 'exact' }
    }
    if (sameDay.length === 1 && !letter) return { best: sameDay[0], candidates: [], confidence: 'exact' }
    if (sameDay.length > 0) {
      const ranked = [...sameDay].sort((a, b) => titleSimilarity(parsed.title, b.title) - titleSimilarity(parsed.title, a.title))
      return { best: ranked[0], candidates: ranked.slice(1), confidence: 'ambiguous' }
    }
  }
  if (parsed.title.length >= 6) {
    const ranked = sermons
      .map((s) => ({ s, sim: titleSimilarity(parsed.title, s.title) }))
      .filter((x) => x.sim >= 0.6)
      .sort((a, b) => b.sim - a.sim)
    if (ranked.length) return { best: ranked[0].s, candidates: ranked.slice(1, 5).map((x) => x.s), confidence: 'ambiguous' }
  }
  return none
}

/** Is a tape of `tapeSec` plausible for a sermon the index says lasts `sermonMin` minutes? */
export function durationPlausible(tapeSec: number, sermonMin: number | undefined): { ok: boolean; note?: string } {
  if (!sermonMin || sermonMin <= 0) return { ok: true }
  const diffMin = Math.abs(tapeSec / 60 - sermonMin)
  const allowed = Math.max(8, sermonMin * 0.1)
  if (diffMin <= allowed) return { ok: true }
  const tm = Math.round(tapeSec / 60)
  return { ok: false, note: `The recording is ${tm} minutes; this sermon is listed at about ${sermonMin}.` }
}
