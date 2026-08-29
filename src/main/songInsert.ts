/**
 * songInsert.ts — write a ParsedSong into library.db. Electron-free so the
 * build script (scripts/build-library-db.ts) can reuse it.
 */
import type { Database } from 'better-sqlite3'
import type { ParsedSong } from '../shared/song'

export interface InsertedSong {
  id: number
  title: string
}

/**
 * Insert a song + its slides. `search_body` (title + all lyrics) feeds songs_fts
 * via trigger. Returns the new row id.
 */
export function insertSong(
  db: Database,
  song: ParsedSong,
  source: 'bundled' | 'import',
  originPath?: string
): InsertedSong {
  const body = [song.title, song.author ?? '', ...song.slides.map((s) => s.text)]
    .filter(Boolean)
    .join('\n')

  const info = db
    .prepare(
      `INSERT INTO songs (title, author, song_key, ccli, source, origin_path, search_body)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      song.title.trim(),
      song.author?.trim() || null,
      song.songKey?.trim() || null,
      song.ccli?.trim() || null,
      source,
      originPath ?? null,
      body
    )
  const id = Number(info.lastInsertRowid)

  const insSlide = db.prepare(
    'INSERT INTO song_slides (song_id, slide_index, label, text) VALUES (?, ?, ?, ?)'
  )
  song.slides.forEach((s, i) => {
    if (s.text.trim().length === 0) return
    insSlide.run(id, i, s.label?.trim() || null, s.text)
  })

  return { id, title: song.title.trim() }
}

/** Whether a song from this import path is already present. */
export function songExistsByPath(db: Database, originPath: string): boolean {
  return !!db
    .prepare('SELECT 1 FROM songs WHERE origin_path = ? LIMIT 1')
    .get(originPath)
}
