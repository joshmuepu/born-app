import { useCallback, useEffect, useState } from 'react'
import type { Quote } from './types'

/** Favorites: a short list of things the operator reaches for again — a
 *  sermon paragraph, a verse, a song. Stored locally (this machine only);
 *  nothing here is synced or sent anywhere. */
export type Favorite =
  | { id: string; kind: 'sermon'; title: string; subtitle: string; quote: Quote }
  | {
      id: string
      kind: 'verse'
      title: string
      subtitle: string
      reference: string
      bookNum: number
      chapter: number
      verse: number
    }
  | { id: string; kind: 'song'; title: string; subtitle: string; songId: number }

const KEY = 'born.favorites.v1'
const EVENT = 'born:favorites'
const MAX = 200

export const favId = {
  sermon: (sermonId: number, paragraphRef: string): string => `s:${sermonId}:${paragraphRef}`,
  verse: (bookNum: number, chapter: number, verse: number): string => `v:${bookNum}:${chapter}:${verse}`,
  song: (songId: number): string => `m:${songId}`
}

export function loadFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Favorite[]) : []
    return Array.isArray(parsed) ? parsed.filter((f) => f && typeof f.id === 'string') : []
  } catch {
    return []
  }
}

function save(list: Favorite[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* storage unavailable — favorites just won't persist */
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Adds or removes. Returns true when the item is now a favorite. */
export function toggleFavorite(fav: Favorite): boolean {
  const list = loadFavorites()
  const i = list.findIndex((f) => f.id === fav.id)
  if (i >= 0) {
    list.splice(i, 1)
    save(list)
    return false
  }
  save([fav, ...list])
  return true
}

export function useFavorites(): {
  list: Favorite[]
  has: (id: string) => boolean
  toggle: (fav: Favorite) => boolean
} {
  const [list, setList] = useState<Favorite[]>(loadFavorites)
  useEffect(() => {
    const sync = (): void => setList(loadFavorites())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  const has = useCallback((id: string) => list.some((f) => f.id === id), [list])
  return { list, has, toggle: toggleFavorite }
}
