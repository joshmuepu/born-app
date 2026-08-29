/**
 * songs.ts — song search / fetch / import / delete against library.db.
 */
import { readFileSync, statSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { getLibraryDb } from './libraryDb'
import { log } from './logger'
import { parseSong } from './songParsers'
import { insertSong, songExistsByPath } from './songInsert'

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

export function searchSongs(query: string, limit = 50): SongSummary[] {
  try {
    const db = getLibraryDb()
    const q = (query ?? '').trim()
    const rows =
      q.length < 2
        ? db
            .prepare<[number], SongSummary>(
              `SELECT s.id, s.title, s.author, s.song_key AS songKey, s.source,
                      (SELECT COUNT(*) FROM song_slides WHERE song_id = s.id) AS slideCount
               FROM songs s ORDER BY s.title LIMIT ?`
            )
            .all(limit)
        : db
            .prepare<[string, number], SongSummary>(
              `SELECT s.id, s.title, s.author, s.song_key AS songKey, s.source,
                      (SELECT COUNT(*) FROM song_slides WHERE song_id = s.id) AS slideCount
               FROM songs_fts f JOIN songs s ON s.id = f.rowid
               WHERE songs_fts MATCH ? ORDER BY rank LIMIT ?`
            )
            .all('"' + q.replace(/"/g, '""') + '"', limit)
    return rows
  } catch (e) {
    log.error('searchSongs error', e)
    return []
  }
}

export function getSong(id: number): SongDetail | null {
  try {
    const db = getLibraryDb()
    const song = db
      .prepare<[number], { id: number; title: string; author: string | null; song_key: string | null; source: string }>(
        'SELECT id, title, author, song_key, source FROM songs WHERE id = ?'
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
      slides
    }
  } catch (e) {
    log.error('getSong error', e)
    return null
  }
}

const SONG_EXT_RE = /\.(pro|pro7|xml|cho|crd|chordpro|chopro|txt)$/i

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

export interface ImportResult {
  added: Array<{ id: number; title: string }>
  failed: Array<{ file: string; error: string }>
  skipped: number
}

export function importSongs(paths: string[]): ImportResult {
  const result: ImportResult = { added: [], failed: [], skipped: 0 }
  try {
    const db = getLibraryDb()
    const files = collectFiles(paths)
    const tx = db.transaction(() => {
      for (const file of files) {
        const originPath = `import:${basename(file)}`
        if (songExistsByPath(db, originPath)) {
          result.skipped++
          continue
        }
        try {
          const r = parseSong(basename(file), readFileSync(file))
          if ('error' in r) {
            result.failed.push({ file: basename(file), error: r.error })
            continue
          }
          const ins = insertSong(db, r.song, 'import', originPath)
          result.added.push(ins)
        } catch (e) {
          result.failed.push({ file: basename(file), error: (e as Error).message })
        }
      }
    })
    tx()
  } catch (e) {
    log.error('importSongs error', e)
  }
  return result
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
