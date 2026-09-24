/**
 * hymnary.ts — search Hymnary.org for a title and pull in its representative
 * text as a BORN song, but only when the text is explicitly marked Public
 * Domain. Scoped to this one source deliberately (see the design proposal):
 * a general web search can't be trusted to gate copyright correctly, and
 * this is the one source with a real per-hymn editorial determination that's
 * actually checkable in code.
 *
 * Hymnary.org's /search (and a hymn's /fulltexts variant-comparison page) sit
 * behind a JS proof-of-work bot challenge that a plain fetch can't pass —
 * confirmed by hand before writing this. A hidden BrowserWindow solves it the
 * same way a real visitor's browser would (it *is* real Chromium), then we
 * read the rendered result links back out. A single hymn's own /text/<slug>
 * page is NOT behind that challenge, so once a hymn is picked, everything
 * after that is a plain, fast fetch() — no browser needed.
 */
import { BrowserWindow } from 'electron'
import { cleanLyricText, isUsableSong, type ParsedSong, type ParsedSongSlide } from '../shared/song'
import { log } from './logger'

const BASE = 'https://hymnary.org'

export interface HymnaryCandidate {
  title: string
  url: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Poll the hidden window's own document.title until the challenge page's
 *  title ("Establishing a secure connection ...") is replaced by the real
 *  page's — bounded, so a changed or broken challenge fails safely into
 *  "no results" rather than hanging. */
async function waitPastChallenge(win: BrowserWindow, attempts = 15): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const title = await win.webContents.executeJavaScript('document.title').catch(() => '')
    if (title && !/secure connection/i.test(title)) return true
    await sleep(1000)
  }
  return false
}

export async function searchHymnary(query: string): Promise<HymnaryCandidate[]> {
  const q = query.trim()
  if (!q) return []
  const win = new BrowserWindow({ show: false, width: 1200, height: 900 })
  try {
    await win.loadURL(`${BASE}/search?qu=${encodeURIComponent(q)}`)
    const past = await waitPastChallenge(win)
    // Distinct from "zero results" — this means offline, Hymnary unreachable,
    // or their challenge changed shape, none of which the operator should
    // read as "no hymn matched your search."
    if (!past) throw new Error('Could not reach Hymnary.org.')
    const raw = (await win.webContents.executeJavaScript(`
      Array.from(document.querySelectorAll('a[href*="/text/"]'))
        .map(a => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim() }))
        .filter(x => x.text)
    `)) as Array<{ href: string; text: string }>

    const seen = new Set<string>()
    const out: HymnaryCandidate[] = []
    for (const { href, text } of raw) {
      const m = /\/text\/([a-z0-9_]+)/i.exec(href)
      if (!m) continue
      const slug = m[1]
      if (seen.has(slug)) continue
      seen.add(slug)
      out.push({ title: text, url: `${BASE}/text/${slug}` })
      if (out.length >= 20) break
    }
    return out
  } catch (e) {
    log.error('searchHymnary failed', e)
    throw e instanceof Error ? e : new Error('Could not reach Hymnary.org.')
  } finally {
    win.destroy()
  }
}

export type HymnaryFetchResult =
  | { ok: true; song: ParsedSong; url: string }
  | { ok: false; reason: 'not-public-domain' | 'not-found' | 'parse-failed'; copyright?: string }

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&#8217;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&hellip;|&#8230;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
}

export function extractCopyright(html: string): string | null {
  const m = /hy_infoLabel">Copyright:<\/span><\/td>\s*<td><span class="hy_infoItem">([^<]*)<\/span>/.exec(html)
  return m ? decodeEntities(m[1]).trim() : null
}

export function extractTitle(html: string): string | null {
  const m = /<meta property="og:title" content="([^"]*)"/.exec(html)
  return m ? decodeEntities(m[1]).trim() : null
}

export function extractAuthor(html: string): string | undefined {
  const m = /<h2 id="Author">Author: <span property="name">([^<]*)<\/span>/.exec(html)
  return m ? decodeEntities(m[1]).trim() : undefined
}

