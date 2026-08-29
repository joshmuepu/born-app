/**
 * plainText.ts — parse a blank-line-separated lyrics .txt file.
 * A lone first line is treated as the title. A block whose first line is a
 * section name ("Verse 1", "Chorus", "[Bridge]") uses that as the slide label.
 */
import type { ParsedSong, ParsedSongSlide } from '../../shared/song'
import { cleanLyricText } from '../../shared/song'

const LABEL_RE =
  /^\[?\s*(verse|chorus|bridge|pre[- ]?chorus|intro|outro|tag|ending|refrain|interlude|vamp)\s*(\d+)?\s*\]?\s*:?\s*$/i

function normLabel(raw: string): string {
  const m = LABEL_RE.exec(raw.trim())
  if (!m) return raw.trim()
  const word = m[1].replace(/[- ]/g, '').toLowerCase()
  const nice = word.charAt(0).toUpperCase() + word.slice(1)
  return m[2] ? `${nice} ${m[2]}` : nice
}

export function parsePlainText(content: string, fallbackTitle = 'Untitled'): ParsedSong {
  const text = content.replace(/\r\n?/g, '\n').trim()
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  if (blocks.length === 0) return { title: fallbackTitle, slides: [] }

  let title = fallbackTitle
  let start = 0
  const firstLines = blocks[0].split('\n')
  if (firstLines.length === 1 && !LABEL_RE.test(firstLines[0]) && firstLines[0].length <= 80) {
    title = firstLines[0].trim()
    start = 1
  }

  const slides: ParsedSongSlide[] = []
  let pendingLabel: string | undefined
  for (let i = start; i < blocks.length; i++) {
    const lines = blocks[i].split('\n')
    let label = pendingLabel
    pendingLabel = undefined
    let body = lines
    if (LABEL_RE.test(lines[0])) {
      label = normLabel(lines[0])
      body = lines.slice(1)
    }
    const bodyText = cleanLyricText(body.join('\n'))
    if (!bodyText) {
      pendingLabel = label
      continue
    }
    slides.push({ label, text: bodyText })
  }

  return { title, slides }
}
