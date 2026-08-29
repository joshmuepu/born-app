export type {
  Quote,
  Slide,
  QueueItem,
  QuoteItem,
  BibleItem,
  SongItem
} from '../../shared/queueItem'

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

export interface SongSummary {
  id: number
  title: string
  author: string | null
  songKey: string | null
  slideCount: number
  source: string
}

export interface SongDetail {
  id: number
  title: string
  author: string | null
  songKey: string | null
  source: string
  slides: Array<{ label: string | null; text: string }>
}

export interface SongImportResult {
  added: Array<{ id: number; title: string }>
  failed: Array<{ file: string; error: string }>
  skipped: number
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

export interface DurationGroup {
  label: string
  sermonIds: number[]
}

export interface SubtitleEntry {
  paragraphRef: string
  subtitle: string
}
