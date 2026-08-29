/**
 * openLyrics.ts — parse the OpenLyrics XML format (used by OpenLP and others).
 * http://openlyrics.org/  — <br/> matters for line breaks, so verses are pulled
 * from the raw XML; fast-xml-parser is only used for the <properties> block.
 */
import { XMLParser } from 'fast-xml-parser'
import type { ParsedSong, ParsedSongSlide } from '../../shared/song'
import { cleanLyricText } from '../../shared/song'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false // keep "22025" a string, not a number
})

const VERSE_LABELS: Record<string, string> = {
  v: 'Verse', c: 'Chorus', b: 'Bridge', p: 'Pre-Chorus', e: 'Ending', o: 'Outro', i: 'Intro'
}

function verseLabel(name: string | undefined): string | undefined {
  if (!name) return undefined
  const m = /^([a-z]+)(\d+)?/i.exec(name.trim())
  if (!m) return name
  const base = VERSE_LABELS[m[1].toLowerCase()] ?? m[1]
  return m[2] ? `${base} ${m[2]}` : base
}

function firstString(x: unknown): string | undefined {
  if (typeof x === 'number') return String(x)
  if (typeof x === 'string') return x || undefined
  if (Array.isArray(x)) {
    for (const e of x) {
      const s = firstString(e)
      if (s) return s
    }
    return undefined
  }
  if (x && typeof x === 'object') return firstString((x as Record<string, unknown>)['#text'])
  return undefined
}

function joinStrings(x: unknown): string {
  if (typeof x === 'string') return x
  if (Array.isArray(x)) return x.map(joinStrings).filter(Boolean).join(', ')
  if (x && typeof x === 'object') return joinStrings((x as Record<string, unknown>)['#text'])
  return ''
}

export function parseOpenLyrics(xml: string, fallbackTitle = 'Untitled'): ParsedSong {
  let title = fallbackTitle
  let author: string | undefined
  let songKey: string | undefined
  let ccli: string | undefined

  try {
    const doc = parser.parse(xml) as Record<string, Record<string, unknown>>
    const props = (doc.song?.properties ?? {}) as Record<string, unknown>
    title = firstString((props.titles as Record<string, unknown>)?.title) ?? fallbackTitle
    author = joinStrings((props.authors as Record<string, unknown>)?.author) || undefined
    songKey = firstString(props.key)
    ccli = firstString(props.ccliNo) ?? firstString(props.ccliNumber)
  } catch {
    /* fall through with defaults */
  }

  const slides: ParsedSongSlide[] = []
  const verseRe = /<verse\b[^>]*?\bname="([^"]*)"[^>]*>([\s\S]*?)<\/verse>/gi
  let m: RegExpExecArray | null
  while ((m = verseRe.exec(xml))) {
    const label = verseLabel(m[1])
    const linesRe = /<lines\b[^>]*>([\s\S]*?)<\/lines>/gi
    const parts: string[] = []
    let lm: RegExpExecArray | null
    while ((lm = linesRe.exec(m[2]))) {
      parts.push(
        lm[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/?(chord|tag|comment)\b[^>]*>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;|&apos;/g, "'")
      )
    }
    const text = cleanLyricText(parts.join('\n'))
    if (text) slides.push({ label, text })
  }

  return { title, author, songKey, ccli, slides }
}
