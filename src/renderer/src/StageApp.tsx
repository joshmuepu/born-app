import { useState, useEffect } from 'react'
import type { SlidePayload } from './types'
import { formatClock, wirePosition, type PlaybackWire } from '../../shared/videoPlayback'

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

/** The stage screen does not decode the video — it shows the time left in huge type and a progress bar, from the main output's clock. */
/** A video, local or YouTube: the stage monitor shows its name and the time left instead of the picture. */
const isTimedMedia = (s: SlidePayload): boolean => s.kind === 'media' && (s.media?.type === 'video' || s.media?.type === 'youtube')

/** The stage screen does not decode the video — it shows the time left in huge type and a progress bar, from the main output's clock. */
function StageVideo({ slide, wire, receivedAt }: { slide: SlidePayload; wire: PlaybackWire | null; receivedAt: number }): JSX.Element {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [])
  const ok = wire && wire.mediaId === slide.media?.mediaId
  const pos = ok ? wirePosition(wire, performance.now() - receivedAt) : 0
  const dur = ok ? wire.duration : null
  const left = dur !== null ? Math.max(0, Math.ceil(dur - pos - 0.001)) : null
  const state = !ok ? 'Ready' : wire.status === 'playing' ? 'Playing' : wire.status === 'ended' ? 'Finished' : wire.status === 'error' ? 'Problem' : wire.hasPlayedOnce ? 'Paused' : 'Ready'
  return (
    <div className="stage-video" role="status" aria-label="Video time left">
      <div className="stage-video-title">{slide.text}</div>
      <div className="stage-video-left">{left !== null ? formatClock(left) : '–:––'}</div>
      <div className="stage-video-sub">{state}{dur !== null ? ` · ${formatClock(pos)} of ${formatClock(dur)}` : ''}</div>
      <div className="stage-video-bar" aria-hidden="true"><i style={{ width: dur ? `${Math.min(100, (pos / dur) * 100)}%` : '0%' }} /></div>
    </div>
  )
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
  const [wire, setWire] = useState<PlaybackWire | null>(null)
  const [wireAt, setWireAt] = useState(0)

  useEffect(() => {
    const offUpdate = window.electronAPI.onStageUpdate((data) => {
      setCurrent(data.current)
      setNext(data.next)
      // A new slide arriving means we're live again — clear any stale blackout.
      if (data.current) setBlanked(false)
    })
    const offPlay = window.electronAPI.onMediaPlayback((m) => { setWire(m); setWireAt(performance.now()) })
    const offPlayStop = window.electronAPI.onMediaPlaybackStop(() => setWire(null))
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
      offPlay()
      offPlayStop()
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

      {!nothingUp && isTimedMedia(current!) && <StageVideo slide={current!} wire={wire} receivedAt={wireAt} />}

      {!nothingUp && !(isTimedMedia(current!)) && view === 'congregation' && (
        <div className="stage-congregation">
          {current!.label && <div className="stage-cg-label">{current!.label}</div>}
          <div className={`stage-cg-text${preClass(current)}`}>
            {current!.marker && <span className="stage-marker">{current!.marker}</span>}
            {current!.text}
          </div>
          {current!.reference && <div className="stage-cg-ref">{current!.reference}</div>}
        </div>
      )}

      {!nothingUp && !(isTimedMedia(current!)) && view === 'stage' && (
        <>
          <div className="stage-current">
            {current!.label && <div className="stage-current-label">{current!.label}</div>}
            <div className={`stage-current-text${preClass(current)}`}>
              {current!.marker && <span className="stage-marker">{current!.marker}</span>}
              {current!.text}
            </div>
            {current!.reference && <div className="stage-current-ref">{current!.reference}</div>}
          </div>

          {/* No "Next" at all on the last slide — an empty band, like before. */}
          {next && (
            <div className="stage-next">
              <div className="stage-next-label">Next{next.label ? ` · ${next.label}` : ''}</div>
              <div className={`stage-next-text${preClass(next)}`}>{next.text}</div>
              {next.reference && <div className="stage-next-ref">{next.reference}</div>}
            </div>
          )}
        </>
      )}

      {alertBanner}
    </div>
  )
}
