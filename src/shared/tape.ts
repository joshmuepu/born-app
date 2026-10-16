/** tape.ts — the shapes the Tape service (sermon audio + follow-along) shares between main and renderer. See docs/design/sermon-audio. */

export type TapeFileStorage = 'managed' | 'linked'

/** One audio file BORN knows about (a copy in its own folder, or linked in place). Identity is the SHA-256 of the bytes. */
export interface TapeFile {
  id: string
  hash: string
  name: string
  origFilename: string
  ext: string
  container: string
  codec: string
  bytes: number
  durationSec: number
  bitrate: number
  vbr: boolean | null
  seekTableOk: boolean
  storage: TapeFileStorage
  linkPath: string | null
  addedAt: string
}

/** A recording of a sermon: which file, in which language. A sermon can have several; removing one never touches the sermon. */
export interface TapeRecording {
  id: string
  sermonId: number
  language: string
  label: string
  createdAt: string
  file: TapeFile
  /** has a sync map for the recording's own language */
  synced: boolean
}

export type MarkKind = 'start' | 'skip'
export interface SyncMark {
  /** the numbered paragraph */
  n: number
  /** seconds from the start of the tape; null for a paragraph marked "not on this tape" */
  t: number | null
  /** 0–1, only for times proposed automatically */
  confidence?: number | null
  kind: MarkKind
}
export type RegionKind = 'gap' | 'differs'
export interface SyncRegion {
  kind: RegionKind
  start: number
  end: number
  note?: string
}
export type SyncSource = 'tap' | 'auto' | 'imported'
export interface SyncMap {
  id: string
  recordingId: string
  /** null = the recording's own language; otherwise an override for that text language */
  textLanguage: string | null
  source: SyncSource
  marks: SyncMark[]
  regions: SyncRegion[]
  updatedAt: string
}

export type CheckLevel = 'ok' | 'warn' | 'fail'
export interface TapeCheck {
  id: string
  level: CheckLevel
  title: string
  detail?: string
  /** the one thing to press */
  fix?: 'find-file' | 'choose-another' | 'sync' | 'open-sync' | 'choose-output' | 'none'
}
export interface TapePreflight {
  recordingId: string
  status: CheckLevel
  checks: TapeCheck[]
}

export type TapeFileStatus = 'ok' | 'missing' | 'offline' | 'changed' | 'unreadable'

export interface TapeImportOk {
  ok: true
  file: TapeFile
  recording: TapeRecording | null
  duplicate: boolean
  warnings: string[]
}
export interface TapeImportFail {
  ok: false
  path: string
  reason: 'unreadable' | 'not-audio' | 'unsupported' | 'empty' | 'copy-failed' | 'no-space'
  message: string
}
export type TapeImportResult = TapeImportOk | TapeImportFail

/** One file the "Tape audio" folder scan found, with the sermon it appears to be. */
export interface TapeFolderHit {
  path: string
  name: string
  bytes: number
  parsedCode: string | null
  match: { id: number; dateCode: string; title: string } | null
  candidates: Array<{ id: number; dateCode: string; title: string }>
  confidence: 'exact' | 'ambiguous' | 'none'
  /** already imported (same name and size) */
  imported: boolean
}

export const TAPE_AUDIO_PAGE = 'https://branham.org/en/MessageAudio'

export function formatTapeTime(sec: number | null | undefined, withHours = true): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '–:––'
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  return withHours || h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`
}
