import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import type { SlidePayload } from './types'

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
  const [fitFontSize, setFitFontSize] = useState(4.5)
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

  // Auto-fit: start from the screen-scaled base size, then shrink only if a
  // long verse / quote would be clipped or overlap the reference line.
  // Re-runs on window resize too (projector resolution can change mid-service).
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el || !slide) return
    let raf = 0
    const fit = (): void => {
      // Measure the text block's own height, not the flex container's
      // scrollHeight — a vertically-centred child that overflows the band
      // spills equally past the top and bottom, and `scrollHeight` under-reports
      // that, so the text ends up clipped on the real projector.
      const inner = el.firstElementChild as HTMLElement | null
      if (!inner) return
      let size = baseRem
      const floor = Math.max(0.9, baseRem * 0.4)
      el.style.fontSize = `${size}rem`
      let guard = 0
      while (inner.scrollHeight > el.clientHeight + 1 && size > floor && guard < 120) {
        size = Math.max(floor, size - baseRem * 0.04)
        el.style.fontSize = `${size}rem`
        guard++
      }
      setFitFontSize(size)
    }
    raf = requestAnimationFrame(fit)
    const onResize = (): void => {
      setViewportH(window.innerHeight)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fit)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [slide, baseRem])

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
