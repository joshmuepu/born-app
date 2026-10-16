import { useState, useEffect, useRef } from 'react'
import type { SlidePayload } from './types'
import { useAutoFitFontSize } from './useAutoFitFontSize'
import ProjectionVideo from './components/ProjectionVideo'
import TapeScreen from './components/TapeScreen'
import ProjectionYouTube from './components/ProjectionYouTube'
import type { PlaybackWire } from '../../shared/videoPlayback'

export default function ProjectionApp() {
  const [slide, setSlide] = useState<SlidePayload | null>(null)
  const [blanked, setBlanked] = useState(false)
  // `fontSize` is the operator's Text +/- setting (4.5 = default); the slide is
  // actually drawn at a size that scales with the screen (see `baseRem`), with
  // the operator setting acting as a multiplier around it.
  const [fontSize, setFontSize] = useState(4.5)
  const [viewportH, setViewportH] = useState(() =>
    typeof window === 'undefined' ? 900 : window.innerHeight
  )
  // The playback record for the video on this screen (kept here, not in the video component, so a message that arrives a moment
  // before the component mounts is never lost).
  const [playback, setPlayback] = useState<PlaybackWire | null>(null)
  const [alertText, setAlertText] = useState<string | null>(null)
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textRef = useRef<HTMLDivElement>(null)

  // A slide should fill a 65" church screen the same way it fills a laptop —
  // tie the base text size to the screen height (in CSS pixels, which already
  // tracks the projector's resolution), clamped so it never gets silly.
  const baseRem = (Math.min(Math.max(viewportH * 0.062, 30), 132) / 16) * (fontSize / 4.5)

  // IPC: receive slides + clear
  useEffect(() => {
    const removeShow = window.electronAPI.onShowSlide((s) => {
      setSlide(s)
      setBlanked(false)
    })
    const removeClear = window.electronAPI.onClearQuote(() => {
      setSlide(null)
      setBlanked(false)
    })
    // Tell main every listener is attached — it replays current state so the
    // first slide projected right after opening is never dropped.
    window.electronAPI.notifyProjectionReady()
    return () => {
      removeShow()
      removeClear()
    }
  }, [])

  useEffect(() => {
    const offPlay = window.electronAPI.onMediaPlayback(setPlayback)
    const offStop = window.electronAPI.onMediaPlaybackStop(() => setPlayback(null))
    return () => {
      offPlay()
      offStop()
    }
  }, [])

  useEffect(() => {
    const removeBlank = window.electronAPI.onSetBlankScreen(setBlanked)
    const removeFont = window.electronAPI.onSetFontSize(setFontSize)
    return () => {
      removeBlank()
      removeFont()
    }
  }, [])

  useEffect(() => {
    const removeAlert = window.electronAPI.onAlert((message) => {
      setAlertText(message)
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
      alertTimerRef.current = setTimeout(() => setAlertText(null), 10000)
    })
    return () => {
      removeAlert()
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
    }
  }, [])

  useEffect(() => {
    window.focus()
  }, [])

  // The screen (and so the projector's resolution) can change mid-service.
  useEffect(() => {
    const onResize = (): void => setViewportH(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Auto-fit: start from the screen-scaled base size, then shrink only if a
  // long verse / quote would be clipped or overlap the reference line.
  const fitFontSize = useAutoFitFontSize(textRef, slide, baseRem, 0.9)

  useEffect(() => {
    // Esc (blackout toggle) is owned by the main process so both windows agree;
    // here we only handle slide navigation. Showing a slide auto-unblanks.
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === ' ' && e.shiftKey) {
        window.electronAPI.navigateQueue('prev')
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        window.electronAPI.navigateQueue('next')
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        window.electronAPI.navigateQueue('prev')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const alertBanner = alertText && (
    <div className="projection-alert" onClick={() => setAlertText(null)}>
      {alertText}
    </div>
  )

  if (!slide || blanked) {
    // Pure black — nothing branded is ever shown to the congregation.
    return <div className="projection-idle">{alertBanner}</div>
  }

  if (slide.tape) {
    return (
      <div className="projection-active projection-tape">
        <TapeScreen spec={slide.tape} baseRem={baseRem} />
        {alertBanner}
      </div>
    )
  }

  if (slide.kind === 'media' && slide.media?.type === 'youtube' && slide.media.youtubeId) {
    // No alert banner here on purpose: nothing may be drawn over YouTube's player (YOUTUBE_ALERT_POLICY in shared/youtube.ts;
    // main also keeps alerts away from this screen, this is the second lock).
    return (
      <div className="projection-active projection-media projection-media--yt">
        <ProjectionYouTube videoId={slide.media.youtubeId} mediaId={slide.media.mediaId} playback={playback} />
      </div>
    )
  }

  if (slide.kind === 'media' && slide.media?.type === 'video') {
    return (
      <div className="projection-active projection-media">
        <ProjectionVideo mediaId={slide.media.mediaId} fit={slide.media.fit} playback={playback} />
        {alertBanner}
      </div>
    )
  }

  if (slide.kind === 'media' && slide.media) {
    return (
      <div className="projection-active projection-media">
        <img
          key={slide.media.mediaId}
          className={`projection-pic projection-pic--${slide.media.fit ?? 'fit'}`}
          src={`born-media://display/${slide.media.mediaId}`}
          alt=""
          draggable={false}
        />
        {alertBanner}
      </div>
    )
  }

  return (
    <div className={`projection-active projection-${slide.kind}${slide.background ? ' has-bg' : ''}`}>
      {slide.background && (
        <div className="projection-bg" aria-hidden="true">
          {slide.background.motion ? (
            // A motion background: a muted, looping video behind the text. Never audio, never part of the playback clock.
            <video key={slide.background.mediaId} className="projection-bg-video" src={`born-media://file/${slide.background.mediaId}`} poster={`born-media://display/${slide.background.mediaId}`} muted loop autoPlay playsInline preload="auto" disablePictureInPicture />
          ) : (
            <img src={`born-media://display/${slide.background.mediaId}`} alt="" draggable={false} />
          )}
          <div className="projection-bg-dim" style={{ background: `rgba(0,0,0,${slide.background.dim / 100})` }} />
        </div>
      )}
      {slide.label && <div className="projection-label">{slide.label}</div>}
      <div ref={textRef} className="projection-text" style={{ fontSize: `${fitFontSize}rem` }}>
        <div className="projection-text-inner">
          {slide.marker && <span className="projection-marker">{slide.marker}</span>}
          {slide.text}
        </div>
      </div>
      {slide.reference && <div className="projection-reference">{slide.reference}</div>}
      {alertBanner}
    </div>
  )
}
