export interface Quote {
  text: string
  sermonTitle: string
  dateCode: string
  sermonId: number
  paragraphIndex: number
  paragraphRef: string
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
