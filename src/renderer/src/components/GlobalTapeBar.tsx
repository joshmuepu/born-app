import { useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw, Headphones, MonitorPlay, MonitorOff, AlertTriangle } from 'lucide-react'
import { formatTapeTime } from '../../../shared/tape'
import { tapeStatusNote } from '../../../shared/tapePlayback'
import { useTapeNow } from '../useTapeNow'
import { useTapeScreen } from '../useTapeScreen'
import { TapeOutputMenu, TapeSeek, TapeVolume } from './TapeControls'
import './TapeBar.css'
import './GlobalTapeBar.css'

/** The words and colour for the one status pill. Always words — colour is only a second signal. */
export function tapeBarState(o: { status: string; stalled: boolean; errorKind: string | null; pausedBy: string | null; hasTiming: boolean; inGap: boolean; inDiffers: boolean }): { label: string; tone: 'ok' | 'warn' | 'bad' } {
  if (o.status === 'error' || o.errorKind === 'device') return { label: o.errorKind === 'device' ? 'Output lost' : 'Problem', tone: 'bad' }
  if (o.stalled) return { label: 'Sound stopped', tone: 'warn' }
  if (o.status === 'paused' && o.pausedBy === 'video') return { label: 'Paused for video', tone: 'warn' }
  if (o.status === 'paused' && o.pausedBy === 'device') return { label: 'Output lost', tone: 'bad' }
  if (!o.hasTiming) return { label: 'No timing', tone: 'warn' }
  if (o.inDiffers) return { label: 'Tape differs here', tone: 'warn' }
  if (o.inGap) return { label: 'No text here', tone: 'ok' }
  return { label: 'In sync', tone: 'ok' }
}

/**
 * The "Now playing" bar (mockups 13 and 18): one compact row at the bottom of EVERY section, shown whenever a tape is loaded. Play lives here (and in the
 * Tape place) — never next to Take / Project. It shows what the audio engine really reports, with the one button that fixes a problem.
 */
export default function GlobalTapeBar({ onOpenTape }: { onOpenTape: (sermonId: number) => void }): JSX.Element | null {
  const n = useTapeNow()
  const { wire, rec } = n
  const screen = useTapeScreen({ recording: rec, sermonId: wire?.sermonId ?? null, title: rec?.file.name ?? '', map: n.map })
  const [devOpen, setDevOpen] = useState(false)
  if (!wire || !rec) return null

  const playing = wire.status === 'playing'
  const busy = wire.status === 'loading'
  const dur = wire.duration ?? rec.file.durationSec
  const left = Math.max(0, dur - n.pos)
  const st = tapeBarState({ status: wire.status, stalled: wire.stalled, errorKind: wire.errorKind, pausedBy: wire.pausedBy, hasTiming: n.hasTiming, inGap: !!n.here?.inGap, inDiffers: !!n.here?.inDiffers })
  const note = tapeStatusNote(wire)
  const warn = st.tone !== 'ok' && !!note
  const sub = wire.status === 'loading' ? 'Loading…' : wire.status === 'ended' ? 'Finished' : playing ? `Playing${Math.abs(wire.speed - 1) > 0.001 ? ` · ${wire.speed}×` : ''}` : wire.status === 'error' ? 'Stopped' : 'Paused'
  const title = rec.file.name.replace(/^\d{2}-?\d{4}[A-Za-z]?\s*/, '') || rec.file.name

  const fix = (): JSX.Element | null => {
    if (wire.stalled) return <button className="btn-secondary btn-sm" onClick={() => { n.command({ type: 'pause' }); window.setTimeout(() => n.command({ type: 'play' }), 300) }}>Restart the sound</button>
    if (wire.errorKind === 'device' || wire.pausedBy === 'device') return <button className="btn-secondary btn-sm" onClick={() => setDevOpen(true)}>Choose the output…</button>
    if (wire.pausedBy === 'video') return <button className="btn-secondary btn-sm" onClick={() => n.command({ type: 'play' })}>Resume the tape</button>
    return null
  }

  return (
    <div className={`gtb${st.tone === 'bad' ? ' gtb--bad' : ''}`} role="group" aria-label="Tape player">
      <div className="gtb-row">
        <button className="gtb-id" onClick={() => onOpenTape(wire.sermonId)} title="Open the Tape place" aria-label={`Tape: ${title}${n.here?.n != null ? `, paragraph ${n.here.n}` : ''}. Open the Tape place`}>
          <span className="gtb-cap"><Headphones width={12} height={12} aria-hidden="true" /> TAPE {playing && <span className="gtb-eq" aria-hidden="true"><i /><i /><i /></span>}</span>
          <span className="gtb-title">{title}{n.here?.n != null && <> · ¶{n.here.n}</>}</span>
          <span className="gtb-sub">{sub}</span>
        </button>

        <div className="gtb-ctl">
          <button className="tape-sk" onClick={n.prevParagraph} disabled={!n.hasTiming} aria-label="Previous paragraph" title="Previous paragraph ( [ )"><SkipBack width={15} height={15} aria-hidden="true" /></button>
          <button className="tape-sk" onClick={() => n.command({ type: 'skip', by: -10 })} aria-label="Back 10 seconds" title="Back 10 s"><RotateCcw width={15} height={15} aria-hidden="true" /><span>10</span></button>
          <button className="tape-play gtb-play" onClick={() => n.command({ type: 'toggle' })} disabled={busy} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause width={20} height={20} fill="currentColor" aria-hidden="true" /> : <Play width={20} height={20} fill="currentColor" aria-hidden="true" />}
          </button>
          <button className="tape-sk" onClick={() => n.command({ type: 'skip', by: 10 })} aria-label="Forward 10 seconds" title="Forward 10 s"><span>10</span><RotateCw width={15} height={15} aria-hidden="true" /></button>
          <button className="tape-sk" onClick={n.nextParagraph} disabled={!n.hasTiming} aria-label="Next paragraph" title="Next paragraph ( ] )"><SkipForward width={15} height={15} aria-hidden="true" /></button>
        </div>

        <span className="tape-time gtb-time" aria-label="Time played">{formatTapeTime(n.pos)}</span>
        <TapeSeek dur={dur} shown={n.pos} starts={n.starts} onCommit={(t) => n.command({ type: 'seek', to: t })} />
        <span className="tape-time tape-time--left gtb-time" aria-label="Time left">−{formatTapeTime(left)}</span>

        <span className={`gtb-pill gtb-pill--${st.tone}`} role="status">{st.label}</span>
        <TapeVolume wire={wire} mine command={n.command} />
        <TapeOutputMenu wire={wire} mine compact open={devOpen} onOpenChange={setDevOpen} />
        <button
          className={`gtb-screens${screen.onScreens ? ' is-on' : ''}`}
          onClick={() => (screen.onScreens ? screen.takeOff() : screen.take())}
          disabled={!screen.onScreens && !screen.ready}
          title={screen.onScreens ? 'The tape’s text is on the screens — click to take it off' : n.hasTiming ? 'Put the tape’s text on the screens' : 'This tape has no timing yet, so its text cannot follow it'}
        >
          {screen.onScreens ? <MonitorOff width={14} height={14} aria-hidden="true" /> : <MonitorPlay width={14} height={14} aria-hidden="true" />}
          <span className="gtb-screens-text">{screen.onScreens ? 'Text on the screens' : 'Text: not on the screens'}</span>
        </button>
      </div>
      {warn && (
        <div className="gtb-note" role="alert"><AlertTriangle width={14} height={14} aria-hidden="true" /> <span>{note}</span> {fix()}</div>
      )}
    </div>
  )
}
