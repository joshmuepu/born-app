import { describe, it, expect } from 'vitest'
import { parseReference, isRefError } from '../../shared/bibleRef'
import { BIBLE_BOOKS, findBook } from '../../shared/bibleBooks'

describe('BIBLE_BOOKS data integrity', () => {
  it('has exactly the 66-book Protestant canon, numbered 1..66 in order', () => {
    expect(BIBLE_BOOKS).toHaveLength(66)
    BIBLE_BOOKS.forEach((b, i) => expect(b.num).toBe(i + 1))
  })

  it('has no key collisions between books — every name, abbrev, and alias is unique', () => {
    // A data audit found "hb" registered as an alias for both Habakkuk and
    // Hebrews: whichever book is added later in the array silently wins the
    // shared lookup map, making the other book's "hb" permanently dead —
    // typing it would send the operator to the wrong book live, with no
    // error to reveal it. This guards against that recurring for any key.
    const owners = new Map<string, number>()
    for (const b of BIBLE_BOOKS) {
      for (const key of [b.name.toLowerCase(), b.abbrev.toLowerCase(), ...b.aliases]) {
        const existing = owners.get(key)
        if (existing !== undefined && existing !== b.num) {
          throw new Error(
            `Key "${key}" is claimed by both book ${existing} and book ${b.num} (${b.name}) — one is unreachable.`
          )
        }
        owners.set(key, b.num)
      }
    }
  })
})

describe('parseReference resolves every book by every registered name', () => {
  for (const book of BIBLE_BOOKS) {
    it(`"${book.name}", "${book.abbrev}", and every alias -> book ${book.num}`, () => {
      for (const form of [book.name, book.abbrev, ...book.aliases]) {
        const r = parseReference(`${form} 1:1`)
        expect(isRefError(r), `"${form} 1:1" should parse`).toBe(false)
        if (!isRefError(r)) expect(r.bookNum).toBe(book.num)

        // findBook is what both the colon-form and space-form regexes call —
        // exercise it directly too so a future regex-only test gap can't
        // hide a findBook-level break.
        expect(findBook(form)?.num).toBe(book.num)
      }
    })

    it(`"${book.name} 1 1" (space form, no colon) -> book ${book.num}`, () => {
      const r = parseReference(`${book.name} 1 1`)
      expect(isRefError(r)).toBe(false)
      if (!isRefError(r)) expect(r.bookNum).toBe(book.num)
    })

    it(`"${book.name} ${book.chapters}:1" (last chapter) parses without error`, () => {
      const r = parseReference(`${book.name} ${book.chapters}:1`)
      expect(isRefError(r)).toBe(false)
    })
  }
})
