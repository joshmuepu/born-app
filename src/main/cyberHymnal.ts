/**
 * cyberHymnal.ts — a second free public-domain hymn source (hymntime.com,
 * "The Cyber Hymnal") alongside Hymnary.org. Verified by hand against real
 * pages before writing this, the same way hymnary.ts was:
 *
 * - No bot/JS challenge on either its search-by-letter index pages or its
 *   individual hymn pages — plain fetch() works for both, no hidden
 *   BrowserWindow needed here.
 * - There's no query-based search endpoint (their own "Search" page just
 *   redirects to a Google site-search in a new tab — not something this app
 *   should scrape). What IS real and plain-HTML is a per-letter title index
 *   (ttl/ttl-a.htm .. ttl/ttl-z.htm, ~900+ entries each) — searchCyberHymnal
 *   fetches the index page matching the query's first letter and matches
 *   titles against it directly, no Google involved.
 * - Unlike Hymnary, a hymn page here has no single structured "Copyright:
 *   Public Domain" field to gate on. The site's own stated policy
 *   (misc/copyrite.htm) is: material with no copyright notice is, to their
 *   knowledge, public domain; anything copyrighted is "clearly marked as
 *   such." That's the gate this module applies — but because it's reading
 *   prose for the ABSENCE of a notice rather than checking an explicit
 *   field, it's treated as a softer signal than Hymnary's: only when no
 *   notice is found AND every date on the page is safely pre-1929 does this
 *   auto-pass; otherwise the caller is told to have the operator confirm it
 *   themselves before saving (see `needsConfirmation` below).
 * - Their page text is riddled with U+00AD soft hyphens (their own
 *   line-wrap hinting) — stripped everywhere text is extracted, or words
 *   come out with a stray hyphen in the middle.
 */
import { cleanLyricText, isUsableSong, type ParsedSong, type ParsedSongSlide } from '../shared/song'
import { decodeEntities } from './hymnary'
import { log } from './logger'

const BASE = 'http://www.hymntime.com/tch'

export interface CyberHymnalCandidate {
  title: string
  url: string
}

function stripSoftHyphen(s: string): string {
  return s.replace(/­/g, '')
}

/** Diacritic-insensitive so a search for "Blessed Assurance" finds the
 *  site's own "Blessèd As­sur­ance" — their archaic-spelling house style
 *  shouldn't be something an operator has to already know to type. */
function normalizeForMatch(s: string): string {
  return stripSoftHyphen(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export async function searchCyberHymnal(query: string): Promise<CyberHymnalCandidate[]> {
  const q = query.trim()
  const letter = /[A-Za-z]/.exec(q)?.[0]?.toLowerCase()
  if (!letter) return []
  const listUrl = `${BASE}/ttl/ttl-${letter}.htm`

  let html: string
  try {
    const res = await fetch(listUrl, { headers: { 'User-Agent': 'BORN-app (+https://joshmuepu.com/born)' } })
    if (!res.ok) return []
    html = await res.text()
  } catch (e) {
    log.error('searchCyberHymnal failed', e)
    throw e instanceof Error ? e : new Error('Could not reach the Cyber Hymnal.')
  }

  const qNorm = normalizeForMatch(q)
  const seen = new Set<string>()
  const out: CyberHymnalCandidate[] = []
  for (const m of html.matchAll(/<a href="([^"]+\.htm)">([^<]*)<\/a>/g)) {
    const title = decodeEntities(stripSoftHyphen(m[2])).trim()
    if (!title || !normalizeForMatch(title).includes(qNorm)) continue
    let url: string
    try {
      url = new URL(m[1], listUrl).href
    } catch {
      continue
    }
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ title, url })
    if (out.length >= 20) break
  }
  return out
}

export type CyberHymnalFetchResult =
  | { ok: true; song: ParsedSong; url: string; needsConfirmation: boolean; confirmationNote?: string }
  | { ok: false; reason: 'not-found' | 'copyrighted' | 'parse-failed'; copyright?: string }

const COPYRIGHT_RE = /copyright\s*©|©\s*(?:19|20)\d{2}|all rights reserved|used by permission/i
const YEAR_RE = /\b(1[5-9]\d{2}|20[0-2]\d)\b/g

function extractYears(text: string): number[] {
  return [...text.matchAll(YEAR_RE)].map((m) => parseInt(m[1], 10))
}

