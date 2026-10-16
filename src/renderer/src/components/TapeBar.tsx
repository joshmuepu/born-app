import { useEffect, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw, Volume2, VolumeX, Speaker, Check } from 'lucide-react'
import { formatTapeTime } from '../../../shared/tape'
import { TAPE_SPEEDS, tapeStatusNote } from '../../../shared/tapePlayback'
import type { TapeRecording } from '../../../shared/tape'
import { useTape } from '../useTape'
import './TapeBar.css'

/**
 * The tape's player bar (mockup 01): play/pause, back/forward 10 s, previous/next paragraph, speed, volume, where the sound comes out,
 * time and time left, and a seek bar with a tick at every paragraph start. It shows what the audio engine REALLY reports, never what was
 * asked for. Nothing here plays by itself: a loaded tape waits until Play is pressed.
 */
export default function TapeBar({
  recording,
  paragraphStarts = [],
  onPrevParagraph,
  onNextParagraph,
  hint
}: {
  recording: TapeRecording
  /** seconds at which each timed paragraph starts (from the sync map) — drawn as ticks */
  paragraphStarts?: number[]
  onPrevParagraph?: () => void
  onNextParagraph?: () => void
  hint?: string | null
}): JSX.Element {
  const { wire, pos, command, load } = useTape()
  const mine = !!wire && wire.recordingId === recording.id
  const dur = mine && wire!.duration ? wire!.duration : recording.file.durationSec
  const playing = mine && wire!.status === 'playing'
  const [speeds, setSpeeds] = useState<number[]>(TAPE_SPEEDS.wide)
  const [devOpen, setDevOpen] = useState(false)
  const [devices, setDevices] = useState<Array<{ id: string; label: string }>>([])
  const [seeking, setSeeking] = useState<number | null>(null)
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => { void window.electronAPI.tapeSettingsGet?.()?.then((s) => setSpeeds(TAPE_SPEEDS[s.speedRange] ?? TAPE_SPEEDS.wide)) }, [])

  const shown = seeking ?? (mine ? pos : 0)
  const left = Math.max(0, dur - shown)
  const note = mine ? tapeStatusNote(wire!) : null
  const err = mine && (wire!.status === 'error' || wire!.errorKind === 'device')
  const busy = mine && wire!.status === 'loading'

  const toggle = (): void => {
    if (!mine) void load(recording.id, { play: true })
    else command({ type: 'toggle' })
  }
  const seekTo = (t: number): void => {
    if (!mine) void load(recording.id, { position: t })
    else command({ type: 'seek', to: t })
  }
  const timeAt = (clientX: number): number => {
    const r = barRef.current!.getBoundingClientRect()
    return Math.max(0, Math.min(dur, ((clientX - r.left) / r.width) * dur))
  }
  const openDevices = async (): Promise<void> => {
    setDevOpen((o) => !o)
    setDevices((await window.electronAPI.tapeDevices?.()) ?? [])
  }

  return (
    <div className={`tape-bar${err ? ' tape-bar--err' : ''}`} role="group" aria-label="Tape controls">
      <div className="tape-bar-row">
        <span className="tape-time" aria-label="Time played">{formatTapeTime(shown)}</span>
        <div
          ref={barRef}
          className="tape-seek"
          role="slider"
          tabIndex={0}
          aria-label="Position in the tape"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(shown)}
          aria-valuetext={`${formatTapeTime(shown)} of ${formatTapeTime(dur)}`}
          onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setSeeking(timeAt(e.clientX)) }}
          onPointerMove={(e) => { const t = timeAt(e.clientX); setHover({ x: e.clientX - barRef.current!.getBoundingClientRect().left, t }); if (seeking !== null) setSeeking(t) }}
          onPointerUp={(e) => { if (seeking !== null) { seekTo(timeAt(e.clientX)); setSeeking(null) } }}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 30 : 5
            if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(Math.min(dur, shown + step)) }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(Math.max(0, shown - step)) }
            else if (e.key === 'Home') { e.preventDefault(); seekTo(0) }
            else if (e.key === 'End') { e.preventDefault(); seekTo(Math.max(0, dur - 1)) }
          }}
        >
          <div className="tape-seek-track" />
          {paragraphStarts.map((t, i) => <i key={i} className="tape-tick" style={{ left: `${(t / dur) * 100}%` }} aria-hidden="true" />)}
          <div className="tape-seek-fill" style={{ width: `${(shown / dur) * 100}%` }} />
          <div className="tape-seek-head" style={{ left: `${(shown / dur) * 100}%` }} />
          {hover && <span className="tape-seek-tip" style={{ left: hover.x }}>{formatTapeTime(hover.t)}</span>}
        </div>
        <span className="tape-time tape-time--left" aria-label="Time left">−{formatTapeTime(left)}</span>
      </div>

      <div className="tape-bar-row">
        <button className="tape-sk" onClick={onPrevParagraph} disabled={!onPrevParagraph} aria-label="Previous paragraph" title="Previous paragraph ( [ )"><SkipBack width={17} height={17} aria-hidden="true" /></button>
        <button className="tape-sk" onClick={() => (mine ? command({ type: 'skip', by: -10 }) : seekTo(Math.max(0, shown - 10)))} aria-label="Back 10 seconds" title="Back 10 s (←)"><RotateCcw width={17} height={17} aria-hidden="true" /><span>10</span></button>
        <button className="tape-play" onClick={toggle} disabled={busy} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (Space)' : 'Play (Space)'}>
          {playing ? <Pause width={22} height={22} fill="currentColor" aria-hidden="true" /> : <Play width={22} height={22} fill="currentColor" aria-hidden="true" />}
        </button>
        <button className="tape-sk" onClick={() => (mine ? command({ type: 'skip', by: 10 }) : seekTo(shown + 10))} aria-label="Forward 10 seconds" title="Forward 10 s (→)"><span>10</span><RotateCw width={17} height={17} aria-hidden="true" /></button>
        <button className="tape-sk" onClick={onNextParagraph} disabled={!onNextParagraph} aria-label="Next paragraph" title="Next paragraph ( ] )"><SkipForward width={17} height={17} aria-hidden="true" /></button>

        <div className="tape-seg" role="group" aria-label="Speed">
          {speeds.map((s) => (
            <button key={s} className={mine && Math.abs(wire!.speed - s) < 0.001 ? 'on' : (!mine && s === 1) ? 'on' : ''} onClick={() => command({ type: 'speed', value: s })} disabled={!mine} aria-pressed={mine && Math.abs(wire!.speed - s) < 0.001}>{s}×</button>
          ))}
        </div>

        <div className="tape-vol">
          <button className="tape-ico" onClick={() => command({ type: 'muted', value: !(mine && wire!.muted) })} disabled={!mine} aria-label={mine && wire!.muted ? 'Unmute' : 'Mute'}>
            {mine && wire!.muted ? <VolumeX width={16} height={16} aria-hidden="true" /> : <Volume2 width={16} height={16} aria-hidden="true" />}
          </button>
          <input type="range" min={0} max={100} value={Math.round((mine ? wire!.volume : 1) * 100)} disabled={!mine} aria-label="Volume" onChange={(e) => command({ type: 'volume', value: Number(e.target.value) / 100 })} />
        </div>

        <div className="tape-dev">
          <button className="tape-chipbtn" onClick={() => void openDevices()} aria-haspopup="listbox" aria-expanded={devOpen} title="Where the sound comes out">
            <Speaker width={14} height={14} aria-hidden="true" /> {mine && wire!.deviceLabel ? wire!.deviceLabel : 'System default'}
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
      </div>
      {(note || hint) && <div className={`tape-note-line${err || (mine && wire!.stalled) ? ' is-warn' : ''}`} role="status">{note ?? hint}</div>}
    </div>
  )
}
