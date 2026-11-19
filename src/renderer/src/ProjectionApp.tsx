import { useState, useEffect, useRef } from 'react'
import { cleanSourceText } from '../../shared/sourceText'
import type { SlidePayload } from './types'
import { useAutoFitFontSize } from './useAutoFitFontSize'

export default function ProjectionApp() {
  const [slide, setSlide] = useState<SlidePayload | null>(null)
  const [blanked, setBlanked] = useState(false)
  // `fontSize` is the operator's Text +/- setting (4.5 = default); the slide is
  // actually drawn at a size that scales with the screen (see `baseRem`), with
  // the operator setting acting as a multiplier around it.
  const [fontSize, setFontSize] = useState(4.5)
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined' ? { w: 1600, h: 900 } : { w: window.innerWidth, h: window.innerHeight }
  )
  const [alertText, setAlertText] = useState<string | null>(null)
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textRef = useRef<HTMLDivElement>(null)

  // The text starts at the same size as the stage monitor's current text (StageApp.tsx): 4.2% of the screen width, at least 2 and at
  // most 5 times a root that is 1/67.5 of the screen height (16 px on a 1080-line screen, never under 12 px), with no pixel cap, so
  // it keeps its share of the screen on a 4K one. It was 6.2% of the height capped at 132 px, smaller than the stage on most screens.
  const rootPx = Math.max(12, viewport.h / 67.5)
  const basePx = Math.min(Math.max(viewport.w * 0.042, 2 * rootPx), 5 * rootPx)
  const baseRem = (basePx / 16) * (fontSize / 4.5)

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
    const onResize = (): void => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Auto-fit: start from the screen-scaled base size, then shrink only if a
  // long verse / quote would be clipped or overlap the reference line.
  // It shrinks as far as a long passage needs (about the smallest size it reached before), so nothing is ever cut.
  const fitFontSize = useAutoFitFontSize(textRef, slide, baseRem, 0.9, 0.33)

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

  return (
    <div className={`projection-active projection-${slide.kind}`}>
      {/* The label and reference rows are always there (empty when the slide has none), so the text stays centred on the screen. */}
      <div className="projection-label">{slide.label}</div>
      <div ref={textRef} className="projection-text" style={{ fontSize: `${fitFontSize}rem` }}>
        <div className="projection-text-inner">
          {slide.marker && <span className="projection-marker">{slide.marker}</span>}
          {cleanSourceText(slide.text)}
        </div>
      </div>
      <div className="projection-reference">{slide.reference}</div>
      {alertBanner}
    </div>
  )
}
