/**
 * queueSongImport.ts — the one feature in v1's otherwise hardening-only
 * pass: when an operator opens/imports a shared service queue, any songs
 * in it that aren't already in this computer's library get the chance to
 * be added, right there, so next week they're real library songs (in
 * Songs, in search, in the A-Z list) instead of only projectable because
 * they happened to be embedded in that one queue file.
 *
 * Split in two calls on purpose:
 *   - matchQueueSongs() only reads the library, never writes — safe to
 *     call before the operator has decided anything.
 *   - commitSongImportDecisions() is the only thing that writes, and does
 *     every insert in one db.transaction() — either all of them land, or
 *     (on any failure) none do; the library is never left half-imported.
 */
import { getLibraryDb } from './libraryDb'
import { insertSong } from './songInsert'
import { log } from './logger'
import {
  matchSongs,
  normalizeSongTitle,
  normalizeLyrics,
  type LibrarySongForMatch,
  type SongToMatch,
  type SongMatchResult
} from '../shared/songMatch'

// Re-derives normalized title/lyrics for the WHOLE library on every call —
// fine at today's scale (one query + a JS pass over a few thousand rows,
// well under the matchSongs test's own 1200-song/200ms bar), so no caching
// needed yet.
function getLibraryForMatching(): LibrarySongForMatch[] {
  const db = getLibraryDb()
  const songs = db.prepare<[], { id: number; title: string }>('SELECT id, title FROM songs').all()
  const slidesBySong = new Map<number, string[]>()
  for (const row of db
    .prepare<[], { song_id: number; text: string }>(
      'SELECT song_id, text FROM song_slides ORDER BY song_id, slide_index'
    )
    .all()) {
    const list = slidesBySong.get(row.song_id)
    if (list) list.push(row.text)
    else slidesBySong.set(row.song_id, [row.text])
  }
  return songs.map((s) => {
    const texts = (slidesBySong.get(s.id) ?? []).map((text) => ({ text }))
    return {
      id: s.id,
      title: s.title,
      normalizedTitle: normalizeSongTitle(s.title),
      normalizedLyrics: normalizeLyrics(texts)
    }
  })
}

export function matchQueueSongs(incoming: SongToMatch[]): SongMatchResult[] {
  if (incoming.length === 0) return []
  return matchSongs(incoming, getLibraryForMatching())
}

export interface SongGroupToAdd {
  groupId: string
  title: string
  author?: string
  songKey?: string
  slides: Array<{ text: string; label?: string }>
}

export type CommitSongImportResult =
  | { ok: true; added: Array<{ groupId: string; songId: number }> }
  | { ok: false; error: string }

/** Inserts every group the operator chose to add, as one transaction — if
 *  any single insert throws, better-sqlite3 rolls the whole transaction
 *  back automatically, so a mid-batch failure (a locked file, a disk
 *  error) can never leave some of the batch added and the rest missing. */
export function commitSongImportDecisions(groups: SongGroupToAdd[]): CommitSongImportResult {
  if (groups.length === 0) return { ok: true, added: [] }
  try {
    const db = getLibraryDb()
    const added: Array<{ groupId: string; songId: number }> = []
    const tx = db.transaction(() => {
      for (const group of groups) {
        const inserted = insertSong(
          db,
          {
            title: group.title,
            author: group.author,
            songKey: group.songKey,
            slides: group.slides
          },
          'import'
        )
        added.push({ groupId: group.groupId, songId: inserted.id })
      }
    })
    tx()
    return { ok: true, added }
  } catch (e) {
    log.error('commitSongImportDecisions failed — rolled back, nothing added', e)
    return { ok: false, error: "Couldn't add the new songs — nothing was changed." }
  }
}
