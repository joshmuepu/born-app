/**
 * hymnary.ts — search Hymnary.org for a title and pull in its representative
 * text as a BORN song, but only when the text is explicitly marked Public
 * Domain. Scoped to this one source deliberately (see the design proposal):
 * a general web search can't be trusted to gate copyright correctly, and
 * this is the one source with a real per-hymn editorial determination that's
 * actually checkable in code.
 *
 * Hymnary.org's /search page, AND — as of a live investigation into reports
 * that some search hits wouldn't import — individual /text/<slug> pages too,
 * now sit behind a JS proof-of-work bot challenge ("Bunny Shield") that a
 * plain fetch can't pass. That's a change from when this file was first
 * written (the challenge used to be search-only); confirmed by hand by
 * fetching real hymn pages directly and getting the challenge page back
 * instead of the hymn. A hidden BrowserWindow solves it the same way a real
 * visitor's browser would (it *is* real Chromium) — used for every request
 * to hymnary.org now, not just search.
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

/** Loads `url` in a hidden window, waits past the bot challenge if one
 *  shows up, then hands the window (plus the main-frame HTTP status, for
 *  telling a real 404 apart from everything else) to `fn`. Always destroys
 *  the window afterward, success or failure. */
async function withChallengeWindow<T>(
  url: string,
  fn: (win: BrowserWindow, statusCode: number) => Promise<T>
): Promise<T> {
  const win = new BrowserWindow({ show: false, width: 1200, height: 900 })
  let statusCode = 200
  win.webContents.on('did-navigate', (_e, _navUrl, code) => {
    statusCode = code
  })
  try {
    // A non-2xx response still "loads" a page as far as Electron's concerned
    // (did-navigate above is what tells us the real status) — loadURL only
    // rejects on a network-level failure (offline, DNS, etc.).
    await win.loadURL(url).catch(() => {})
    const past = await waitPastChallenge(win)
    if (!past) throw new Error('blocked')
    return await fn(win, statusCode)
  } finally {
    win.destroy()
  }
}

export async function searchHymnary(query: string): Promise<HymnaryCandidate[]> {
  const q = query.trim()
  if (!q) return []
  try {
    return await withChallengeWindow(`${BASE}/search?qu=${encodeURIComponent(q)}`, async (win) => {
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
    })
  } catch (e) {
    // Distinct from "zero results" — this means offline, Hymnary unreachable,
    // or their challenge changed shape, none of which the operator should
    // read as "no hymn matched your search."
    log.error('searchHymnary failed', e)
    throw e instanceof Error ? e : new Error('Could not reach Hymnary.org.')
  }
}

export type HymnaryFetchResult =
  | { ok: true; song: ParsedSong; url: string }
  | {
      ok: false
      /** 'blocked': the bot challenge never cleared — a real, honest "try
       *  again in a moment," not the same thing as the hymn not existing.
       *  'not-found': a genuine 404 (or an unrecognizable page). 'no-text-on
       *  -file': the page loaded, confirmed Public Domain, but has no
       *  Representative Text section at all — Hymnary itself has no lyric
       *  text for this particular entry (some are alternate/translated
       *  texts with only metadata), not something a fix here can produce. */
      reason: 'not-public-domain' | 'not-found' | 'blocked' | 'no-text-on-file'
      copyright?: string
    }

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
  // Quote-style agnostic: a raw fetch() response keeps Hymnary's own
  // single-quoted id='at_fulltext' verbatim, but reading the page back out
  // of a live BrowserWindow via document.documentElement.outerHTML — needed
  // now that hymn pages sit behind the same bot challenge search does (see
  // fetchHymnaryHymn) — always re-serializes attributes with double quotes
  // regardless of the source markup. Matching either avoids silently
  // returning zero slides for every hymn once fetched this way.
  const marker = /id=['"]at_fulltext['"]/.exec(html)
  const start = marker ? marker.index : -1
  if (start === -1) return []
  const sectionEnd = html.indexOf('authority_bottom_bar', start)
  const section = sectionEnd === -1 ? html.slice(start) : html.slice(start, sectionEnd)

  // Split on opening <p> tags rather than matching <p>...</p> pairs: the
  // LAST paragraph in this section is sometimes left unclosed in Hymnary's
  // own markup (confirmed on the real "Holy, Holy, Holy" page) — a paired
  // regex either fails to capture it at all, or a non-greedy match runs past
  // it looking for the next </p> anywhere later in the section, silently
  // swallowing unrelated content. Splitting on start tags and trimming each
  // chunk at its own </p> (if it has one) handles a closed or unclosed final
  // paragraph the same way.
  const blocks = section
    .split(/<p[^>]*>/)
    .slice(1)
    .map((chunk) => chunk.replace(/<\/p>[\s\S]*$/, ''))
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

    // Hymnary's own verse numbering isn't consistent across the source
    // hymnals its texts come from: "1 Amazing grace…" (digit, space) on some,
    // "1. Be thou my vision…" (digit, PERIOD, space) on others — confirmed
    // directly on real pages for "Be Thou My Vision" and "Holy, Holy, Holy"
    // (both sourced from Hymns and Devotions for Daily Worship), both of
    // which lost every verse to the old digit-then-space-only regex here.
    const verseMatch = /^(\d+)[.:]?\s+/.exec(text)
    if (verseMatch) {
      verseNum = Math.max(verseNum, parseInt(verseMatch[1], 10))
      let body = text.slice(verseMatch[0].length)
      const tag = /\[(Refrain|Chorus)\]\s*$/i.exec(body)
      if (tag) body = body.slice(0, tag.index).trim()
      // The hymnal citation ("Source: Hymns and Devotions for Daily Worship
      // #184a") isn't always its own <p> the way "Ancient & Modern, 2013" is
      // — on some pages (confirmed on "Holy, Holy, Holy") it's fused onto the
      // end of the LAST verse's own paragraph with no tag between them, so it
      // has to be stripped here too, or it ends up as visible text on the
      // last slide of the song.
      body = body.replace(/\n?Source:\s*.*$/is, '').trim()
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
    return await withChallengeWindow(url, async (win, statusCode) => {
      if (statusCode === 404) return { ok: false, reason: 'not-found' } as const
      const html: string = await win.webContents.executeJavaScript('document.documentElement.outerHTML')

      const copyright = extractCopyright(html)
      if (copyright !== 'Public Domain') {
        return { ok: false, reason: 'not-public-domain', copyright: copyright ?? undefined } as const
      }

      const title = extractTitle(html)
      if (!title) return { ok: false, reason: 'not-found' } as const
      const author = extractAuthor(html)
      const slides = extractSlides(html)
      const song: ParsedSong = { title, author, slides }
      if (!isUsableSong(song)) return { ok: false, reason: 'no-text-on-file' } as const

      return { ok: true, song, url } as const
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'blocked') return { ok: false, reason: 'blocked' }
    log.error('fetchHymnaryHymn failed', e)
    return { ok: false, reason: 'not-found' }
  }
}
