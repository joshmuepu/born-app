import { useCallback, useRef, useState } from 'react'

/** Where the operator has been, as places they can be taken back to. Opening
 *  a sermon, a chapter or a song is a place; the columns above it are not. */
export type NavEntry =
  | { kind: 'sermon'; sermonId: number; anchorRef: string }
  | { kind: 'bible'; bookNum: number; chapter: number; verse: number }
  | { kind: 'song'; songId: number }

const MAX_ENTRIES = 60

function samePlace(a: NavEntry | undefined, b: NavEntry): boolean {
  if (!a || a.kind !== b.kind) return false
  if (a.kind === 'sermon' && b.kind === 'sermon') return a.sermonId === b.sermonId
  if (a.kind === 'bible' && b.kind === 'bible') return a.bookNum === b.bookNum && a.chapter === b.chapter
  if (a.kind === 'song' && b.kind === 'song') return a.songId === b.songId
  return false
}

/**
 * Back/forward over opened places. `apply` re-opens an entry (navigation only —
 * it must never project). While it runs, recording is suppressed so going back
 * doesn't push a new entry and wipe the forward stack.
 */
export function useNavHistory(apply: (entry: NavEntry) => void): {
  record: (entry: NavEntry) => void
  back: () => void
  forward: () => void
  canBack: boolean
  canForward: boolean
} {
  const ref = useRef<{ entries: NavEntry[]; index: number }>({ entries: [], index: -1 })
  const restoring = useRef(false)
  const [, setTick] = useState(0)
  const bump = (): void => setTick((t) => t + 1)

  const record = useCallback((entry: NavEntry) => {
    if (restoring.current) return
    const h = ref.current
    if (samePlace(h.entries[h.index], entry)) {
      // Same place again (e.g. a new anchor in the same sermon): keep the
      // newest detail, don't grow the history.
      h.entries[h.index] = entry
      return
    }
    h.entries = [...h.entries.slice(0, h.index + 1), entry].slice(-MAX_ENTRIES)
    h.index = h.entries.length - 1
    bump()
  }, [])

  const go = useCallback(
    (to: number) => {
      const h = ref.current
      if (to < 0 || to >= h.entries.length) return
      h.index = to
      restoring.current = true
      try {
        apply(h.entries[to])
      } finally {
        window.setTimeout(() => {
          restoring.current = false
        }, 700)
      }
      bump()
    },
    [apply]
  )

  const back = useCallback(() => go(ref.current.index - 1), [go])
  const forward = useCallback(() => go(ref.current.index + 1), [go])

  return {
    record,
    back,
    forward,
    canBack: ref.current.index > 0,
    canForward: ref.current.index < ref.current.entries.length - 1
  }
}
