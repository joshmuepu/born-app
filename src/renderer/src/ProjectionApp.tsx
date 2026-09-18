import { useState, useEffect, useRef } from 'react'
import type { SlidePayload } from './types'
import { useAutoFitFontSize } from './useAutoFitFontSize'

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
      if (e.key === 'ArrowRight' || e.key === ' ') {
        window.electronAPI.navigateQueue('next')
      } else if (e.key === 'ArrowLeft') {
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

  return (
    <div className={`projection-active projection-${slide.kind}`}>
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
