/**
 * songs.ts — song search / fetch / import / delete against library.db.
 */
import { readFileSync, statSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { getLibraryDb } from './libraryDb'
import { log } from './logger'
import { parseSong, needsReview, NO_TEXT_FOUND } from './songParsers'
import { parsePlainText } from './songParsers/plainText'
import { insertSong, songExistsByPath } from './songInsert'
import { MAX_SEARCH_RESULTS } from '../shared/searchLimits'
import { isStandardKey } from '../shared/songKeys'
import { isUsableSong, type ParsedSong } from '../shared/song'
import { searchHymnary, fetchHymnaryHymn } from './hymnary'
import { searchCyberHymnal, fetchCyberHymnalHymn } from './cyberHymnal'

export interface SongSummary {
  id: number
  title: string
  author: string | null
  songKey: string | null
  slideCount: number
  source: string
  /** Set on a search hit (not a plain browse row): false means the query
   *  wasn't in the title, so the UI should show where it *was* found. */
  matchedInTitle?: boolean
  /** The first lyric slide that matched, when the match wasn't in the title. */
  matchSlide?: { label: string | null; text: string }
}

export interface SongDetail {
  id: number
  title: string
  author: string | null
  songKey: string | null
  source: string
  provenance: { label: string; url?: string } | null
  slides: Array<{ label: string | null; text: string }>
}

const ONLINE_HYMNARY_PREFIX = 'online:hymnary:'

/** origin_path for a song pulled in from Hymnary.org is the prefix above
 *  plus the exact page URL it came from — doubles as the dedupe key (so
 *  re-importing the same hymn is a no-op, same as a file's origin_path
 *  already does) and, unpacked here, the provenance shown on the song. */
function provenanceFromOriginPath(originPath: string | null): { label: string; url?: string } | null {
  if (!originPath || !originPath.startsWith(ONLINE_HYMNARY_PREFIX)) return null
  const url = originPath.slice(ONLINE_HYMNARY_PREFIX.length)
  return { label: 'Imported from Hymnary.org · Public Domain', url: url || undefined }
}

/** See src/shared/searchLimits.ts. The full song library (~1,163 songs) is
 *  nowhere near this, so it's a pure safety valve here — but shares the
 *  constant with Sermon/Bible search for one number to reason about. */
const NO_PRACTICAL_LIMIT = MAX_SEARCH_RESULTS

export function searchSongs(query: string, limit = NO_PRACTICAL_LIMIT): SongSummary[] {
  try {
    const db = getLibraryDb()
    const q = (query ?? '').trim()
    if (q.length < 2) {
      return db
        .prepare<[number], SongSummary>(
          `SELECT s.id, s.title, s.author, s.song_key AS songKey, s.source,
                  (SELECT COUNT(*) FROM song_slides WHERE song_id = s.id) AS slideCount
           FROM songs s ORDER BY s.title LIMIT ?`
        )
        .all(limit)
    }

    const rows = db
      .prepare<[string, number], SongSummary>(
        `SELECT s.id, s.title, s.author, s.song_key AS songKey, s.source,
                (SELECT COUNT(*) FROM song_slides WHERE song_id = s.id) AS slideCount
         FROM songs_fts f JOIN songs s ON s.id = f.rowid
         WHERE songs_fts MATCH ? ORDER BY rank LIMIT ?`
      )
      .all('"' + q.replace(/"/g, '""') + '"', limit)

    // The FTS index matches title + lyrics as one blob, so a hit doesn't say
    // *where* it landed — a song leader searching a half-remembered lyric
    // line needs to see that, not just a title that means nothing to them.
    const qLower = q.toLowerCase()
    const slideStmt = db.prepare<[number, string], { label: string | null; text: string }>(
      `SELECT label, text FROM song_slides
       WHERE song_id = ? AND LOWER(text) LIKE '%' || ? || '%'
       ORDER BY slide_index LIMIT 1`
    )
    // A title match is what the song leader is almost always looking for —
    // rank every one of those above every lyric-only match, rather than
    // leaving both interleaved by raw bm25 score (which weighs a short dense
    // title field about the same as a long lyric block, so the ordering
    // looked arbitrary). Within each group, the original MATCH ... ORDER BY
    // rank order — real relevance — is preserved.
    const titleMatches: SongSummary[] = []
    const lyricMatches: SongSummary[] = []
    for (const r of rows) {
      if (r.title.toLowerCase().includes(qLower)) {
        titleMatches.push({ ...r, matchedInTitle: true })
      } else {
        const slide = slideStmt.get(r.id, qLower)
        lyricMatches.push({ ...r, matchedInTitle: false, matchSlide: slide ?? undefined })
      }
    }
    return [...titleMatches, ...lyricMatches]
  } catch (e) {
    log.error('searchSongs error', e)
    return []
  }
}

/** Most song formats only tag the *first* verse explicitly ("Verse 1") and
 *  leave the rest of the verse slides bare, relying on a human reading the
 *  file to infer "this one must be verse 2". A live operator scanning a
 *  slide list doesn't have that luxury, so every slide gets a real label:
 *  an explicit one is kept as-is (and bumps the running verse count if it's
 *  itself a numbered verse), and a bare slide inherits the next verse
 *  number in sequence — counting straight through any Chorus/Bridge in
 *  between, so numbering never restarts or skips after an interruption. */
function normalizeSlideLabels<T extends { label: string | null }>(slides: T[]): T[] {
  let verseNum = 0
  return slides.map((s) => {
    const label = s.label?.trim()
    if (label) {
      const m = /^verse\s*(\d+)/i.exec(label)
      if (m) verseNum = Math.max(verseNum, parseInt(m[1], 10))
      return { ...s, label }
    }
    verseNum += 1
    return { ...s, label: `Verse ${verseNum}` }
  })
}

export function getSong(id: number): SongDetail | null {
  try {
    const db = getLibraryDb()
    const song = db
      .prepare<
        [number],
        { id: number; title: string; author: string | null; song_key: string | null; source: string; origin_path: string | null }
      >(
        'SELECT id, title, author, song_key, source, origin_path FROM songs WHERE id = ?'
      )
      .get(id)
    if (!song) return null
    const slides = db
      .prepare<[number], { label: string | null; text: string }>(
        'SELECT label, text FROM song_slides WHERE song_id = ? ORDER BY slide_index'
      )
      .all(id)
    return {
      id: song.id,
      title: song.title,
      author: song.author,
      songKey: song.song_key,
      source: song.source,
      provenance: provenanceFromOriginPath(song.origin_path),
      slides: normalizeSlideLabels(slides)
    }
  } catch (e) {
    log.error('getSong error', e)
    return null
  }
}

const SONG_EXT_RE = /\.(pro|pro7|xml|cho|crd|chordpro|chopro|txt|docx|pdf)$/i

function collectFiles(paths: string[]): string[] {
  const out: string[] = []
  for (const p of paths) {
    try {
      if (statSync(p).isDirectory()) {
        for (const f of readdirSync(p)) {
          if (!f.startsWith('._') && SONG_EXT_RE.test(f)) out.push(join(p, f))
        }
      } else if (SONG_EXT_RE.test(p)) {
        out.push(p)
      }
    } catch {
      /* ignore unreadable path */
    }
  }
  return out
}

/** A parsed-but-uncommitted song awaiting the operator's review — its
 *  structure was guessed (blank lines, "Chorus:" labels), not read from
 *  explicit file markup, so it's never written until they've seen it. */
export interface ReviewItem {
  /** Same dedupe key a straight-through import would have used — carried
   *  through to commitReviewedSong so a re-import of the same file still
   *  can't create a duplicate, even after a detour through review. */
  originPath: string
  displayName: string
  song: ParsedSong
}

export interface ImportResult {
  added: Array<{ id: number; title: string }>
  failed: Array<{ file: string; error: string }>
  skipped: number
  needsReview: ReviewItem[]
}

function friendlyParseError(error: string): string {
  if (error === NO_TEXT_FOUND) {
    return "No readable text found — if this is a scanned document, try copying the text and pasting it instead."
  }
  return error
}

/** Structured formats (ChordPro/OpenSong/OpenLyrics/ProPresenter7) commit
 *  straight through exactly as before — their verse/chorus shape came from
 *  the file's own explicit markup, not a guess. A guessed format (plain
 *  text, docx, pdf) is parsed here too, but held in `needsReview` instead of
 *  written, so the caller can show it to the operator before anything
 *  touches the database — parsing happens up front (it's async: docx/pdf
 *  extraction needs it) so only the actual writes need the sync db
 *  transaction better-sqlite3 requires. */
export async function importSongs(paths: string[]): Promise<ImportResult> {
  const result: ImportResult = { added: [], failed: [], skipped: 0, needsReview: [] }
  try {
    const db = getLibraryDb()
    const files = collectFiles(paths)
    const toCommit: Array<{ song: ParsedSong; originPath: string }> = []

    for (const file of files) {
      const originPath = `import:${basename(file)}`
      if (songExistsByPath(db, originPath)) {
        result.skipped++
        continue
      }
      try {
        const r = await parseSong(basename(file), readFileSync(file))
        if ('error' in r) {
          result.failed.push({ file: basename(file), error: friendlyParseError(r.error) })
          continue
        }
        if (needsReview(r.format)) {
          result.needsReview.push({ originPath, displayName: basename(file), song: r.song })
        } else {
          toCommit.push({ song: r.song, originPath })
        }
      } catch (e) {
        result.failed.push({ file: basename(file), error: (e as Error).message })
      }
    }

    const tx = db.transaction(() => {
      for (const { song, originPath } of toCommit) {
        result.added.push(insertSong(db, song, 'import', originPath))
      }
    })
    tx()
  } catch (e) {
    log.error('importSongs error', e)
  }
  return result
}

/** Parses pasted text the exact same way a .txt file would be — same
 *  blank-line/label auto-detection — but never commits it; the paste screen
 *  is a review-first surface by design, there's no "trust it, it's a whole
 *  file" shortcut the way structured file formats get. */
export function parsePastedText(text: string, titleHint?: string): ParsedSong | { error: string } {
  const song = parsePlainText(text, titleHint?.trim() || 'Untitled')
  if (!isUsableSong(song)) return { error: 'No lyrics found in that text.' }
  return song
}

/** The one place any reviewed ParsedSong — from a file, a paste, or an
 *  online source — actually reaches the database, after the operator has
 *  seen and possibly corrected it. `originPath` is omitted for a paste
 *  (nothing to dedupe against); when present, re-checked here rather than
 *  trusted from whenever review started, same reasoning as hymnaryImport's
 *  own re-check right before its write. */
export function commitReviewedSong(
  song: ParsedSong,
  originPath?: string
): { id: number; title: string; alreadyImported: boolean } {
  const db = getLibraryDb()
  if (originPath) {
    const existing = db
      .prepare<[string], { id: number; title: string }>('SELECT id, title FROM songs WHERE origin_path = ?')
      .get(originPath)
    if (existing) return { ...existing, alreadyImported: true }
  }
  const ins = insertSong(db, song, 'import', originPath)
  return { ...ins, alreadyImported: false }
}

/** `key: null` clears it — that's the explicit "we genuinely don't know it
 *  yet" state, not an error. Any non-null value must be one of the 24
 *  standard keys; anything else is refused rather than silently written,
 *  since the whole point of the constrained picker is that bad data can't
 *  reach this column. Allowed on any song, bundled or imported — unlike
 *  Delete, correcting a key doesn't destroy anything. */
export function updateSongKey(id: number, key: string | null): boolean {
  try {
    if (key !== null && !isStandardKey(key)) return false
    const db = getLibraryDb()
    const info = db.prepare('UPDATE songs SET song_key = ? WHERE id = ?').run(key, id)
    return info.changes > 0
  } catch (e) {
    log.error('updateSongKey error', e)
    return false
  }
}

export function deleteSong(id: number): boolean {
  try {
    const db = getLibraryDb()
    const info = db.prepare("DELETE FROM songs WHERE id = ? AND source = 'import'").run(id)
    if (info.changes > 0) db.prepare('DELETE FROM song_slides WHERE song_id = ?').run(id)
    return info.changes > 0
  } catch (e) {
    log.error('deleteSong error', e)
    return false
  }
}

// ── Online import (Hymnary.org + the Cyber Hymnal) ──────────────────────────
// See hymnary.ts / cyberHymnal.ts for the fetch/parse/PD-gate of each source.
// One unified search/preview/import surface so the review screen (and the
// operator) never need to think about which source a result came from until
// it matters — e.g. the Cyber Hymnal's softer, confirm-it-yourself gate.

export interface OnlineCandidate {
  title: string
  url: string
  source: 'hymnary' | 'cyberhymnal'
}

/** Queries both sources concurrently. One source being unreachable doesn't
 *  hide the other's results — only when BOTH fail does this throw, so the
 *  UI can tell "nothing matched" apart from "couldn't search at all." */
export async function onlineSongSearch(query: string): Promise<OnlineCandidate[]> {
  const [hymnary, cyber] = await Promise.allSettled([searchHymnary(query), searchCyberHymnal(query)])
  const out: OnlineCandidate[] = []
  if (hymnary.status === 'fulfilled') out.push(...hymnary.value.map((c) => ({ ...c, source: 'hymnary' as const })))
  if (cyber.status === 'fulfilled') out.push(...cyber.value.map((c) => ({ ...c, source: 'cyberhymnal' as const })))
  if (hymnary.status === 'rejected' && cyber.status === 'rejected') {
    throw new Error("Couldn't reach the internet — check your connection and try again.")
  }
  return out
}

export type OnlinePreview =
  | {
      ok: true
      song: ParsedSong
      url: string
      source: 'hymnary' | 'cyberhymnal'
      provenanceLabel: string
      /** Only ever true for a Cyber Hymnal result — Hymnary's explicit
       *  "Copyright: Public Domain" field is trusted outright; the Cyber
       *  Hymnal's softer "no notice found" signal isn't, so the operator is
       *  asked to actually look at the source page before saving. */
      needsConfirmation: boolean
      confirmationNote?: string
    }
  | { ok: false; reason: string; copyright?: string }

/** No-commit lookup for the review screen — fetches and parses but never
 *  writes to the db. */
export async function onlineSongPreview(url: string, source: 'hymnary' | 'cyberhymnal'): Promise<OnlinePreview> {
  if (source === 'hymnary') {
    const r = await fetchHymnaryHymn(url)
    if (!r.ok) return { ok: false, reason: r.reason, copyright: r.copyright }
    return { ok: true, song: r.song, url: r.url, source, provenanceLabel: 'Public Domain · Hymnary.org', needsConfirmation: false }
  }
  const r = await fetchCyberHymnalHymn(url)
  if (!r.ok) return { ok: false, reason: r.reason, copyright: r.copyright }
  return {
    ok: true,
    song: r.song,
    url: r.url,
    source,
    provenanceLabel: r.needsConfirmation ? 'Public domain — unconfirmed · Cyber Hymnal' : 'Public Domain · Cyber Hymnal',
    needsConfirmation: r.needsConfirmation,
    confirmationNote: r.confirmationNote
  }
}

export type OnlineImportResult =
  | { ok: true; id: number; title: string; alreadyImported: boolean }
  | { ok: false; reason: string; copyright?: string }

/** Commits the operator's reviewed (possibly hand-corrected) song, but only
 *  after re-fetching and re-checking the PD gate right before the write —
 *  the gate has to still pass *now*, not just when review started a few
 *  screens ago, while still saving whatever the operator actually edited
 *  rather than throwing their corrections away by re-parsing from scratch. */
export async function onlineSongImport(
  url: string,
  source: 'hymnary' | 'cyberhymnal',
  edited: ParsedSong
): Promise<OnlineImportResult> {
  const originPath = `online:${source}:${url}`
  const db = getLibraryDb()
  const existing = db
    .prepare<[string], { id: number; title: string }>('SELECT id, title FROM songs WHERE origin_path = ?')
    .get(originPath)
  if (existing) return { ok: true, id: existing.id, title: existing.title, alreadyImported: true }

  const r = source === 'hymnary' ? await fetchHymnaryHymn(url) : await fetchCyberHymnalHymn(url)
  if (!r.ok) return { ok: false, reason: r.reason, copyright: r.copyright }
  const ins = insertSong(db, edited, 'import', originPath)
  return { ok: true, id: ins.id, title: ins.title, alreadyImported: false }
}
