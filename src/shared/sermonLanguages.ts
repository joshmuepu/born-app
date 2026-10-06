/**
 * sermonLanguages.ts — languages table.branham.org actually has sermon TEXT
 * content in, keyed by the ISO 639-1 code its content endpoints (allSermons,
 * sermonRequest) require — e.g. 'fr', not table.branham.org's own 3-letter
 * UI-localization code 'frn' (a separate namespace that endpoint uses for
 * translating the SITE's own interface strings, not for selecting sermon
 * content language; passing one of those 3-letter codes to a content
 * endpoint silently returns zero results).
 *
 * This list was built by empirically probing every ISO 639-1 code against
 * the real allSermons endpoint and keeping only codes that returned at least
 * one sermon — real data, verified against the live source, not guessed or
 * derived from the UI-localization list. Re-run that probe (see the project
 * history for the one-off script) if table.branham.org adds a new
 * translation language and it needs to appear here.
 */

export interface SermonLanguage {
  code: string
  name: string
}

export const SERMON_LANGUAGES: SermonLanguage[] = [
  { code: 'en', name: 'English' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'ak', name: 'Akan' },
  { code: 'am', name: 'Amharic' },
  { code: 'ar', name: 'Arabic' },
  { code: 'bn', name: 'Bengali' },
  { code: 'cs', name: 'Czech' },
  { code: 'de', name: 'German' },
  { code: 'ee', name: 'Ewe' },
  { code: 'es', name: 'Spanish' },
  { code: 'fa', name: 'Persian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ht', name: 'Haitian Creole' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'hy', name: 'Armenian' },
  { code: 'hz', name: 'Herero' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'kj', name: 'Kuanyama' },
  { code: 'km', name: 'Khmer' },
  { code: 'lg', name: 'Ganda' },
  { code: 'ln', name: 'Lingala' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'mg', name: 'Malagasy' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mr', name: 'Marathi' },
  { code: 'my', name: 'Burmese' },
  { code: 'nd', name: 'North Ndebele' },
  { code: 'ne', name: 'Nepali' },
  { code: 'nl', name: 'Dutch' },
  { code: 'no', name: 'Norwegian' },
  { code: 'ny', name: 'Chichewa' },
  { code: 'om', name: 'Oromo' },
  { code: 'or', name: 'Odia' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'rn', name: 'Kirundi' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'rw', name: 'Kinyarwanda' },
  { code: 'sn', name: 'Shona' },
  { code: 'ss', name: 'Swati' },
  { code: 'st', name: 'Southern Sotho' },
  { code: 'sv', name: 'Swedish' },
  { code: 'sw', name: 'Swahili' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'th', name: 'Thai' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'tn', name: 'Tswana' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ts', name: 'Tsonga' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 've', name: 'Venda' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'xh', name: 'Xhosa' },
  { code: 'zh', name: 'Chinese' },
  { code: 'zu', name: 'Zulu' }
]
