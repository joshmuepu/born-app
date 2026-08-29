/**
 * songParsers — parse a song file of any supported format into a ParsedSong.
 */
import type { ParsedSong } from '../../shared/song'
import { isUsableSong } from '../../shared/song'
import { detectFormat, titleFromFilename, keyFromFilename, type SongFormat } from './detect'
import { parseProPresenter7 } from './proPresenter7'
import { parseOpenLyrics } from './openLyrics'
import { parseOpenSong } from './openSong'
import { parseChordPro } from './chordPro'
import { parsePlainText } from './plainText'

export { detectFormat, titleFromFilename, type SongFormat }

export interface ParseResult {
  song: ParsedSong
  format: SongFormat
}

export function parseSong(filename: string, data: Buffer): ParseResult | { error: string; format?: SongFormat } {
  const head = data.toString('utf8', 0, 4000)
  const format = detectFormat(filename, head)
  const fallback = titleFromFilename(filename)
  const fallbackKey = keyFromFilename(filename)

  let song: ParsedSong
  try {
    switch (format) {
      case 'propresenter7':
        song = parseProPresenter7(data, fallback, fallbackKey)
        break
      case 'openlyrics':
        song = parseOpenLyrics(data.toString('utf8'), fallback)
        break
      case 'opensong':
        song = parseOpenSong(data.toString('utf8'), fallback)
        break
      case 'chordpro':
        song = parseChordPro(data.toString('utf8'), fallback)
        break
      default:
        song = parsePlainText(data.toString('utf8'), fallback)
    }
  } catch (e) {
    return { error: (e as Error).message || 'parse failed', format }
  }

  if (!song.title || song.title === 'Untitled') song.title = fallback
  if (!song.songKey && fallbackKey) song.songKey = fallbackKey
  if (!isUsableSong(song)) return { error: 'no lyrics found', format }
  return { song, format }
}
