import { useEffect, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw, Headphones, MonitorPlay, MonitorOff, AlertTriangle } from 'lucide-react'
import { formatTapeTime } from '../../../shared/tape'
import { tapeStatusNote } from '../../../shared/tapePlayback'
import { useTapeNow } from '../useTapeNow'
import { timingOf, useTimingState } from '../tapeBus'
import { useTapeScreen } from '../useTapeScreen'
import { setTapeActions } from '../tapeActions'
import { useTapeHint } from '../tapeHint'
import type { LiveChannel } from '../types'
import { TapeOutputMenu, TapeSeek, TapeVolume } from './TapeControls'
import './TapeBar.css'
import './GlobalTapeBar.css'

/** The words and colour for the one status pill. Always words — colour is only a second signal. */
export function tapeBarState(o: { status: string; stalled: boolean; errorKind: string | null; pausedBy: string | null; hasTiming: boolean; inGap: boolean; inDiffers: boolean; timing?: { pct: number } | 'queued' | null }): { label: string; tone: 'ok' | 'warn' | 'bad' } {
  if (o.status === 'error' || o.errorKind === 'device') return { label: o.errorKind === 'device' ? 'Output lost' : 'Problem', tone: 'bad' }
  if (o.stalled) return { label: 'Sound stopped', tone: 'warn' }
  if (o.status === 'paused' && o.pausedBy === 'video') return { label: 'Paused for video', tone: 'warn' }
  if (o.status === 'paused' && o.pausedBy === 'device') return { label: 'Output lost', tone: 'bad' }
  if (!o.hasTiming && o.timing) return { label: o.timing === 'queued' ? 'Timing soon' : `Timing… ${o.timing.pct}%`, tone: 'warn' }
  if (!o.hasTiming) return { label: 'No timing', tone: 'warn' }
  if (o.inDiffers) return { label: 'Tape differs here', tone: 'warn' }
  if (o.inGap) return { label: 'No text here', tone: 'ok' }
  return { label: 'In sync', tone: 'ok' }
}

/**
 * The "Now playing" bar (mockups 13 and 18): one compact row at the bottom of EVERY section, shown whenever a tape is loaded. Play lives here (and in the
 * Tape place) — never next to Take / Project. It shows what the audio engine really reports, with the one button that fixes a problem.
 */
export default function GlobalTapeBar({ onOpenTape, pushToast, embedded = false }: { /** inside the Now dock: no strip of its own */ embedded?: boolean; onOpenTape: (sermonId: number) => void; pushToast?: (t: { message: string; actionLabel?: string; onAction?: () => void; timeoutMs?: number }) => void }): JSX.Element | null {
  const n = useTapeNow()
  const timingState = useTimingState()
  const { wire, rec } = n
  const screen = useTapeScreen({ recording: rec, sermonId: wire?.sermonId ?? null, title: rec?.file.name ?? '', map: n.map })
  const [devOpen, setDevOpen] = useState(false)
  const hint = useTapeHint('bar')

  // the keyboard and the command palette do exactly what these buttons do
  const loaded = !!wire && !!rec
  const latest = useRef({ n, screen })
  latest.current = { n, screen }
  useEffect(() => {
    if (!loaded) { setTapeActions(null); return }
    setTapeActions({
      toggle: () => latest.current.n.command({ type: 'toggle' }),
      back: () => latest.current.n.command({ type: 'skip', by: -10 }),
      forward: () => latest.current.n.command({ type: 'skip', by: 10 }),
      prevParagraph: () => latest.current.n.prevParagraph(),
      nextParagraph: () => latest.current.n.nextParagraph(),
      screens: () => { const sc = latest.current.screen; if (sc.onScreens) sc.takeOff(); else sc.take() },
      onScreens: () => latest.current.screen.onScreens
    })
    return () => setTapeActions(null)
  }, [loaded])

  // something else was taken while the tape's text was on the screens: say so (the tape keeps playing), and offer the way back
  const wasOnScreens = useRef(false)
  const tapeRecId = rec?.id ?? null
  useEffect(() => {
    if (!tapeRecId) return
    const apply = (chs: LiveChannel[]): void => {
      const c = chs.find((x) => x.id === 'main') ?? chs[0]
      const cur = c && !c.blanked ? c.current : null
      const onTape = !!cur?.tape && cur.tape.recordingId === tapeRecId
      if (wasOnScreens.current && !onTape && cur) {
        pushToast?.({ message: 'Something else is on the screens, so the tape’s text is off them. The tape keeps playing.', actionLabel: 'Back to the tape text', onAction: () => latest.current.screen.take(), timeoutMs: 12000 })
      }
      wasOnScreens.current = onTape
    }
    void window.electronAPI.getLiveState?.()?.then((chs) => { const c = chs.find((x) => x.id === 'main') ?? chs[0]; wasOnScreens.current = !!(c && !c.blanked && c.current?.tape?.recordingId === tapeRecId) })
    return window.electronAPI.onLiveChanged?.(apply)
  }, [tapeRecId, pushToast])

  if (!wire || !rec) return null

  const playing = wire.status === 'playing'
  const busy = wire.status === 'loading'
  const dur = wire.duration ?? rec.file.durationSec
  const left = Math.max(0, dur - n.pos)
  const st = tapeBarState({ status: wire.status, stalled: wire.stalled, errorKind: wire.errorKind, pausedBy: wire.pausedBy, hasTiming: n.hasTiming, inGap: !!n.here?.inGap, inDiffers: !!n.here?.inDiffers, timing: timingOf(timingState, wire.recordingId) })
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
    <div className={`gtb${embedded ? ' gtb--embedded' : ''}${st.tone === 'bad' ? ' gtb--bad' : ''}`} role="group" aria-label="Tape player">
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
          title={screen.onScreens ? 'The tape’s text is on the screens — click to remove it' : n.hasTiming ? 'Show the tape’s text on the screens' : 'This tape has no timing yet, so its text cannot follow it'}
        >
          {screen.onScreens ? <MonitorOff width={14} height={14} aria-hidden="true" /> : <MonitorPlay width={14} height={14} aria-hidden="true" />}
          <span className="gtb-screens-text">{screen.onScreens ? 'Text on the screens' : 'Text: not on the screens'}</span>
        </button>
      </div>
      {hint.show && !warn && (
        <div className="gtb-hint" role="note">
          <span><b>The tape player.</b> It stays here in every section, so you can pause the tape while you run songs or verses. Click the title to open the Tape place. Play and pause from anywhere with <span className="gtb-keys"><kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd></span>.</span>
          <button className="btn-quiet btn-sm" onClick={hint.dismiss}>Got it</button>
        </div>
      )}
      {warn && (
        <div className="gtb-note" role="alert"><AlertTriangle width={14} height={14} aria-hidden="true" /> <span>{note}</span> {fix()}</div>
      )}
    </div>
  )
}
