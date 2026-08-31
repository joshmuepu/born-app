import { useState, useEffect } from 'react'
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

  const nothingUp = !current || blanked
  const alertBanner = alert && <div className="stage-alert">{alert}</div>

  return (
    <div className={`stage stage--${view}`}>
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

      {/* Clock: large and centred when nothing's up, tucked in a corner otherwise. */}
      <div className={`stage-clock${nothingUp ? ' stage-clock--big' : ''}`}>{clock}</div>

      {view === 'congregation' ? (
        <div className="stage-congregation">
          {nothingUp ? null : (
            <>
              {current!.label && <div className="stage-cg-label">{current!.label}</div>}
              <div className="stage-cg-text">
                {current!.marker && <span className="stage-marker">{current!.marker}</span>}
                {current!.text}
              </div>
              {current!.reference && <div className="stage-cg-ref">{current!.reference}</div>}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="stage-current">
            {blanked ? (
              <div className="stage-idle">Screen hidden</div>
            ) : current ? (
              <>
                {current.label && <div className="stage-current-label">{current.label}</div>}
                <div className="stage-current-text">
                  {current.marker && <span className="stage-marker">{current.marker}</span>}
                  {current.text}
                </div>
                {current.reference && <div className="stage-current-ref">{current.reference}</div>}
              </>
            ) : (
              <div className="stage-idle">Nothing projected</div>
            )}
          </div>

          {next && !blanked && (
            <div className="stage-next">
              <div className="stage-next-label">Next{next.label ? ` · ${next.label}` : ''}</div>
              <div className="stage-next-text">{next.text}</div>
              {next.reference && <div className="stage-next-ref">{next.reference}</div>}
            </div>
          )}
        </>
      )}

      {alertBanner}
    </div>
  )
}
