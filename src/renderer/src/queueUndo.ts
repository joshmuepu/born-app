import type { QueueItem } from './types'

/** Undo for queue edits that is safe to run seconds later, after the operator
 *  has carried on: each helper changes only the one thing that was done and
 *  leaves everything added or moved since. None of them touches what is live. */

/** Put a removed item back where it was — unless it is already there. */
export function reinsertAt(current: QueueItem[], item: QueueItem, index: number): QueueItem[] {
  if (current.some((q) => q.id === item.id)) return current
  const at = Math.max(0, Math.min(index, current.length))
  return [...current.slice(0, at), item, ...current.slice(at)]
}

export function removeById(current: QueueItem[], id: string): QueueItem[] {
  return current.some((q) => q.id === id) ? current.filter((q) => q.id !== id) : current
}

/** Put a moved item back at the index it came from. */
export function moveBackTo(current: QueueItem[], id: string, index: number): QueueItem[] {
  const from = current.findIndex((q) => q.id === id)
  if (from < 0) return current
  const to = Math.max(0, Math.min(index, current.length - 1))
  if (from === to) return current
  const next = current.slice()
  const [it] = next.splice(from, 1)
  next.splice(to, 0, it)
  return next
}

/** Undo a wholesale replace (New service / Open): the old queue comes back, and
 *  anything the operator added since stays, after it. */
export function mergeRestore(snapshot: QueueItem[], current: QueueItem[]): QueueItem[] {
  const had = new Set(snapshot.map((q) => q.id))
  return [...snapshot, ...current.filter((q) => !had.has(q.id))]
}
