import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useAutoFitFontSize } from './useAutoFitFontSize'
import { cleanSourceText } from '../../shared/sourceText'
import type { SlidePayload } from './types'
import { NEXT_BAND_VH, HIDE_NEXT_STEP, nextRoomStep, currentFitLimits } from './stageRoom'

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
  // 4.2% of the screen width in the Stage view, 6% in the Congregation view, at most 5 and 7 rem; the rem grows with the screen
  // height (StageApp.css), so on a 4K screen the text keeps the share of the screen it has on a 1080-line one. The current text goes
  // no smaller than 55% of its start size, unless the page needs more room (see below). The Next text is fitted to its band (a fifth of
  // the screen height) and never starts larger than the current text.
  const [screen, setScreen] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = (): void => setScreen({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const rootPx = Math.max(12, screen.h / 67.5)
  const clampRem = (pct: number, min: number, max: number): number => Math.min(Math.max((screen.w * pct) / rootPx, min), max)
  const currentRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLDivElement>(null)
  const congregationRef = useRef<HTMLDivElement>(null)
  const showing = !current || blanked ? null : current

  // The current text is never cut: a page that does not fit gets room one step at a time (stageRoom.ts), and the step starts again at 0 for
  // every new page, screen size or view. Each step is part of what the texts are fitted for, so they fit again at each one.
  const [room, setRoom] = useState<{ key: unknown[]; step: number }>({ key: [], step: 0 })
  const roomKey = [showing, next, screen.w, screen.h, view]
  const sameKey = room.key.length === roomKey.length && room.key.every((k, i) => k === roomKey[i])
  const step = sameKey ? room.step : 0
  const nextShown = !!next && step < HIDE_NEXT_STEP
  const currentFit = useMemo(() => (view === 'stage' && showing ? { showing, step } : null), [view, showing, step])
  const nextFit = useMemo(() => (view === 'stage' && showing && nextShown ? { next, step } : null), [view, showing, nextShown, next, step])
  const currentBase = clampRem(0.042, 2, 5)
  const limits = currentFitLimits(step, currentBase, rootPx)
  const currentRem = useAutoFitFontSize(currentRef, currentFit, currentBase, limits.minRem, limits.floorRatio)
  const nextRem = useAutoFitFontSize(nextRef, nextFit, Math.min(clampRem(0.024, 1.1, 2.6), currentRem), 0.9, 0.3)
  // after the fits above: is anything still cut at this step?
  useLayoutEffect(() => {
    if (!currentFit) return
    // as the fit measures it: the box's content against the box
    const over = (el: HTMLElement | null): boolean => !!el?.firstElementChild && (el.firstElementChild as HTMLElement).scrollHeight > el.clientHeight + 1
    const band = nextRef.current?.parentElement ?? null
    const bandOver = !!band && band.scrollHeight > band.clientHeight + 1
    const following = nextRoomStep(step, !!next, over(currentRef.current), over(nextRef.current) || bandOver)
    if (following != null) setRoom({ key: roomKey, step: following })
  })
  const congregationRem = useAutoFitFontSize(congregationRef, view === 'congregation' ? showing : null, clampRem(0.06, 2, 7), 0.9, 0.3)

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
          {nextShown && (
            <div className="stage-next" style={step > 0 ? { flexBasis: `${NEXT_BAND_VH[step]}vh`, height: `${NEXT_BAND_VH[step]}vh` } : undefined}>
              <div className="stage-next-label">Next{next!.label ? ` · ${next!.label}` : ''}</div>
              <div className="stage-next-fit" ref={nextRef} style={{ fontSize: `${nextRem}rem` }}>
                <div>
                  <div className={`stage-next-text${preClass(next)}`}>{cleanSourceText(next!.text)}</div>
                  {next!.reference && <div className="stage-next-ref">{next!.reference}</div>}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {alertBanner}
    </div>
  )
}
