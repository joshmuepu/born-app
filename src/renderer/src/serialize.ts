/**
 * serialize.ts — chain overlapping async calls so each one only starts once
 * the previous one has actually finished, instead of racing on shared state
 * read at the start of each.
 *
 * Used by App.tsx's advance() (Next/Prev): doProject() awaits
 * ensureProjectionOpen() before it updates the "what's currently on screen"
 * ref, so two advance() calls close enough together — two rapid taps, or the
 * remote and the keyboard shortcut firing within the same tick — would
 * otherwise both read the same stale ref, compute the same target slide, and
 * net out to a single advance instead of two.
 */

export interface SerialQueue {
  current: Promise<unknown>
}

export function newSerialQueue(): SerialQueue {
  return { current: Promise.resolve() }
}

/** Chains `fn` onto whatever's already pending in `queue`, so a call that
 *  starts while a previous one is still in flight waits for it to settle
 *  (success or failure) before it begins — never reading state the
 *  in-flight call hasn't finished writing yet. Each call's own result/error
 *  is still returned to its own caller, independent of the others. */
export function serialize<T>(queue: SerialQueue, fn: () => Promise<T>): Promise<T> {
  const result = queue.current.then(fn, fn)
  // The queue itself must never become a rejected promise — that would make
  // every future call chained onto it (via .then(fn, fn)) skip straight to
  // its own failure handler instead of running at all.
  queue.current = result.then(
    () => undefined,
    () => undefined
  )
  return result
}
