import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SyncMap, TapeRecording } from '../../shared/tape'
import { screenItemsOf } from '../../shared/tapeParagraphs'
import { clampLead, tapeScreenView, type TapePalette, type TapeScreenItem, type TapeScreenMode, type TapeScreenSpec } from '../../shared/tapeScreen'
import type { LiveChannel, SlidePayload } from './types'
import { useTape } from './useTape'

type Mode = Extract<TapeScreenMode, 'highlight' | 'one'>

/**
 * The tape on the screens: is it up now, how it looks, putting it up, pinning it ("Screens follow the tape" off), changing how it looks (which waits for
 * Apply while it is up) and taking it off. One hook for every place that offers it (the bottom bar, the Tape place). Nothing here starts sound or moves the
 * tape, and nothing changes what is live except the operator's own button.
 */
export function useTapeScreen(o: {
  recording: TapeRecording | null
  sermonId: number | null
  title: string
  map: SyncMap | null
  /** the language of the TEXT shown on the screens (the tape keeps its own) */
  textLanguage?: string
  /** supply the screen items directly (the reader already has them); otherwise they are fetched */
  items?: TapeScreenItem[]
  position?: number
  onTaken?: (item: TapeScreenItem | null) => void
}) {
  const { recording, sermonId, title, map, textLanguage = 'en', onTaken } = o
  const { wire, pos } = useTape(500)
  const [mode, setMode] = useState<Mode>('highlight')
  const [lead, setLead] = useState(4)
  const [palette, setPalette] = useState<TapePalette>('dark')
  const [live, setLive] = useState<TapeScreenSpec | null>(null)
  const [fetched, setFetched] = useState<{ key: string; items: TapeScreenItem[] } | null>(null)

  useEffect(() => {
    void window.electronAPI.tapeSettingsGet?.()?.then((s) => { setLead(clampLead(s.leadSec)); setMode(s.view === 'single' ? 'one' : 'highlight') })
  }, [])
  // is a tape screen of THIS recording on the congregation screen right now?
  useEffect(() => {
    const apply = (chs: LiveChannel[]): void => {
      const c = chs.find((x) => x.id === 'main') ?? chs[0]
      const t = c && !c.blanked ? c.current?.tape ?? null : null
      setLive(t && recording && t.recordingId === recording.id ? t : null)
    }
    void window.electronAPI.getLiveState?.()?.then(apply)
    return window.electronAPI.onLiveChanged?.(apply)
  }, [recording?.id])

  // the sermon's numbered paragraphs, fetched only when they were not handed in
  const key = `${sermonId}|${textLanguage}`
  useEffect(() => {
    if (o.items || sermonId === null) return
    let alive = true
    void window.electronAPI.getSermonParagraphs?.(sermonId, textLanguage)?.then((rows) => { if (alive) setFetched({ key, items: screenItemsOf(rows) }) })
    return () => { alive = false }
  }, [key, sermonId, textLanguage, o.items])
  const items = useMemo(() => o.items ?? (fetched && fetched.key === key ? fetched.items : []), [o.items, fetched, key])
  const position = o.position ?? (wire && recording && wire.recordingId === recording.id ? pos : 0)
  const ready = !!map && items.length > 0

  const spec = useCallback((over: Partial<TapeScreenSpec> = {}): TapeScreenSpec | null => {
    if (!recording || !map || items.length === 0 || sermonId === null) return null
    return { v: 1, recordingId: recording.id, sermonId, title, mode, leadSec: lead, palette, pinned: null, items, marks: map.marks.map((m) => ({ n: m.n, t: m.t, kind: m.kind })), regions: map.regions, ...over }
  }, [recording, map, items, sermonId, title, mode, lead, palette])

  const send = (s: TapeScreenSpec): TapeScreenItem | null => {
    const v = tapeScreenView(s, position)
    const text = v.index !== null ? items[v.index].text : title
    const payload: SlidePayload = { kind: 'quote', text, label: title, marker: v.shown !== null ? String(v.shown) : undefined, tape: s }
    window.electronAPI.showSlide(payload)
    window.electronAPI.updateStage(payload, null)
    return v.index !== null ? items[v.index] : null
  }
  const take = (): void => { const s = spec(); if (!s) return; const item = send(s); onTaken?.(item) }
  const changed = !!live && (live.mode !== mode || (mode === 'one' && live.leadSec !== lead) || (live.palette ?? 'dark') !== palette)
  const apply = (): void => { if (live) { const s = spec({ pinned: live.pinned }); if (s) send(s) } }
  const follows = live ? live.pinned === null : true
  const toggleFollow = (): void => {
    if (!live) return
    const shown = tapeScreenView(live, position).shown
    const s = spec({ pinned: follows ? shown : null })
    if (s) send(s)
  }
  const takeOff = (): void => window.electronAPI.clearProjection()
  const chooseMode = (m: Mode): void => { setMode(m); void window.electronAPI.tapeSettingsSet?.({ view: m === 'one' ? 'single' : 'highlight' }) }
  const chooseLead = (n: number): void => { const v = clampLead(n); setLead(v); void window.electronAPI.tapeSettingsSet?.({ leadSec: v }) }
  return { live, onScreens: !!live, follows, mode, chooseMode, lead, chooseLead, palette, setPalette, changed, ready, items, take, apply, toggleFollow, takeOff }
}
