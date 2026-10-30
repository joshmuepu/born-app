import { useState, useEffect, useRef } from 'react'
import { useAutoFitFontSize } from './useAutoFitFontSize'
import { cleanSourceText } from '../../shared/sourceText'
import type { SlidePayload } from './types'

type View = 'stage' | 'congregation'

/** Wall-clock string like "6:42 PM". */
function useClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 15)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function StageApp() {
  const [current, setCurrent] = useState<SlidePayload | null>(null)
  const [next, setNext] = useState<SlidePayload | null>(null)
  const [blanked, setBlanked] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem('born.stageView') === 'congregation' ? 'congregation' : 'stage'
    } catch {
      return 'stage'
    }
  })
  const clock = useClock()

  useEffect(() => {
    const offUpdate = window.electronAPI.onStageUpdate((data) => {
      setCurrent(data.current)
      setNext(data.next)
      // A new slide arriving means we're live again — clear any stale blackout.
      if (data.current) setBlanked(false)
    })
    const offBlank = window.electronAPI.onStageSetBlank(setBlanked)
    let alertTimer: ReturnType<typeof setTimeout> | null = null
    const offAlert = window.electronAPI.onStageAlert((message) => {
      setAlert(message)
      if (alertTimer) clearTimeout(alertTimer)
      alertTimer = setTimeout(() => setAlert(null), 10000)
    })
    window.electronAPI.notifyStageReady()
    return () => {
      offUpdate()
      offBlank()
      offAlert()
      if (alertTimer) clearTimeout(alertTimer)
    }
  }, [])

  const choose = (v: View): void => {
    setView(v)
    try {
      localStorage.setItem('born.stageView', v)
    } catch {
      /* ignore */
    }
  }

  // The text is fitted to its box like the projector's (it was a fixed size, so a long slide lost lines at both ends). It starts at
  // the size it always had: 4.2% of the screen width in the Stage view, 6% in the Congregation view. It may go a little smaller than
  // the projector's (the Next box takes a third of the Stage view's height).
  const [vw, setVw] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = (): void => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const clampRem = (pct: number, max: number): number => Math.min(Math.max((vw * pct) / 16, 2), max)
  const currentRef = useRef<HTMLDivElement>(null)
  const congregationRef = useRef<HTMLDivElement>(null)
  const showing = !current || blanked ? null : current
  const currentRem = useAutoFitFontSize(currentRef, view === 'stage' ? showing : null, clampRem(0.042, 5), 0.9, 0.3)
  const congregationRem = useAutoFitFontSize(congregationRef, view === 'congregation' ? showing : null, clampRem(0.06, 7), 0.9, 0.3)

  const nothingUp = !current || blanked
  const alertBanner = alert && <div className="stage-alert">{alert}</div>
  // Songs are laid out line-by-line — the platform reads the exact break-up, so
  // the stage screen must preserve it the way the main screen does.
  const preClass = (s: SlidePayload | null): string => (s?.kind === 'song' ? ' is-song' : '')

  return (
    <div className={`stage stage--${view}`}>
      {/* Always-present bar: a large clock the platform can read at a glance, and
          the view switch. */}
      <div className="stage-topbar">
        <div className="stage-clock">{nothingUp ? '' : clock}</div>
        <div className="stage-viewpick" role="tablist" aria-label="What this screen shows">
          <button
            role="tab"
            aria-selected={view === 'stage'}
            className={view === 'stage' ? 'is-active' : ''}
            onClick={() => choose('stage')}
          >
            Stage
          </button>
          <button
            role="tab"
            aria-selected={view === 'congregation'}
            className={view === 'congregation' ? 'is-active' : ''}
            onClick={() => choose('congregation')}
          >
            Congregation
          </button>
        </div>
      </div>

      {/* When nothing is on the projector (including a blackout), the stage
          screen just shows the time — nothing else. */}
      {nothingUp && (
        <div className="stage-bigclock">
          <div className="stage-bigclock-time">{clock}</div>
        </div>
      )}

      {!nothingUp && view === 'congregation' && (
        <div className="stage-congregation" ref={congregationRef} style={{ fontSize: `${congregationRem}rem` }}>
          <div className="stage-fit">
            {current!.label && <div className="stage-cg-label">{current!.label}</div>}
            <div className={`stage-cg-text${preClass(current)}`}>
              {current!.marker && <span className="stage-marker">{current!.marker}</span>}
              {cleanSourceText(current!.text)}
            </div>
            {current!.reference && <div className="stage-cg-ref">{current!.reference}</div>}
          </div>
        </div>
      )}

      {!nothingUp && view === 'stage' && (
        <>
          <div className="stage-current" ref={currentRef} style={{ fontSize: `${currentRem}rem` }}>
            <div className="stage-fit">
              {current!.label && <div className="stage-current-label">{current!.label}</div>}
              <div className={`stage-current-text${preClass(current)}`}>
                {current!.marker && <span className="stage-marker">{current!.marker}</span>}
                {cleanSourceText(current!.text)}
              </div>
              {current!.reference && <div className="stage-current-ref">{current!.reference}</div>}
            </div>
          </div>

          {/* No "Next" at all on the last slide — an empty band, like before. */}
          {next && (
            <div className="stage-next">
              <div className="stage-next-label">Next{next.label ? ` · ${next.label}` : ''}</div>
              <div className={`stage-next-text${preClass(next)}`}>{cleanSourceText(next.text)}</div>
              {next.reference && <div className="stage-next-ref">{next.reference}</div>}
            </div>
          )}
        </>
      )}

      {alertBanner}
    </div>
  )
}
