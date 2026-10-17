import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { formatSince, liveSummary } from '../liveSummary'
import { useLiveState } from './PreviewLivePair'
import { TERMS } from '../../../shared/glossary'
import './NowDock.css'

/**
 * The "Now" dock (P-05): ONE strip at the bottom of every section that answers "what is on the screens right now?" before anything else.
 *   left   — LIVE: the item, since when, and Hide screen / Show screen (red outline while live, amber while hidden, grey when nothing is on)
 *   middle — the tape (the "Now playing" bar, when a tape is loaded)
 *   right  — status: screens, stage monitor, queue count, app info
 * A second thin line appears only when something needs saying (the sermon library updating, a data problem).
 */
export default function NowDock({
  projectionOpen,
  stageOpen,
  blanked,
  onToggleBlank,
  displays,
  queueCount,
  tape,
  tapeLoaded,
  info,
  notice
}: {
  projectionOpen: boolean
  stageOpen: boolean
  blanked: boolean
  onToggleBlank: () => void
  displays: number | null
  queueCount: number
  tape: JSX.Element
  /** a tape is loaded (the dock then keeps its status chips to dots) */
  tapeLoaded: boolean
  info: JSX.Element
  notice: JSX.Element | null
}): JSX.Element {
  const live = useLiveState()
  const main = live.find((c) => c.id === 'main')
  const sum = liveSummary(main, projectionOpen, blanked)
  // how long the current item has been on: restarts whenever the item changes
  const key = sum.state === 'live' || sum.state === 'hidden' ? `${sum.state}|${sum.title}|${main?.current?.text ?? ''}` : sum.state
  const since = useRef(Date.now())
  const lastKey = useRef(key)
  if (lastKey.current !== key) { lastKey.current = key; since.current = Date.now() }
  const [, tick] = useState(0)
  useEffect(() => {
    if (sum.state !== 'live') return
    const t = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [sum.state])

  const hasTape = tapeLoaded
  const label =
    sum.state === 'live' ? sum.title :
    sum.state === 'hidden' ? 'Screen hidden' :
    sum.state === 'empty' ? 'Nothing on screen' : 'Screens are off'
  const sub =
    sum.state === 'live' ? `On air · ${formatSince(Date.now() - since.current)}` :
    sum.state === 'hidden' ? (sum.title ? `Kept: ${sum.title}` : 'The screens are black') :
    sum.state === 'empty' ? 'Screens on · ready' : 'Open projection to start'

  return (
    <footer className={`now-dock${hasTape ? ' now-dock--tape' : ''}`} aria-label="Now">
      <div className="nd-main">
        <div className={`nd-live nd-live--${sum.state}`} role="status" aria-live="polite">
          <span className="nd-dot" aria-hidden="true" />
          <div className="nd-live-text">
            <b className="nd-live-title" title={label}>{label}</b>
            <small>{sub}</small>
          </div>
          {projectionOpen && (
            <button type="button" className="btn-secondary btn-sm nd-hide" onClick={onToggleBlank} title="Black out the congregation screen (Esc)">
              {blanked ? <Eye width={13} height={13} strokeWidth={2.2} aria-hidden="true" /> : <EyeOff width={13} height={13} strokeWidth={2.2} aria-hidden="true" />}
              {blanked ? TERMS.showScreen : TERMS.hideScreen}
            </button>
          )}
        </div>
        <div className="nd-tape">{tape}</div>
        <div className="nd-status">
          <span className="nd-chip" title={displays === null ? undefined : `${displays} display${displays === 1 ? '' : 's'} connected`}>
            <span className={`nd-chip-dot${projectionOpen ? ' is-ok' : ''}`} aria-hidden="true" />
            <span className="nd-chip-label">Screens{displays !== null ? ` ${displays}` : ''}</span>
          </span>
          {stageOpen && <span className="nd-chip" title="Stage monitor is on"><span className="nd-chip-dot is-ok" aria-hidden="true" /><span className="nd-chip-label">Stage</span></span>}
          <span className="nd-chip nd-chip--count">{queueCount} in queue</span>
          {info}
        </div>
      </div>
      {notice && <div className="nd-notice">{notice}</div>}
    </footer>
  )
}
