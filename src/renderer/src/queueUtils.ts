/**
 * Pure helpers for service-queue mutations. Extracted so the index maths that
 * keeps the "active" (currently-projected) item pointed at the right row can be
 * unit-tested.
 */

import type { Quote } from './types'

export interface FollowSermon {
  sermonId: number
  anchorRef: string
  query?: string
  matchType?: Quote['matchType']
}

/**
 * Next follow-view state after projecting/opening `quote` from a path that
 * is never itself a search (Browse, or "Restart here" inside the follow view
 * on a paragraph of the sermon already being followed). Projecting a fresh
 * sermon drops any search query/matchType the previous follow session had —
 * otherwise a term searched earlier keeps getting highlighted in paragraphs
 * of a completely unrelated sermon opened later via Browse or the queue.
 * Staying on the *same* sermon (e.g. clicking another paragraph's "Restart
 * here" while already following it) preserves the existing query/matchType,
 * since that's still a legitimate, in-context search highlight.
 */
export function nextFollowSermon(prev: FollowSermon | null, quote: Quote): FollowSermon {
  return prev && prev.sermonId === quote.sermonId
    ? { ...prev, anchorRef: quote.paragraphRef }
    : { sermonId: quote.sermonId, anchorRef: quote.paragraphRef }
}

export function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** New index of the active item after a row moves from `from` to `to`. */
export function remapActiveIndexAfterReorder(
  active: number | null,
  from: number,
  to: number
): number | null {
  if (active === null) return null
  if (active === from) return to
  if (from < to && active > from && active <= to) return active - 1
  if (from > to && active >= to && active < from) return active + 1
  return active
}

/** New index of the active item after the row at `removed` is deleted. */
export function remapActiveIndexAfterRemove(
  active: number | null,
  removed: number
): number | null {
  if (active === null) return null
  if (active === removed) return null
  return active > removed ? active - 1 : active
}

/**
 * A contributor re-sending their prepared list mid-service (e.g. the song
 * leader edits their set after the operator already has an older version
 * queued) replaces only THAT contributor's own not-yet-shown items — never
 * a blind append (which would duplicate rows on every re-send) and never a
 * full-queue replace (which would blow away the other contributor's and the
 * operator's own items). Anything from this contributor already played, or
 * genuinely on screen right now (`protectedId`), is left in place even
 * though it's about to be superseded — erasing live/played history out from
 * under the operator mid-service would be worse than a few stale rows.
 *
 * The new batch is inserted right after this contributor's last remaining
 * (played/protected) item, or at the end of the queue if none remain, so
 * their material stays contiguous even though grouping-by-source in the UI
 * doesn't actually depend on position.
 */
export function replaceContributorItems<T extends { id: string; source?: { deviceId: string } }>(
  queue: T[],
  newItems: T[],
  deviceId: string,
  playedIds: Set<string>,
  protectedId: string | null
): T[] {
  const kept = queue.filter(
    (it) => it.source?.deviceId !== deviceId || playedIds.has(it.id) || it.id === protectedId
  )
  let insertAt = kept.length
  for (let i = kept.length - 1; i >= 0; i--) {
    if (kept[i].source?.deviceId === deviceId) {
      insertAt = i + 1
      break
    }
  }
  return [...kept.slice(0, insertAt), ...newItems, ...kept.slice(insertAt)]
}
