/**
 * bibleSlides.ts — turn a resolved passage into projection slides: one slide per
 * verse, with a long verse split into "16a / 16b" pages at a clause boundary so
 * nothing has to be shrunk to an unreadable size on screen.
 */
import type { Slide } from './queueItem'
import { formatVerse } from './bibleRef'

export interface PassageVerse {
  verse: number
  text: string
}

/** Roughly the most text that reads comfortably on a projector at a sane size. */
const MAX_SLIDE_CHARS = 240

function splitLongVerse(text: string): string[] {
  if (text.length <= MAX_SLIDE_CHARS) return [text]
  const pages: string[] = []
  let rest = text.trim()
  while (rest.length > MAX_SLIDE_CHARS) {
    // Prefer a sentence end, then a clause break, then a space — before the cap.
    const window = rest.slice(0, MAX_SLIDE_CHARS)
    const cut =
      lastIndexOfAny(window, ['. ', '? ', '! ', '; ']) ??
      lastIndexOfAny(window, [', ', ': ', '— ', ' — ']) ??
      window.lastIndexOf(' ')
    const at = cut && cut > MAX_SLIDE_CHARS * 0.5 ? cut : MAX_SLIDE_CHARS
    pages.push(rest.slice(0, at + 1).trim())
    rest = rest.slice(at + 1).trim()
  }
  if (rest) pages.push(rest)
  return pages
}

function lastIndexOfAny(s: string, needles: string[]): number | null {
  let best = -1
  for (const n of needles) {
    const i = s.lastIndexOf(n)
    if (i > best) best = i + n.length - 1
  }
  return best >= 0 ? best : null
}

export interface BibleSlideBuild {
  slides: Slide[]
  /** slideStarts[i] = index in `slides` where verses[i] begins. */
  slideStarts: number[]
}

export function buildBibleSlides(
  bookNum: number,
  chapter: number,
  translation: string,
  verses: PassageVerse[]
): BibleSlideBuild {
  const slides: Slide[] = []
  const slideStarts: number[] = []
  for (const v of verses) {
    slideStarts.push(slides.length)
    const pages = splitLongVerse(v.text.trim())
    pages.forEach((page, i) => {
      const suffix = pages.length > 1 ? String.fromCharCode(97 + i) : ''
      slides.push({
        text: page,
        marker: `${v.verse}${suffix}`,
        reference: `${formatVerse(bookNum, chapter, v.verse)}${suffix} · ${translation}`
      })
    })
  }
  return { slides, slideStarts }
}
