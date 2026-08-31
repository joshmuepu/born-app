/**
 * bibleSlides.ts — turn a resolved passage into projection slides: one slide per
 * verse, with a long verse split into "16a / 16b" pages at a clause boundary so
 * nothing has to be shrunk to an unreadable size on screen.
 */
import type { Slide } from './queueItem'
import { formatVerse } from './bibleRef'
import { paginateText } from './paginate'

export interface PassageVerse {
  verse: number
  text: string
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
    const pages = paginateText(v.text.trim())
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
