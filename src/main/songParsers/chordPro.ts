/**
 * chordPro.ts — parse a ChordPro (.cho/.crd/.chordpro/.pro-text) song.
 * Chords in [brackets] are stripped; {directives} set metadata and sections.
 */
import type { ParsedSong, ParsedSongSlide } from '../../shared/song'
import { cleanLyricText } from '../../shared/song'

const DIRECTIVE_RE = /^\{\s*([a-zA-Z_]+)\s*(?::\s*(.*?))?\s*\}$/

const SECTION_START: Record<string, string> = {
  start_of_verse: 'Verse',
  sov: 'Verse',
  start_of_chorus: 'Chorus',
  soc: 'Chorus',
  start_of_bridge: 'Bridge',
  sob: 'Bridge'
}
const SECTION_END = new Set(['end_of_verse', 'eov', 'end_of_chorus', 'eoc', 'end_of_bridge', 'eob'])

export function parseChordPro(content: string, fallbackTitle = 'Untitled'): ParsedSong {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const song: ParsedSong = { title: fallbackTitle, slides: [] }

  let curLabel: string | undefined
  let buf: string[] = []

  const flush = (): void => {
    const text = cleanLyricText(buf.join('\n'))
    if (text) song.slides.push({ label: curLabel, text })
    buf = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const dir = DIRECTIVE_RE.exec(line)
    if (dir) {
      const name = dir[1].toLowerCase()
      const val = (dir[2] ?? '').trim()
      if (name === 'title' || name === 't') song.title = val || song.title
      else if (name === 'subtitle' || name === 'st' || name === 'artist' || name === 'composer')
        song.author = song.author || val
      else if (name === 'key') song.songKey = val
      else if (name === 'ccli') song.ccli = val
      else if (name === 'comment' || name === 'c' || name === 'comment_italic') {
        flush()
        curLabel = val || curLabel
      } else if (SECTION_START[name] !== undefined) {
        flush()
        curLabel = val || SECTION_START[name]
      } else if (SECTION_END.has(name)) {
        flush()
        curLabel = undefined
      }
      continue
    }
    if (line === '') {
      flush()
      continue
    }
    // strip [chords], keep lyrics
    buf.push(rawLine.replace(/\[[^\]]*\]/g, ''))
  }
  flush()

  return song
}
