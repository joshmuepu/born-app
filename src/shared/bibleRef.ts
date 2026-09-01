/**
 * bibleRef.ts — parse a human Bible reference into structured form, and format
 * one back to canonical text. Pure; shared by main (lookup) and renderer (live
 * validation feedback).
 */
import { findBook, bookByNum } from './bibleBooks'

export interface ParsedRef {
  bookNum: number
  bookName: string
  chapter: number
  /** null = whole chapter. */
  verseStart: number | null
  verseEnd: number | null
}

export interface RefError {
  error: string
}

/** Books with a single chapter — "Jude 3" means Jude 1:3, not chapter 3. */
const SINGLE_CHAPTER = new Set([31, 57, 63, 64, 65]) // Obadiah, Philemon, 2 John, 3 John, Jude

const REF_RE = /^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/

export function parseReference(input: string): ParsedRef | RefError {
  const raw = (input ?? '').trim().replace(/\s+/g, ' ')
  if (!raw) return { error: 'Enter a reference, e.g. John 3:16' }

  const m = raw.match(REF_RE)
  if (!m) {
    // A bare book name ("Malachi", "MAL", "1 John", "Song of Solomon") means
    // the whole of that book's first chapter.
    const bookOnly = findBook(raw)
    if (bookOnly) {
      return {
        bookNum: bookOnly.num,
        bookName: bookOnly.name,
        chapter: 1,
        verseStart: null,
        verseEnd: null
      }
    }
    return { error: `Couldn't read "${input}". Try "John 3:16" or "Psalm 23".` }
  }

  const [, bookRaw, n1, n2, n3] = m
  const book = findBook(bookRaw)
  if (!book) return { error: `Unknown book "${bookRaw.trim()}".` }

  let chapter: number
  let verseStart: number | null
  let verseEnd: number | null

  if (n2 === undefined) {
    // Only one number after the book.
    if (SINGLE_CHAPTER.has(book.num)) {
      chapter = 1
      verseStart = Number(n1)
      verseEnd = verseStart
    } else {
      chapter = Number(n1)
      verseStart = null
      verseEnd = null
    }
  } else {
    chapter = Number(n1)
    verseStart = Number(n2)
    verseEnd = n3 !== undefined ? Number(n3) : verseStart
  }

  if (chapter < 1) return { error: 'Chapter must be 1 or more.' }
  if (verseStart !== null && verseStart < 1) return { error: 'Verse must be 1 or more.' }
  if (verseStart !== null && verseEnd !== null && verseEnd < verseStart) {
    return { error: 'Verse range is backwards.' }
  }

  return {
    bookNum: book.num,
    bookName: book.name,
    chapter,
    verseStart,
    verseEnd
  }
}

export function isRefError(x: ParsedRef | RefError): x is RefError {
  return (x as RefError).error !== undefined
}

/** Canonical display, e.g. "John 3:16", "John 3:16–18", "Psalm 23". */
export function formatReference(ref: ParsedRef): string {
  const name = bookByNum(ref.bookNum)?.name ?? ref.bookName
  if (ref.verseStart === null) return `${name} ${ref.chapter}`
  if (ref.verseEnd === null || ref.verseEnd === ref.verseStart) {
    return `${name} ${ref.chapter}:${ref.verseStart}`
  }
  return `${name} ${ref.chapter}:${ref.verseStart}–${ref.verseEnd}`
}

/** Per-verse citation, e.g. "John 3:17". */
export function formatVerse(bookNum: number, chapter: number, verse: number): string {
  const name = bookByNum(bookNum)?.name ?? ''
  return `${name} ${chapter}:${verse}`
}
