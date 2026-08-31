import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import type { SlidePayload } from './types'

export default function ProjectionApp() {
  const [slide, setSlide] = useState<SlidePayload | null>(null)
  const [blanked, setBlanked] = useState(false)
  const [fontSize, setFontSize] = useState(4.5)
  const [fitFontSize, setFitFontSize] = useState(4.5)
  const [alertText, setAlertText] = useState<string | null>(null)
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textRef = useRef<HTMLDivElement>(null)

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

  // Auto-fit: shrink text to fit the available band (operator size is the max)
  // so a long verse / quote is never clipped or overlapping the reference line.
  // Re-runs on window resize too (projector resolution can change mid-service).
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el || !slide) return
    let raf = 0
    const fit = (): void => {
      let size = fontSize
      el.style.fontSize = `${size}rem`
      let guard = 0
      while (el.scrollHeight > el.clientHeight + 1 && size > 1 && guard < 60) {
        size = Math.max(1, size - 0.15)
        el.style.fontSize = `${size}rem`
        guard++
      }
      setFitFontSize(size)
    }
    raf = requestAnimationFrame(fit)
    const onResize = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fit)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [slide, fontSize])

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
