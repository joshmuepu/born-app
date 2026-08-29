import { useState, useEffect } from 'react'
import type { SlidePayload } from './types'

export default function StageApp() {
  const [current, setCurrent] = useState<SlidePayload | null>(null)
  const [next, setNext] = useState<SlidePayload | null>(null)

  useEffect(() => {
    const unsub = window.electronAPI.onStageUpdate((data) => {
      setCurrent(data.current)
      setNext(data.next)
    })
    window.electronAPI.notifyStageReady()
    return unsub
  }, [])

  return (
    <div className="stage">
      <div className="stage-current">
        {current ? (
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

      {next && (
        <div className="stage-next">
          <div className="stage-next-label">Next{next.label ? ` · ${next.label}` : ''}</div>
          <div className="stage-next-text">{next.text}</div>
          {next.reference && <div className="stage-next-ref">{next.reference}</div>}
        </div>
      )}
    </div>
  )
}
