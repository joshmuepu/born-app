/**
 * recentSearches.ts — a small localStorage-backed list of recent sermon
 * search terms, shown in the empty search state. Per-device by design (like
 * the Browse panel's language preference) — it's a convenience shortcut, not
 * service data that needs to sync anywhere.
 */
const KEY = 'born.recentSermonSearches'
const MAX = 5

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function addRecentSearch(term: string): void {
  const t = term.trim()
  if (!t) return
  try {
    const next = [t, ...getRecentSearches().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore — not critical */
  }
}
