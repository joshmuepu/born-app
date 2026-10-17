import { useEffect, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw } from 'lucide-react'
import { formatTapeTime } from '../../../shared/tape'
import { TAPE_SPEEDS, tapeStatusNote } from '../../../shared/tapePlayback'
import type { TapeRecording } from '../../../shared/tape'
import { useTape } from '../useTape'
import { TapeOutputMenu, TapeSeek, TapeVolume } from './TapeControls'
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
  const [seeking, setSeeking] = useState<number | null>(null)

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
  return (
    <div className={`tape-bar${err ? ' tape-bar--err' : ''}`} role="group" aria-label="Tape controls">
      <div className="tape-bar-row">
        <span className="tape-time" aria-label="Time played">{formatTapeTime(shown)}</span>
        <TapeSeek dur={dur} shown={shown} starts={paragraphStarts} onScrub={setSeeking} onCommit={seekTo} />
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

        <TapeVolume wire={wire} mine={mine} command={command} />

        <TapeOutputMenu wire={wire} mine={mine} />
      </div>
      {(note || hint) && <div className={`tape-note-line${err || (mine && wire!.stalled) ? ' is-warn' : ''}`} role="status">{note ?? hint}</div>}
    </div>
  )
}
