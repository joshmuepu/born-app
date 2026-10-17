import { formatTapeTime } from '../../../shared/tape'
import { tapeScreenView, type TapeScreenSpec } from '../../../shared/tapeScreen'
import { useTape } from '../useTape'
import './StageTape.css'

/**
 * The stage monitor while a tape runs (docs/design/sermon-audio/02 §1.5): time and time left, a bar, what is being spoken now and what comes next with its
 * countdown, and one plain word for what the tape is doing. Large and calm — it is read from across a platform.
 */
export default function StageTape({ spec }: { spec: TapeScreenSpec }): JSX.Element {
  const { wire, pos } = useTape(250)
  const mine = !!wire && wire.recordingId === spec.recordingId
  const p = mine ? pos : 0
  const view = tapeScreenView({ ...spec, mode: 'highlight', pinned: null }, p)
  const dur = mine && wire ? wire.duration : null
  const left = dur !== null ? Math.max(0, dur - p) : null
  const now = view.speaking !== null ? spec.items.find((i) => i.n === view.speaking) : null
  const nextItem = view.next ? spec.items.find((i) => i.n === view.next!.n) : null
  const state = !mine || !wire ? 'Tape not started' : wire.status === 'error' ? 'Problem with the tape' : wire.stalled ? 'Sound has stopped moving' : wire.status === 'ended' ? 'Tape finished' : wire.status === 'playing' ? 'Playing' : 'Paused'
  const bad = !mine || !wire || wire.status === 'error' || wire.stalled
  return (
    <div className="stagetape" role="status" aria-label="Tape">
      <div className="stagetape-times">
        <span className="stagetape-elapsed">{formatTapeTime(p)}</span>
        <span className={`stagetape-pill${bad ? ' is-bad' : wire?.status === 'playing' ? ' is-ok' : ''}`}>{state}</span>
        <span className="stagetape-left">{left !== null ? `−${formatTapeTime(left)}` : ''}</span>
      </div>
      <div className="stagetape-bar" aria-hidden="true"><i style={{ width: dur ? `${Math.min(100, (p / dur) * 100)}%` : '0%' }} /></div>
      <div className="stagetape-now">
        <div className="stagetape-cap">NOW {view.speaking !== null ? `¶${view.speaking}` : ''}</div>
        <p className="stagetape-text" dir="auto">{now ? now.text : mine ? '…' : spec.title}</p>
      </div>
      {view.next && (
        <div className="stagetape-next">
          <div className="stagetape-cap">NEXT ¶{view.next.n} <b>in {formatTapeTime(view.next.inSec)}</b></div>
          <p className="stagetape-text stagetape-text--next" dir="auto">{nextItem ? nextItem.text : ''}</p>
        </div>
      )}
    </div>
  )
}
