/**
 * bibleBooks.ts — the 66-book Protestant canon with common abbreviations.
 * Book numbers are 1 (Genesis) … 66 (Revelation).
 */

export interface BibleBook {
  num: number
  name: string
  /** Preferred short form. */
  abbrev: string
  /** All accepted spellings/abbreviations, lowercased, no trailing dot. */
  aliases: string[]
}

export const BIBLE_BOOKS: BibleBook[] = [
  { num: 1, name: 'Genesis', abbrev: 'Gen', aliases: ['gen', 'ge', 'gn'] },
  { num: 2, name: 'Exodus', abbrev: 'Exod', aliases: ['exod', 'exo', 'ex'] },
  { num: 3, name: 'Leviticus', abbrev: 'Lev', aliases: ['lev', 'le', 'lv'] },
  { num: 4, name: 'Numbers', abbrev: 'Num', aliases: ['num', 'nu', 'nm', 'nb'] },
  { num: 5, name: 'Deuteronomy', abbrev: 'Deut', aliases: ['deut', 'deu', 'dt'] },
  { num: 6, name: 'Joshua', abbrev: 'Josh', aliases: ['josh', 'jos', 'jsh'] },
  { num: 7, name: 'Judges', abbrev: 'Judg', aliases: ['judg', 'jdg', 'jg', 'jdgs'] },
  { num: 8, name: 'Ruth', abbrev: 'Ruth', aliases: ['ruth', 'rth', 'ru'] },
  { num: 9, name: '1 Samuel', abbrev: '1 Sam', aliases: ['1 sam', '1sam', '1 sa', '1sa', '1 s', 'i sam', 'first samuel'] },
  { num: 10, name: '2 Samuel', abbrev: '2 Sam', aliases: ['2 sam', '2sam', '2 sa', '2sa', '2 s', 'ii sam', 'second samuel'] },
  { num: 11, name: '1 Kings', abbrev: '1 Kgs', aliases: ['1 kgs', '1kgs', '1 ki', '1ki', '1 kings', '1kings', 'i kings', 'first kings'] },
  { num: 12, name: '2 Kings', abbrev: '2 Kgs', aliases: ['2 kgs', '2kgs', '2 ki', '2ki', '2 kings', '2kings', 'ii kings', 'second kings'] },
  { num: 13, name: '1 Chronicles', abbrev: '1 Chr', aliases: ['1 chr', '1chr', '1 ch', '1ch', '1 chron', 'i chronicles', 'first chronicles'] },
  { num: 14, name: '2 Chronicles', abbrev: '2 Chr', aliases: ['2 chr', '2chr', '2 ch', '2ch', '2 chron', 'ii chronicles', 'second chronicles'] },
  { num: 15, name: 'Ezra', abbrev: 'Ezra', aliases: ['ezra', 'ezr', 'ez'] },
  { num: 16, name: 'Nehemiah', abbrev: 'Neh', aliases: ['neh', 'ne'] },
  { num: 17, name: 'Esther', abbrev: 'Esth', aliases: ['esth', 'est', 'es'] },
  { num: 18, name: 'Job', abbrev: 'Job', aliases: ['job', 'jb'] },
  { num: 19, name: 'Psalms', abbrev: 'Ps', aliases: ['ps', 'psa', 'psalm', 'psalms', 'psm', 'pss'] },
  { num: 20, name: 'Proverbs', abbrev: 'Prov', aliases: ['prov', 'pro', 'prv', 'pr'] },
  { num: 21, name: 'Ecclesiastes', abbrev: 'Eccl', aliases: ['eccl', 'ecc', 'ec', 'qoh'] },
  { num: 22, name: 'Song of Solomon', abbrev: 'Song', aliases: ['song', 'song of solomon', 'song of songs', 'sos', 'canticles', 'cant'] },
  { num: 23, name: 'Isaiah', abbrev: 'Isa', aliases: ['isa', 'is'] },
  { num: 24, name: 'Jeremiah', abbrev: 'Jer', aliases: ['jer', 'je', 'jr'] },
  { num: 25, name: 'Lamentations', abbrev: 'Lam', aliases: ['lam', 'la'] },
  { num: 26, name: 'Ezekiel', abbrev: 'Ezek', aliases: ['ezek', 'eze', 'ezk'] },
  { num: 27, name: 'Daniel', abbrev: 'Dan', aliases: ['dan', 'da', 'dn'] },
  { num: 28, name: 'Hosea', abbrev: 'Hos', aliases: ['hos', 'ho'] },
  { num: 29, name: 'Joel', abbrev: 'Joel', aliases: ['joel', 'joe', 'jl'] },
  { num: 30, name: 'Amos', abbrev: 'Amos', aliases: ['amos', 'am'] },
  { num: 31, name: 'Obadiah', abbrev: 'Obad', aliases: ['obad', 'oba', 'ob'] },
  { num: 32, name: 'Jonah', abbrev: 'Jonah', aliases: ['jonah', 'jon', 'jnh'] },
  { num: 33, name: 'Micah', abbrev: 'Mic', aliases: ['mic', 'mc'] },
  { num: 34, name: 'Nahum', abbrev: 'Nah', aliases: ['nah', 'na'] },
  { num: 35, name: 'Habakkuk', abbrev: 'Hab', aliases: ['hab', 'hb'] },
  { num: 36, name: 'Zephaniah', abbrev: 'Zeph', aliases: ['zeph', 'zep', 'zp'] },
  { num: 37, name: 'Haggai', abbrev: 'Hag', aliases: ['hag', 'hg'] },
  { num: 38, name: 'Zechariah', abbrev: 'Zech', aliases: ['zech', 'zec', 'zc'] },
  { num: 39, name: 'Malachi', abbrev: 'Mal', aliases: ['mal', 'ml'] },
  { num: 40, name: 'Matthew', abbrev: 'Matt', aliases: ['matt', 'mat', 'mt'] },
  { num: 41, name: 'Mark', abbrev: 'Mark', aliases: ['mark', 'mrk', 'mar', 'mk', 'mr'] },
  { num: 42, name: 'Luke', abbrev: 'Luke', aliases: ['luke', 'luk', 'lk'] },
  { num: 43, name: 'John', abbrev: 'John', aliases: ['john', 'joh', 'jhn', 'jn'] },
  { num: 44, name: 'Acts', abbrev: 'Acts', aliases: ['acts', 'act', 'ac'] },
  { num: 45, name: 'Romans', abbrev: 'Rom', aliases: ['rom', 'ro', 'rm'] },
  { num: 46, name: '1 Corinthians', abbrev: '1 Cor', aliases: ['1 cor', '1cor', '1 co', '1co', 'i corinthians', 'first corinthians'] },
  { num: 47, name: '2 Corinthians', abbrev: '2 Cor', aliases: ['2 cor', '2cor', '2 co', '2co', 'ii corinthians', 'second corinthians'] },
  { num: 48, name: 'Galatians', abbrev: 'Gal', aliases: ['gal', 'ga'] },
  { num: 49, name: 'Ephesians', abbrev: 'Eph', aliases: ['eph', 'ephes'] },
  { num: 50, name: 'Philippians', abbrev: 'Phil', aliases: ['phil', 'php', 'pp'] },
  { num: 51, name: 'Colossians', abbrev: 'Col', aliases: ['col', 'co'] },
  { num: 52, name: '1 Thessalonians', abbrev: '1 Thess', aliases: ['1 thess', '1thess', '1 thes', '1 th', '1th', 'i thessalonians', 'first thessalonians'] },
  { num: 53, name: '2 Thessalonians', abbrev: '2 Thess', aliases: ['2 thess', '2thess', '2 thes', '2 th', '2th', 'ii thessalonians', 'second thessalonians'] },
  { num: 54, name: '1 Timothy', abbrev: '1 Tim', aliases: ['1 tim', '1tim', '1 ti', '1ti', 'i timothy', 'first timothy'] },
  { num: 55, name: '2 Timothy', abbrev: '2 Tim', aliases: ['2 tim', '2tim', '2 ti', '2ti', 'ii timothy', 'second timothy'] },
  { num: 56, name: 'Titus', abbrev: 'Titus', aliases: ['titus', 'tit', 'ti'] },
  { num: 57, name: 'Philemon', abbrev: 'Phlm', aliases: ['phlm', 'phm', 'pm', 'philem'] },
  { num: 58, name: 'Hebrews', abbrev: 'Heb', aliases: ['heb', 'hb'] },
  { num: 59, name: 'James', abbrev: 'Jas', aliases: ['jas', 'jm', 'jas', 'james'] },
  { num: 60, name: '1 Peter', abbrev: '1 Pet', aliases: ['1 pet', '1pet', '1 pe', '1pe', '1 pt', 'i peter', 'first peter'] },
  { num: 61, name: '2 Peter', abbrev: '2 Pet', aliases: ['2 pet', '2pet', '2 pe', '2pe', '2 pt', 'ii peter', 'second peter'] },
  { num: 62, name: '1 John', abbrev: '1 John', aliases: ['1 john', '1john', '1 jn', '1jn', '1 jo', 'i john', 'first john'] },
  { num: 63, name: '2 John', abbrev: '2 John', aliases: ['2 john', '2john', '2 jn', '2jn', '2 jo', 'ii john', 'second john'] },
  { num: 64, name: '3 John', abbrev: '3 John', aliases: ['3 john', '3john', '3 jn', '3jn', '3 jo', 'iii john', 'third john'] },
  { num: 65, name: 'Jude', abbrev: 'Jude', aliases: ['jude', 'jud', 'jd'] },
  { num: 66, name: 'Revelation', abbrev: 'Rev', aliases: ['rev', 're', 'the revelation', 'apocalypse', 'apoc'] }
]

/** alias / lowercased-name → book. Built once. */
const LOOKUP = new Map<string, BibleBook>()
for (const b of BIBLE_BOOKS) {
  LOOKUP.set(b.name.toLowerCase(), b)
  LOOKUP.set(b.abbrev.toLowerCase(), b)
  for (const a of b.aliases) LOOKUP.set(a, b)
}

export function findBook(nameRaw: string): BibleBook | null {
  let key = nameRaw.trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ')
  // Normalise ordinal prefixes: "II Tim" / "second timothy" → "2 tim" / "2 timothy".
  key = key
    .replace(/^(iii)\s+/, '3 ')
    .replace(/^(ii)\s+/, '2 ')
    .replace(/^(i)\s+/, '1 ')
    .replace(/^first\s+/, '1 ')
    .replace(/^second\s+/, '2 ')
    .replace(/^third\s+/, '3 ')
  return LOOKUP.get(key) ?? null
}

export function bookByNum(num: number): BibleBook | null {
  return BIBLE_BOOKS[num - 1] ?? null
}
