import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SyncMap, TapeFileStatus, TapeRecording } from '../../shared/tape'
import { nextParagraphTime, paragraphAt, prevParagraphTime, tickTimes, type ParagraphPosition } from '../../shared/tapeSync'
import { onTape } from './tapeBus'
import { useTape } from './useTape'

export type TapeRec = TapeRecording & { status: TapeFileStatus }

/**
 * "What is the tape doing right now, app-wide": the loaded recording and its timing, which paragraph is being spoken, and the paragraph skips.
 * Used by the bottom bar, which must work from every section — so it does not depend on which sermon is open anywhere.
 */
export function useTapeNow(tickMs = 250) {
  const { wire, pos, command, load } = useTape(tickMs)
  const [rec, setRec] = useState<TapeRec | null>(null)
  const [map, setMap] = useState<SyncMap | null>(null)
  const [version, setVersion] = useState(0)
  const recId = wire?.recordingId ?? null
  const sermonId = wire?.sermonId ?? null

  useEffect(() => onTape(() => setVersion((v) => v + 1)), [])
  useEffect(() => {
    let alive = true
    if (!recId || sermonId === null) { setRec(null); setMap(null); return }
    void (async () => {
      const recs = (await window.electronAPI.tapeRecordings?.(sermonId)) ?? []
      const r = recs.find((x) => x.id === recId) ?? null
      const m = r ? (((await window.electronAPI.tapeMapGet?.(r.id, null)) as SyncMap | null) ?? null) : null
      if (alive) { setRec(r); setMap(m) }
    })()
    return () => { alive = false }
  }, [recId, sermonId, version])

  const hasTiming = !!map && map.marks.some((m) => m.kind === 'start' && m.t !== null)
  const here: ParagraphPosition | null = useMemo(() => (map && hasTiming ? paragraphAt(map.marks, map.regions, pos) : null), [map, hasTiming, pos])
  const starts = useMemo(() => (map ? tickTimes(map.marks) : []), [map])
  const prevParagraph = useCallback(() => { if (!map) return; const t = prevParagraphTime(map.marks, map.regions, pos); if (t !== null) command({ type: 'seek', to: t }) }, [map, pos, command])
  const nextParagraph = useCallback(() => { if (!map) return; const t = nextParagraphTime(map.marks, map.regions, pos); if (t !== null) command({ type: 'seek', to: t }) }, [map, pos, command])
  return { wire, pos, rec, map, hasTiming, here, starts, prevParagraph, nextParagraph, command, load }
}
