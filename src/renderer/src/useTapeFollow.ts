import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SyncMap, TapeRecording } from '../../shared/tape'
import { paragraphAt, tickTimes, startOf, type ParagraphPosition } from '../../shared/tapeSync'
import { applyOverrides, checkAgreement, decideUse, type Agreement, type MismatchDecision, type MismatchPolicy, type Override } from '../../shared/tapeLanguage'
import { useTape } from './useTape'

const choiceKey = (recId: string, lang: string): string => `born.tape.mismatch.${recId}.${lang}`
const readChoice = (recId: string, lang: string): 'matching' | 'never' | null => {
  try { const v = localStorage.getItem(choiceKey(recId, lang)); return v === 'matching' || v === 'never' ? v : null } catch { return null }
}

/**
 * The tape, from the reader's point of view: which numbered paragraph is being spoken, whether the reader is following it, and the jumps
 * (previous/next paragraph, click a paragraph) that move the tape. The reader's scroll is the USER's; the highlight is the TAPE's — turning
 * follow off never changes what is highlighted, and turning it on glides back.
 */
export function useTapeFollow(recording: TapeRecording | null, textLanguage: string, mapVersion = 0, textNumbers: number[] | null = null) {
  const { wire, pos, command, load } = useTape()
  const [baseMap, setBaseMap] = useState<SyncMap | null>(null)
  const [overrides, setOverridesState] = useState<Override[]>([])
  const [policy, setPolicy] = useState<MismatchPolicy>('ask')
  const [choice, setChoiceState] = useState<'matching' | 'never' | null>(null)
  const [ownMap, setOwnMap] = useState(false)
  const [follow, setFollowState] = useState(true)
  const mine = !!recording && !!wire && wire.recordingId === recording.id
  const recId = recording?.id ?? null

  useEffect(() => {
    let alive = true
    setBaseMap(null)
    setOverridesState([])
    if (!recId) return
    // a map made for this text language first, then the recording's own map (a map is keyed by paragraph number, so it fits any text whose numbers match)
    void (async () => {
      const own = textLanguage ? await window.electronAPI.tapeMapGet?.(recId, textLanguage) : null
      const m = own ?? (await window.electronAPI.tapeMapGet?.(recId, null)) ?? null
      const ov = !own && textLanguage && textLanguage !== recording?.language ? (await window.electronAPI.tapeOverridesGet?.(recId, textLanguage)) ?? [] : []
      const pol = (await window.electronAPI.tapeSettingsGet?.())?.mismatchPolicy
      if (!alive) return
      setBaseMap(m as SyncMap | null)
      setOwnMap(!!own)
      setOverridesState(ov)
      setPolicy(pol ?? 'ask')
      setChoiceState(readChoice(recId, textLanguage))
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recId, textLanguage, mapVersion])

  // the map as it applies to THIS text: the overrides lined up, and the operator's / the setting's answer to a mismatch
  const mapped = useMemo(() => (baseMap ? { ...baseMap, marks: applyOverrides(baseMap.marks, overrides) } : null), [baseMap, overrides])
  const foreign = !!recording && !ownMap && textLanguage !== recording.language
  const agreement: Agreement | null = useMemo(() => (mapped && textNumbers && textNumbers.length ? checkAgreement(textNumbers, mapped.marks) : null), [mapped, textNumbers])
  const decision: MismatchDecision = agreement && foreign ? decideUse(policy, agreement, choice) : 'use'
  const map = decision === 'never' ? null : mapped
  const choose = useCallback((c: 'matching' | 'never' | null) => {
    setChoiceState(c)
    try { if (c) localStorage.setItem(choiceKey(recId ?? '', textLanguage), c); else localStorage.removeItem(choiceKey(recId ?? '', textLanguage)) } catch { /* a convenience only */ }
  }, [recId, textLanguage])
  const saveOverrides = useCallback(async (rows: Override[]) => {
    if (!recId) return
    const saved = (await window.electronAPI.tapeOverridesSet?.(recId, textLanguage, rows)) ?? rows
    setOverridesState(saved)
  }, [recId, textLanguage])

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
  return { wire, pos, mine, map, rawMap: baseMap, agreement: foreign ? agreement : null, decision, choose, overrides, saveOverrides, foreign, here, starts, follow, setFollow, jumpTo, jumpToParagraph, undoJump, prevParagraph, nextParagraph, command, load }
}
