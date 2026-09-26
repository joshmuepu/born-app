export type {
  Quote,
  Slide,
  QueueItem,
  QuoteItem,
  BibleItem,
  SongItem
} from '../../shared/queueItem'

import type { ParsedSong } from '../../shared/song'
export type { ParsedSong, ParsedSongSlide } from '../../shared/song'

export interface DisplayEntry {
  id: number
  label: string
  shortLabel: string
  name: string | null
  isPrimary: boolean
  isInternal: boolean
}

export interface NamedDisplayStatus {
  name: string
  connected: boolean
}

export interface DisplayInfo {
  displays: DisplayEntry[]
  namedDisplays: NamedDisplayStatus[]
  targetId: number
  targetName: string | null
  isFallback: boolean
  isOverride: boolean
  missingOverrideName: string | null
  hasExternal: boolean
  stageTargetId: number | null
  stageTargetName: string | null
  stageIsWindowed: boolean
  stageIsOverride: boolean
  stageMissingOverrideName: string | null
  stageClashesProjection: boolean
}

export interface RecentService {
  path: string
  name: string
  mtimeMs: number
}

/** One slide as pushed to the projection / stage windows. */
export interface SlidePayload {
  kind: 'quote' | 'bible' | 'song'
  text: string
  label?: string
  reference?: string
  marker?: string
}

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
  slides: SlidePayload[]
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

export type AdjacentVerse = BibleSearchHit

export type BibleSearchMode = 'phrase' | 'all' | 'any'

export interface BibleSearchRange {
  bookFrom: number
  bookTo: number
}

export interface SongSummary {
  id: number
  title: string
  author: string | null
  songKey: string | null
  slideCount: number
  source: string
  /** Set on a search hit: false means the query matched only the lyrics,
   *  not the title, so the UI shows the matching slide below. */
  matchedInTitle?: boolean
  matchSlide?: { label: string | null; text: string }
}

export interface SongDetail {
  id: number
  title: string
  author: string | null
  songKey: string | null
  source: string
  /** Set only for a song imported from an online source — shown as a small
   *  provenance line so "are we allowed to use this" has a visible answer,
   *  not just a value sitting in the database. */
  provenance: { label: string; url?: string } | null
  slides: Array<{ label: string | null; text: string }>
}

export interface OnlineCandidate {
  title: string
  url: string
  source: 'hymnary' | 'cyberhymnal'
}

export type OnlinePreview =
  | {
      ok: true
      song: ParsedSong
      url: string
      source: 'hymnary' | 'cyberhymnal'
      provenanceLabel: string
      /** Only ever true for a Cyber Hymnal result — see cyberHymnal.ts. */
      needsConfirmation: boolean
      confirmationNote?: string
    }
  | { ok: false; reason: string; copyright?: string }

export type OnlineImportResult =
  | { ok: true; id: number; title: string; alreadyImported: boolean }
  | { ok: false; reason: string; copyright?: string }

/** A file whose structure was auto-guessed (plain text, docx, pdf) — parsed
 *  but not yet written, waiting on the operator's review. */
export interface ReviewItem {
  originPath: string
  displayName: string
  song: ParsedSong
}

export interface SongImportResult {
  added: Array<{ id: number; title: string }>
  failed: Array<{ file: string; error: string }>
  skipped: number
  needsReview: ReviewItem[]
}

export interface IndexerProgress {
  status: 'idle' | 'running' | 'done'
  scanned: number
  total: number
  indexed: number
  errors: number
}

// Sermon entry from sermon_index (lightweight metadata, no full text)
export interface SermonIndexItem {
  id: number
  date_code: string
  title: string
  para_count: number
  duration_min: number
  is_book: number
}

export interface SeriesEntry {
  i: number
  n: string
  s: number[]
}

export interface StateEntry {
  i: number
  n: string
  c: number[]
}

export interface CityEntry {
  i: number
  n: string
}

export interface DateGroup {
  label: string
  sermonIds: number[]
}

// Calendar drill-down for Browse → Date (built in main from sermon_index.date_code)
export interface DateTreeDay {
  day: number
  ids: number[]
}
export interface DateTreeMonth {
  month: number
  count: number
  days: DateTreeDay[]
  unknownDayIds: number[]
}
export interface DateTreeYear {
  year: number
  count: number
  months: DateTreeMonth[]
  unknownMonthIds: number[]
}
export interface DateTree {
  years: DateTreeYear[]
  undatedIds: number[]
}

export interface LocationState {
  id: number
  name: string
  cities: Array<{ id: number; name: string; sermonIds: number[] }>
}

export interface DurationGroup {
  label: string
  sermonIds: number[]
}

export interface SubtitleEntry {
  paragraphRef: string
  subtitle: string
}
