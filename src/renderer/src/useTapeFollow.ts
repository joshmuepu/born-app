import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SyncMap, TapeRecording } from '../../shared/tape'
import { paragraphAt, tickTimes, startOf, type ParagraphPosition } from '../../shared/tapeSync'
import { useTape } from './useTape'

/**
 * The tape, from the reader's point of view: which numbered paragraph is being spoken, whether the reader is following it, and the jumps
 * (previous/next paragraph, click a paragraph) that move the tape. The reader's scroll is the USER's; the highlight is the TAPE's — turning
 * follow off never changes what is highlighted, and turning it on glides back.
 */
export function useTapeFollow(recording: TapeRecording | null, textLanguage: string, mapVersion = 0) {
  const { wire, pos, command, load } = useTape()
  const [map, setMap] = useState<SyncMap | null>(null)
  const [follow, setFollowState] = useState(true)
  const mine = !!recording && !!wire && wire.recordingId === recording.id
  const recId = recording?.id ?? null

  useEffect(() => {
    let alive = true
    setMap(null)
    if (!recId) return
    // a text-language override first, then the recording's own map (a map is keyed by paragraph number, so it fits any text whose numbers match)
    void (async () => {
      const own = textLanguage ? await window.electronAPI.tapeMapGet?.(recId, textLanguage) : null
      const m = own ?? (await window.electronAPI.tapeMapGet?.(recId, null)) ?? null
      if (alive) setMap(m)
    })()
    return () => { alive = false }
  }, [recId, textLanguage, mapVersion])

  const here: ParagraphPosition | null = useMemo(() => (map && map.marks.length ? paragraphAt(map.marks, map.regions, mine ? pos : (recording ? 0 : 0)) : null), [map, pos, mine, recording])
  const starts = useMemo(() => (map ? tickTimes(map.marks) : []), [map])

  // the tape's position before the last jump, for Undo
  const lastJump = useRef<number | null>(null)
  const jumpTo = useCallback((t: number) => {
    if (!recording) return
    lastJump.current = mine ? pos : null
    if (mine) command({ type: 'seek', to: t })
    else void load(recording.id, { position: t })
  }, [recording, mine, pos, command, load])
  const jumpToParagraph = useCallback((n: number): boolean => {
    const t = map ? startOf(map.marks, n) : null
    if (t === null) return false
    jumpTo(t)
    return true
  }, [map, jumpTo])
  const undoJump = useCallback(() => { if (lastJump.current !== null) { command({ type: 'seek', to: lastJump.current }); lastJump.current = null } }, [command])
  const prevParagraph = useCallback(() => {
    if (!map || !here) return
    // more than 3 s into a paragraph: back to its start; otherwise the one before
    const cur = here.start
    const before = starts.filter((t) => t < (cur ?? 0) - 0.01)
    if (cur !== null && pos - cur > 3) jumpTo(cur)
    else if (before.length) jumpTo(before[before.length - 1])
    else jumpTo(0)
  }, [map, here, starts, pos, jumpTo])
  const nextParagraph = useCallback(() => {
    if (!map) return
    const after = starts.find((t) => t > pos + 0.05)
    if (after !== undefined) jumpTo(after)
  }, [map, starts, pos, jumpTo])

  const setFollow = useCallback((v: boolean) => setFollowState(v), [])
  return { wire, pos, mine, map, here, starts, follow, setFollow, jumpTo, jumpToParagraph, undoJump, prevParagraph, nextParagraph, command, load }
}
