import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX, Speaker, Check } from 'lucide-react'
import { formatTapeTime } from '../../../shared/tape'
import type { TapeWire } from '../../../shared/tapePlayback'

/** The seek slider with a tick at every paragraph start. Scrubbing shows the target time; the tape moves only when the pointer is released. */
export function TapeSeek({ dur, shown, starts, onScrub, onCommit }: {
  dur: number
  shown: number
  starts: number[]
  onScrub?: (t: number | null) => void
  onCommit: (t: number) => void
}): JSX.Element {
  const barRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null)
  const [scrub, setScrub] = useState<number | null>(null)
  const at = scrub ?? shown
  const timeAt = (clientX: number): number => {
    const r = barRef.current!.getBoundingClientRect()
    return Math.max(0, Math.min(dur, ((clientX - r.left) / Math.max(1, r.width)) * dur))
  }
  const set = (t: number | null): void => { setScrub(t); onScrub?.(t) }
  return (
    <div
      ref={barRef}
      className="tape-seek"
      role="slider"
      tabIndex={0}
      aria-label="Position in the tape"
      aria-valuemin={0}
      aria-valuemax={Math.round(dur)}
      aria-valuenow={Math.round(at)}
      aria-valuetext={`${formatTapeTime(at)} of ${formatTapeTime(dur)}`}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); set(timeAt(e.clientX)) }}
      onPointerMove={(e) => { const t = timeAt(e.clientX); setHover({ x: e.clientX - barRef.current!.getBoundingClientRect().left, t }); if (scrub !== null) set(t) }}
      onPointerUp={(e) => { if (scrub !== null) { onCommit(timeAt(e.clientX)); set(null) } }}
      onPointerLeave={() => setHover(null)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 30 : 5
        if (e.key === 'ArrowRight') { e.preventDefault(); onCommit(Math.min(dur, at + step)) }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); onCommit(Math.max(0, at - step)) }
        else if (e.key === 'Home') { e.preventDefault(); onCommit(0) }
        else if (e.key === 'End') { e.preventDefault(); onCommit(Math.max(0, dur - 1)) }
      }}
    >
      <div className="tape-seek-track" />
      {starts.map((t, i) => <i key={i} className="tape-tick" style={{ left: `${(t / dur) * 100}%` }} aria-hidden="true" />)}
      <div className="tape-seek-fill" style={{ width: `${(at / dur) * 100}%` }} />
      <div className="tape-seek-head" style={{ left: `${(at / dur) * 100}%` }} />
      {hover && <span className="tape-seek-tip" style={{ left: hover.x }}>{formatTapeTime(hover.t)}</span>}
    </div>
  )
}

/** Mute button + volume slider. */
export function TapeVolume({ wire, mine, command, slider = true }: { wire: TapeWire | null; mine: boolean; command: (a: { type: 'muted'; value: boolean } | { type: 'volume'; value: number }) => void; slider?: boolean }): JSX.Element {
  return (
    <div className="tape-vol">
      <button className="tape-ico" onClick={() => command({ type: 'muted', value: !(mine && wire!.muted) })} disabled={!mine} aria-label={mine && wire!.muted ? 'Unmute' : 'Mute'}>
        {mine && wire!.muted ? <VolumeX width={16} height={16} aria-hidden="true" /> : <Volume2 width={16} height={16} aria-hidden="true" />}
      </button>
      {slider && <input type="range" min={0} max={100} value={Math.round((mine ? wire!.volume : 1) * 100)} disabled={!mine} aria-label="Volume" onChange={(e) => command({ type: 'volume', value: Number(e.target.value) / 100 })} />}
    </div>
  )
}

/** Where the sound comes out: the current output as a chip that opens the list of outputs. `open`/`onOpenChange` let a fix button open it. */
export function TapeOutputMenu({ wire, mine, compact = false, open, onOpenChange }: { wire: TapeWire | null; mine: boolean; compact?: boolean; open?: boolean; onOpenChange?: (o: boolean) => void }): JSX.Element {
  const [inner, setInner] = useState(false)
  const devOpen = open ?? inner
  const setDevOpen = (o: boolean): void => { setInner(o); onOpenChange?.(o) }
  const [devices, setDevices] = useState<Array<{ id: string; label: string }>>([])
  // the list is read every time the menu opens (whether the chip or a fix button opened it)
  useEffect(() => {
    if (!devOpen) return
    let alive = true
    void Promise.resolve(window.electronAPI.tapeDevices?.()).then((d) => { if (alive) setDevices(d ?? []) })
    return () => { alive = false }
  }, [devOpen])
  const toggle = (): void => setDevOpen(!devOpen)
  const label = mine && wire!.deviceLabel ? wire!.deviceLabel : 'System default'
  return (
    <div className="tape-dev">
      <button className="tape-chipbtn" onClick={toggle} aria-haspopup="listbox" aria-expanded={devOpen} title={`Where the sound comes out: ${label}`} aria-label={compact ? `Sound output: ${label}` : undefined}>
        <Speaker width={14} height={14} aria-hidden="true" />{compact ? <span className="tape-chip-text"> {label}</span> : <> {label}</>}
      </button>
      {devOpen && (
        <ul className="tape-menu" role="listbox" aria-label="Sound output">
          <li role="option" aria-selected={!mine || !wire!.deviceId}><button onClick={() => { void window.electronAPI.tapeSetDevice('', ''); setDevOpen(false) }}>{(!mine || !wire!.deviceId) && <Check width={13} height={13} aria-hidden="true" />} System default</button></li>
          {devices.filter((d) => d.id !== 'default').map((d, i) => (
            <li key={d.id} role="option" aria-selected={mine && wire!.deviceId === d.id}>
              <button onClick={() => { void window.electronAPI.tapeSetDevice(d.id, d.label || `Output ${i + 1}`); setDevOpen(false) }}>{mine && wire!.deviceId === d.id && <Check width={13} height={13} aria-hidden="true" />} {d.label || `Output ${i + 1}`}</button>
            </li>
          ))}
          {devices.length === 0 && <li className="tape-menu-note">No other outputs found.</li>}
        </ul>
      )}
    </div>
  )
}
