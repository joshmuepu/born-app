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
import { extractDocxText } from './docx'
import { extractPdfText } from './pdf'

export { detectFormat, titleFromFilename, type SongFormat }

export interface ParseResult {
  song: ParsedSong
  format: SongFormat
}

/** Formats whose structure was auto-guessed (blank lines, "Chorus:" labels)
 *  rather than read from the file's own explicit markup — these are the
 *  ones that need an operator's eyes on them before they're saved. A
 *  ChordPro/OpenSong/ProPresenter7 file's verse/chorus tags are the file's
 *  own author's word for its structure, not a guess, so those still commit
 *  straight through like they always have. */
export function needsReview(format: SongFormat): boolean {
  return format === 'plaintext' || format === 'docx' || format === 'pdf'
}

/** True for a docx/pdf that decoded fine but had no extractable text — a
 *  scanned/image-only PDF is the main real case. Distinct from a genuine
 *  parse error so the UI can give the one, specific, actionable message
 *  ("looks like a scanned document — try pasting the text instead") rather
 *  than a generic failure. */
export const NO_TEXT_FOUND = 'no-text-found'

export async function parseSong(
  filename: string,
  data: Buffer
): Promise<ParseResult | { error: string; format?: SongFormat }> {
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
      case 'docx': {
        const text = await extractDocxText(data)
        if (!text) return { error: NO_TEXT_FOUND, format }
        song = parsePlainText(text, fallback)
        break
      }
      case 'pdf': {
        const text = await extractPdfText(data)
        if (!text) return { error: NO_TEXT_FOUND, format }
        song = parsePlainText(text, fallback)
        break
      }
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
