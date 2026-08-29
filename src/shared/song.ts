/**
 * song.ts — the common shape every song-format parser produces.
 */

export interface ParsedSongSlide {
  /** e.g. "Verse 1", "Chorus", "Bridge" — optional. */
  label?: string
  /** Slide lyric text, newline-separated lines. */
  text: string
}

export interface ParsedSong {
  title: string
  author?: string
  songKey?: string
  ccli?: string
  slides: ParsedSongSlide[]
}

/** Normalise whitespace in a lyric block: trim, collapse blank runs, drop trailing spaces. */
export function cleanLyricText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** True when a parsed song has at least one non-empty slide. */
export function isUsableSong(s: ParsedSong): boolean {
  return !!s.title.trim() && s.slides.some((sl) => sl.text.trim().length > 0)
}