/** Chorus text is only written out once; every later repeat is just the bare
 *  word "Refrain"/"Chorus" — a live projection needs the real words on
 *  screen every time it's sung, so a repeat marker gets the last real
 *  chorus slide appended again, same convention hymnary.ts uses for
 *  Hymnary's own bracketed [Refrain] tags. */
export function extractSlides(html: string): ParsedSongSlide[] {
  const start = html.indexOf('lyrics-text')
  if (start === -1) return []
  const sectionEnd = html.indexOf('</section>', start)
  const section = sectionEnd === -1 ? html.slice(start) : html.slice(start, sectionEnd)

  const blocks = [...section.matchAll(/<p(?:\s+class="([^"]*)")?[^>]*>([\s\S]*?)<\/p>/g)]
  const slides: ParsedSongSlide[] = []
  let verseNum = 0
  let lastChorus: ParsedSongSlide | null = null

  for (const [, cls, raw] of blocks) {
    let text = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    // Their HTML source has a literal \r\n right after every <br> (their own
    // page-source formatting, not part of the lyric) — left alone, that
    // lands immediately behind the \n the <br> conversion above just
    // inserted, so cleanLyricText's \r\n→\n normalization only collapses the
    // \r, leaving a doubled \n\n between every single line. Collapse any run
    // of whitespace spanning a newline down to one \n first, same fix
    // hymnary.ts needs for the same reason.
    text = text.replace(/[ \t]*\r?\n[ \t\r\n]*/g, '\n').trim()
    text = cleanLyricText(stripSoftHyphen(decodeEntities(text)))
    if (!text) continue

    const isChorus = cls === 'chorus'
    if (isChorus && /^(refrain|chorus)$/i.test(text)) {
      if (lastChorus) slides.push({ ...lastChorus })
      continue
    }
    if (isChorus) {
      const slide: ParsedSongSlide = { label: 'Chorus', text }
      slides.push(slide)
      lastChorus = slide
      continue
    }
    verseNum++
    slides.push({ label: `Verse ${verseNum}`, text })
  }
  return slides
}

export function extractAuthor(description: string): string | undefined {
  const m = /Words:\s*([^,.\d]+)/i.exec(description)
  return m ? m[1].trim() : undefined
}

export async function fetchCyberHymnalHymn(url: string): Promise<CyberHymnalFetchResult> {
  try {
    const u = new URL(url)
    if (!/(^|\.)hymntime\.com$/i.test(u.hostname)) return { ok: false, reason: 'not-found' }
  } catch {
    return { ok: false, reason: 'not-found' }
  }

  let html: string
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'BORN-app (+https://joshmuepu.com/born)' } })
    if (!res.ok) return { ok: false, reason: 'not-found' }
    html = await res.text()
  } catch (e) {
    log.error('fetchCyberHymnalHymn failed', e)
    return { ok: false, reason: 'not-found' }
  }

  const titleMatch = /<title>([^<]*)<\/title>/.exec(html)
  const title = titleMatch ? decodeEntities(stripSoftHyphen(titleMatch[1])).trim() : ''
  const slides = extractSlides(html)
  const descMatch = /<meta name="description" content="([^"]*)"/.exec(html)
  const description = descMatch ? decodeEntities(descMatch[1]) : ''
  const song: ParsedSong = { title, author: extractAuthor(description), slides }
  if (!title || !isUsableSong(song)) return { ok: false, reason: 'parse-failed' }

  // The gate: their own stated policy (see file header) treats an absent
  // copyright notice as their determination of public domain — checked
  // against the page's visible text, not just the lyrics block, since a
  // notice usually sits in the preface/credits area around the lyrics.
  const visibleText = decodeEntities(
    html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ')
  )
  if (COPYRIGHT_RE.test(visibleText)) {
    const m = /([^.]*(?:copyright|all rights reserved|used by permission)[^.]*\.)/i.exec(visibleText)
    return { ok: false, reason: 'copyrighted', copyright: m ? m[1].trim() : undefined }
  }

  const years = extractYears(description)
  const allPre1929 = years.length > 0 && years.every((y) => y <= 1928)
  return {
    ok: true,
    song,
    url,
    needsConfirmation: !allPre1929,
    confirmationNote: allPre1929
      ? undefined
      : "We couldn't automatically confirm this is public domain (no clear pre-1929 date found on the page) — please check the source page before saving."
  }
}