/** Numbered <p> blocks are verses ("1 Amazing grace…"); a block opening
 *  "Refrain:" or "Chorus:" is the chorus; anything else (a hymnal citation
 *  line, a "Source: …" credit) has neither shape and is dropped. A verse
 *  ending in the literal "[Refrain]"/"[Chorus]" Hymnary uses instead of
 *  repeating the words gets the real chorus text appended as its own slide
 *  right after it — a live projection needs the actual words on screen
 *  every time it's sung, not a bracket only a reader would understand. */
export function extractSlides(html: string): ParsedSongSlide[] {
  const start = html.indexOf("id='at_fulltext'")
  if (start === -1) return []
  const sectionEnd = html.indexOf('authority_bottom_bar', start)
  const section = sectionEnd === -1 ? html.slice(start) : html.slice(start, sectionEnd)

  const blocks = [...section.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1])
  const slides: ParsedSongSlide[] = []
  let verseNum = 0
  let lastChorus: ParsedSongSlide | null = null

  for (const raw of blocks) {
    let text = raw.replace(/<br\s*\/?>/gi, '\n')
    text = text.replace(/<[^>]+>/g, '')
    text = decodeEntities(text)
    // Hymnary's own HTML source has a literal \r\n after every <br /> (just
    // formatting for their page source, not part of the lyric) — converting
    // <br /> to \n above left that CRLF immediately behind it, so every line
    // ended up separated by a real blank line once cleanLyricText normalized
    // \r\n to \n. Collapse any run of whitespace spanning a newline down to
    // one \n so lines land tight, same as every other song source.
    text = text.replace(/[ \t]*\r?\n[ \t\r\n]*/g, '\n').trim()
    if (!text) continue

    const refrainMatch = /^(Refrain|Chorus)\s*:?\s*\n?/i.exec(text)
    if (refrainMatch) {
      const body = cleanLyricText(text.slice(refrainMatch[0].length))
      if (!body) continue
      const slide: ParsedSongSlide = { label: 'Chorus', text: body }
      slides.push(slide)
      lastChorus = slide
      continue
    }

    const verseMatch = /^(\d+)\s+/.exec(text)
    if (verseMatch) {
      verseNum = Math.max(verseNum, parseInt(verseMatch[1], 10))
      let body = text.slice(verseMatch[0].length)
      const tag = /\[(Refrain|Chorus)\]\s*$/i.exec(body)
      if (tag) body = body.slice(0, tag.index).trim()
      const cleaned = cleanLyricText(body)
      if (cleaned) slides.push({ label: `Verse ${verseNum}`, text: cleaned })
      if (tag && lastChorus) slides.push({ ...lastChorus })
      continue
    }
    // Neither shape — a citation/source line, not a slide. Drop it.
  }
  return slides
}

/** Fetch and parse one hymn's representative text. The Public Domain check
 *  is a hard gate, not a warning: anything else the Copyright field says
 *  (a named copyright holder, "Used by permission", or the field missing
 *  entirely) refuses the import outright — there is no fallback path that
 *  shows it anyway. */
export async function fetchHymnaryHymn(url: string): Promise<HymnaryFetchResult> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'BORN-app (+https://joshmuepu.com/born)' } })
    if (!res.ok) return { ok: false, reason: 'not-found' }
    const html = await res.text()

    const copyright = extractCopyright(html)
    if (copyright !== 'Public Domain') {
      return { ok: false, reason: 'not-public-domain', copyright: copyright ?? undefined }
    }

    const title = extractTitle(html)
    const author = extractAuthor(html)
    const slides = extractSlides(html)
    const song: ParsedSong = { title: title ?? '', author, slides }
    if (!title || !isUsableSong(song)) return { ok: false, reason: 'parse-failed' }

    return { ok: true, song, url }
  } catch (e) {
    log.error('fetchHymnaryHymn failed', e)
    return { ok: false, reason: 'not-found' }
  }
}
