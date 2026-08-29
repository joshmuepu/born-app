/**
 * openSong.ts — parse the OpenSong XML format.
 * <lyrics> is a text block: [V1]/[C]/[B] section markers, lyric lines prefixed
 * with a space, chord lines prefixed with '.', comments with ';'.
 */
import { XMLParser } from 'fast-xml-parser'
import type { ParsedSong, ParsedSongSlide } from '../../shared/song'
import { cleanLyricText } from '../../shared/song'

const parser = new XMLParser({ ignoreAttributes: true, trimValues: false })

const SECTION_RE = /^\[([^\]]+)\]\s*$/

function sectionLabel(raw: string): string {
  const t = raw.trim()
  const m = /^([a-zA-Z]+)\s*(\d+)?$/.exec(t)
  if (!m) return t
  const map: Record<string, string> = {
    v: 'Verse', c: 'Chorus', b: 'Bridge', p: 'Pre-Chorus', t: 'Tag', e: 'Ending'
  }
  const base = map[m[1].toLowerCase()] ?? m[1]
  return m[2] ? `${base} ${m[2]}` : base
}

export function parseOpenSong(xml: string, fallbackTitle = 'Untitled'): ParsedSong {
  let doc: Record<string, Record<string, unknown>>
  try {
    doc = parser.parse(xml) as Record<string, Record<string, unknown>>
  } catch {
    return { title: fallbackTitle, slides: [] }
  }
  const song = doc.song ?? {}
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

  const title = str(song.title) || fallbackTitle
  const author = str(song.author) || undefined
  const songKey = str(song.key) || undefined
  const ccli = str(song.ccli) || str(song.copyright) || undefined
  const lyrics = str(song.lyrics)

  const slides: ParsedSongSlide[] = []
  let label: string | undefined
  let buf: string[] = []
  const flush = (): void => {
    const text = cleanLyricText(buf.join('\n'))
    if (text) slides.push({ label, text })
    buf = []
  }

  for (const rawLine of lyrics.split(/\r?\n/)) {
    const sec = SECTION_RE.exec(rawLine.trim())
    if (sec) {
      flush()
      label = sectionLabel(sec[1])
      continue
    }
    const line = rawLine
    if (line.startsWith('.') || line.startsWith(';') || line.startsWith('#')) continue // chords/comments
    if (line.trim() === '' && buf.length === 0) continue
    if (line.trim() === '' && buf.length > 0) {
      // blank line within a section — keep as a stanza break
      buf.push('')
      continue
    }
    buf.push(line.replace(/^ /, '').replace(/\s*\|\s*/g, ' ')) // strip leading space + column bars
  }
  flush()

  return { title, author, songKey, ccli, slides }
}
