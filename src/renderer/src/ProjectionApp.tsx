import { useState, useEffect, useRef } from 'react'
import type { Quote } from './types'

export default function ProjectionApp() {
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null)
  const [blanked, setBlanked] = useState(false)
  const [fontSize, setFontSize] = useState(3.0)
  const [alertText, setAlertText] = useState<string | null>(null)
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // IPC: receive quotes + clear
  useEffect(() => {
    const removeDisplay = window.electronAPI.onDisplayQuote((quote) => {
      setCurrentQuote(quote)
      setBlanked(false)
    })
    const removeClear = window.electronAPI.onClearQuote(() => {
      setCurrentQuote(null)
      setBlanked(false)
    })
    return () => {
      removeDisplay()
      removeClear()
    }
  }, [])

  // IPC: blank and font size from main window
  useEffect(() => {
    const removeBlank = window.electronAPI.onSetBlankScreen(setBlanked)
    const removeFont = window.electronAPI.onSetFontSize(setFontSize)
    return () => {
      removeBlank()
      removeFont()
    }
  }, [])

  // IPC: alert / ticker
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

  // Grab window focus on mount so keydown events fire reliably
  useEffect(() => {
    window.focus()
  }, [])

  // Keyboard + click
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setBlanked(true)
      } else if (e.key === 'ArrowRight') {
        window.electronAPI.navigateQueue('next')
        setBlanked(false)
      } else if (e.key === 'ArrowLeft') {
        window.electronAPI.navigateQueue('prev')
        setBlanked(false)
      } else {
        setBlanked(false)
      }
    }
    const onClick = (): void => setBlanked(false)

    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick)
    }
  }, [])

  const alertBanner = alertText && (
    <div className="projection-alert" onClick={() => setAlertText(null)}>
      {alertText}
    </div>
  )

  if (!currentQuote || blanked) {
    return (
      <div className="projection-idle">
        {!blanked && (
          <div className="projection-logo">
            <div className="projection-logo-born">BORN</div>
            <div className="projection-logo-sub">Branham or Nothing</div>
          </div>
        )}
        {!blanked && currentQuote && (
          <button className="projection-blank-btn" onClick={() => setBlanked(true)}>
            Blank
          </button>
        )}
        {alertBanner}
      </div>
    )
  }

  return (
    <div className="projection-active">
      <div className="projection-text" style={{ fontSize: `${fontSize}rem` }}>
        {currentQuote.text}
      </div>
      <div className="projection-reference">
        <span className="projection-title">{currentQuote.sermonTitle}</span>
        <span className="projection-sep">·</span>
        <span className="projection-date">{currentQuote.dateCode}</span>
        <span className="projection-sep">·</span>
        <span className="projection-para">{currentQuote.paragraphRef}</span>
      </div>
      <button className="projection-blank-btn" onClick={() => setBlanked(true)}>
        Blank
      </button>
      {alertBanner}
    </div>
  )
}
