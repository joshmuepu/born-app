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

const REF_RE = /^(.+?)\s+(\d+)(?:\s*:\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/
// No colon at all — "john 3 16", how someone might naturally say or type it.
// Requires both a chapter and a verse number so it never fires on a plain
// "book chapter" reference (that's REF_RE's job, with n2 left undefined).
const REF_RE_SPACE_VERSE = /^(.+?)\s+(\d+)\s+(\d+)(?:\s*[-–—]\s*(\d+))?\s*$/

interface BookLike {
  num: number
  name: string
}

function buildRef(book: BookLike, n1: string, n2: string | undefined, n3: string | undefined): ParsedRef | RefError {
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

export function parseReference(input: string): ParsedRef | RefError {
  const raw = (input ?? '').trim().replace(/\s+/g, ' ')
  if (!raw) return { error: 'Enter a reference, e.g. John 3:16' }

  const m = raw.match(REF_RE)
  if (m) {
    const [, bookRaw, n1, n2, n3] = m
    const book = findBook(bookRaw)
    if (book) return buildRef(book, n1, n2, n3)
    // The book portion didn't resolve — REF_RE's lazy match may have folded
    // a bare verse number into what looked like the book name (typing
    // "john 3 16" with no colon parses here as book="john 3", chapter=16).
    // Before giving up, try reading the whole thing as "book chapter verse"
    // with no colon at all.
    const m2 = raw.match(REF_RE_SPACE_VERSE)
    if (m2) {
      const book2 = findBook(m2[1])
      if (book2) return buildRef(book2, m2[2], m2[3], m2[4])
    }
    return { error: `Unknown book "${bookRaw.trim()}".` }
  }

  const m2 = raw.match(REF_RE_SPACE_VERSE)
  if (m2) {
    const book2 = findBook(m2[1])
    if (book2) return buildRef(book2, m2[2], m2[3], m2[4])
  }

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
