import { useCallback, useEffect, useMemo, useState } from 'react'
import { MonitorPlay, MonitorOff } from 'lucide-react'
import type { SyncMap, TapeRecording } from '../../../shared/tape'
import { clampLead, tapeScreenView, type TapePalette, type TapeScreenItem, type TapeScreenMode, type TapeScreenSpec } from '../../../shared/tapeScreen'
import type { LiveChannel, SlidePayload } from '../types'
import './TapeScreenControls.css'

type Mode = Extract<TapeScreenMode, 'highlight' | 'one'>
const MODE_LABEL: Record<Mode, string> = { highlight: 'Highlight', one: 'One at a time' }

/**
 * Put the sermon on the congregation screen as a TAPE screen (the paragraph being spoken follows the tape), choose how it looks, and decide whether the
 * screens follow the tape. Nothing here starts sound or moves the tape. Taking is an explicit button — nothing changes what is live by itself.
 */
export default function TapeScreenControls({ recording, sermonId, title, items, map, position }: {
  recording: TapeRecording
  sermonId: number
  title: string
  items: TapeScreenItem[]
  map: SyncMap | null
  /** the tape's position right now (to say what is on the screen when it is taken) */
  position: number
}): JSX.Element | null {
  const [mode, setMode] = useState<Mode>('highlight')
  const [lead, setLead] = useState(4)
  const [palette, setPalette] = useState<TapePalette>('dark')
  const [live, setLive] = useState<TapeScreenSpec | null>(null)

  useEffect(() => {
    void window.electronAPI.tapeSettingsGet?.()?.then((s) => { setLead(clampLead(s.leadSec)); setMode(s.view === 'single' ? 'one' : 'highlight') })
  }, [])

  // is a tape screen of THIS recording on the congregation screen right now?
  useEffect(() => {
    const apply = (chs: LiveChannel[]): void => {
      const c = chs.find((x) => x.id === 'main') ?? chs[0]
      const t = c && !c.blanked ? c.current?.tape ?? null : null
      setLive(t && t.recordingId === recording.id ? t : null)
    }
    void window.electronAPI.getLiveState?.()?.then(apply)
    return window.electronAPI.onLiveChanged?.(apply)
  }, [recording.id])

  const spec = useCallback((over: Partial<TapeScreenSpec> = {}): TapeScreenSpec | null => {
    if (!map || items.length === 0) return null
    return {
      v: 1, recordingId: recording.id, sermonId, title, mode, leadSec: lead, palette, pinned: null, items,
      marks: map.marks.map((m) => ({ n: m.n, t: m.t, kind: m.kind })), regions: map.regions, ...over
    }
  }, [map, items, recording.id, sermonId, title, mode, lead, palette])

  const send = (s: TapeScreenSpec): void => {
    const v = tapeScreenView(s, position)
    const text = v.index !== null ? items[v.index].text : title
    const payload: SlidePayload = { kind: 'quote', text, label: title, marker: v.shown !== null ? String(v.shown) : undefined, tape: s }
    window.electronAPI.showSlide(payload)
    window.electronAPI.updateStage(payload, null)
  }
  const take = (): void => { const s = spec(); if (s) send(s) }
  // choosing how it looks never changes the screens by itself: while it is up, a change waits for "Apply to the screens"
  const changed = !!live && (live.mode !== mode || (mode === 'one' && live.leadSec !== lead) || (live.palette ?? 'dark') !== palette)
  const apply = (): void => { if (live) { const s = spec({ pinned: live.pinned }); if (s) send(s) } }
  const follows = live ? live.pinned === null : true
  const toggleFollow = (): void => {
    if (!live) return
    // turning it off holds the paragraph that is up now; turning it on snaps to the tape
    const shown = tapeScreenView(live, position).shown
    const s = spec({ pinned: follows ? shown : null })
    if (s) send(s)
  }

  if (!map) return null
  return (
    <div className="tape-screen-row" role="group" aria-label="Tape on the screens">
      <div className="tse-seg" role="radiogroup" aria-label="How the screens show the tape">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => { setMode(m); void window.electronAPI.tapeSettingsSet?.({ view: m === 'one' ? 'single' : 'highlight' })  }}>{MODE_LABEL[m]}</button>
        ))}
      </div>
      {mode === 'one' && (
        <label className="tape-screen-lead" title="Show the next paragraph this long before the speaker reaches it">
          Next early <select value={lead} onChange={(e) => { const v = clampLead(Number(e.target.value)); setLead(v); void window.electronAPI.tapeSettingsSet?.({ leadSec: v })  }} aria-label="Show the next paragraph early, seconds">
            {[0, 2, 4, 6, 8, 10].map((n) => <option key={n} value={n}>{n === 0 ? 'off' : `${n} s`}</option>)}
          </select>
        </label>
      )}
      <label className="tape-screen-lead">
        Colours <select value={palette} onChange={(e) => { const v = e.target.value as TapePalette; setPalette(v) }} aria-label="Screen colours">
          <option value="dark">Dark</option><option value="light">Light</option><option value="contrast">High contrast</option>
        </select>
      </label>
      {live ? (
        <>
          <button className={`tape-toggle${follows ? ' on' : ''}`} role="switch" aria-checked={follows} onClick={toggleFollow} title="When off, the screens stay on this paragraph while the tape and the reader move on">
            <i aria-hidden="true" /> Screens follow the tape
          </button>
          {changed && <button className="btn-primary btn-sm" onClick={apply}>Apply to the screens</button>}
          <button className="btn-secondary btn-sm" onClick={() => window.electronAPI.clearProjection()}><MonitorOff width={13} height={13} aria-hidden="true" /> Take off the screens</button>
        </>
      ) : (
        <button className="btn-primary btn-sm" onClick={take}><MonitorPlay width={13} height={13} aria-hidden="true" /> Put on the screens</button>
      )}
    </div>
  )
}

/** The reader's flat list as screen items (numbered paragraphs only). */
export function screenItems(flat: Array<{ marker: string; text: string }>, baseNumber: (m: string) => number | null): TapeScreenItem[] {
  const out: TapeScreenItem[] = []
  for (const f of flat) {
    const n = baseNumber(f.marker)
    if (n !== null && f.text.trim()) out.push({ n, marker: f.marker, text: f.text })
  }
  return out
}
export const useScreenItems = (flat: Array<{ marker: string; text: string }>, baseNumber: (m: string) => number | null): TapeScreenItem[] => useMemo(() => screenItems(flat, baseNumber), [flat, baseNumber])
