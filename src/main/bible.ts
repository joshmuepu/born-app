/**
 * bible.ts — Bible lookup + search against library.db.
 */
import { getLibraryDb } from './libraryDb'
import { log } from './logger'
import { parseReference, isRefError, formatReference, formatVerse } from '../shared/bibleRef'
import { buildBibleSlides } from '../shared/bibleSlides'
import { stripMarginalNotes } from '../shared/bibleText'
import type { Slide } from '../shared/queueItem'

export interface BibleTranslation {
  code: string
  name: string
}

export interface ResolvedPassage {
  reference: string
  translation: string
  bookNum: number
  chapter: number
  verseStart: number
  verseEnd: number
  verses: Array<{ verse: number; text: string }>
  slides: Slide[]
  /** slideStarts[i] = index into `slides` where verses[i] begins. */
  slideStarts: number[]
}

export interface BibleSearchHit {
  reference: string
  translation: string
  bookNum: number
  chapter: number
  verse: number
  text: string
}

export function getBibleTranslations(): BibleTranslation[] {
  try {
    const db = getLibraryDb()
    return db
      .prepare<[], { code: string; name: string }>(
        'SELECT code, name FROM bible_translations ORDER BY sort_order, code'
      )
      .all()
  } catch (e) {
    log.error('getBibleTranslations error', e)
    return []
  }
}

export function lookupPassage(
  reference: string,
  translation: string
): ResolvedPassage | { error: string } {
  const parsed = parseReference(reference)
  if (isRefError(parsed)) return parsed

  try {
    const db = getLibraryDb()
    const trans =
      db
        .prepare<[string], { code: string }>('SELECT code FROM bible_translations WHERE code = ?')
        .get(translation)?.code ?? 'KJV'

    let rows: Array<{ verse: number; text: string }>
    if (parsed.verseStart === null) {
      rows = db
        .prepare<[string, number, number], { verse: number; text: string }>(
          'SELECT verse, text FROM bible_verses WHERE translation = ? AND book = ? AND chapter = ? ORDER BY verse'
        )
        .all(trans, parsed.bookNum, parsed.chapter)
    } else {
      rows = db
        .prepare<[string, number, number, number, number], { verse: number; text: string }>(
          `SELECT verse, text FROM bible_verses
           WHERE translation = ? AND book = ? AND chapter = ? AND verse BETWEEN ? AND ?
           ORDER BY verse`
        )
        .all(trans, parsed.bookNum, parsed.chapter, parsed.verseStart, parsed.verseEnd ?? parsed.verseStart)
    }

    if (rows.length === 0) {
      return { error: `${formatReference(parsed)} not found in ${trans}.` }
    }

    rows = rows.map((r) => ({ verse: r.verse, text: stripMarginalNotes(r.text) }))
    const built = buildBibleSlides(parsed.bookNum, parsed.chapter, trans, rows)
    return {
      reference: formatReference(parsed),
      translation: trans,
      bookNum: parsed.bookNum,
      chapter: parsed.chapter,
      verseStart: rows[0].verse,
      verseEnd: rows[rows.length - 1].verse,
      verses: rows,
      slides: built.slides,
      slideStarts: built.slideStarts
    }
  } catch (e) {
    log.error('lookupPassage error', e)
    return { error: 'Lookup failed.' }
  }
}

export interface AdjacentVerse {
  reference: string
  translation: string
  bookNum: number
  chapter: number
  verse: number
  text: string
}

/**
 * The verse immediately before/after a given one, rolling across chapter and
 * book boundaries. Returns null at the very start/end of the Bible. Used when
 * the operator keeps pressing Next past the end of a queued passage.
 */
export function getAdjacentVerse(
  translation: string,
  bookNum: number,
  chapter: number,
  verse: number,
  direction: 'next' | 'prev'
): AdjacentVerse | null {
  try {
    const db = getLibraryDb()
    const trans =
      db
        .prepare<[string], { code: string }>('SELECT code FROM bible_translations WHERE code = ?')
        .get(translation)?.code ?? 'KJV'
    const cmp = direction === 'next' ? '>' : '<'
    const order = direction === 'next' ? 'ASC' : 'DESC'
    const row = db
      .prepare<
        [string, number, number, number, number, number],
        { book: number; chapter: number; verse: number; text: string }
      >(
        `SELECT book, chapter, verse, text FROM bible_verses
         WHERE translation = ?
           AND ( book ${cmp} ?
              OR (book = ? AND (chapter ${cmp} ?
              OR (chapter = ? AND verse ${cmp} ?))) )
         ORDER BY book ${order}, chapter ${order}, verse ${order}
         LIMIT 1`
      )
      .get(trans, bookNum, bookNum, chapter, chapter, verse)
    if (!row) return null
    return {
      reference: formatVerse(row.book, row.chapter, row.verse),
      translation: trans,
      bookNum: row.book,
      chapter: row.chapter,
      verse: row.verse,
      text: stripMarginalNotes(row.text)
    }
  } catch (e) {
    log.error('getAdjacentVerse error', e)
    return null
  }
}

export function searchBible(query: string, translation: string, limit = 50): BibleSearchHit[] {
  const q = (query ?? '').trim()
  if (q.length < 2) return []
  try {
    const db = getLibraryDb()
    const trans =
      db
        .prepare<[string], { code: string }>('SELECT code FROM bible_translations WHERE code = ?')
        .get(translation)?.code ?? 'KJV'
    const phrase = '"' + q.replace(/"/g, '""') + '"'
    const rows = db
      .prepare<
        [string, string, number],
        { book: number; chapter: number; verse: number; text: string }
      >(
        `SELECT v.book, v.chapter, v.verse, v.text
         FROM bible_verses_fts f
         JOIN bible_verses v ON v.id = f.rowid
         WHERE bible_verses_fts MATCH ? AND v.translation = ?
         ORDER BY rank LIMIT ?`
      )
      .all(phrase, trans, limit)
    return rows.map((r) => ({
      reference: formatVerse(r.book, r.chapter, r.verse),
      translation: trans,
      bookNum: r.book,
      chapter: r.chapter,
      verse: r.verse,
      text: stripMarginalNotes(r.text)
    }))
  } catch (e) {
    log.error('searchBible error', e)
    return []
  }
}
