import { useState, useEffect } from 'react'
import type { Quote } from './types'

export default function StageApp() {
  const [current, setCurrent] = useState<Quote | null>(null)
  const [next, setNext] = useState<Quote | null>(null)

  useEffect(() => {
    const unsub = window.electronAPI.onStageUpdate((data) => {
      setCurrent(data.current)
      setNext(data.next)
    })
    return unsub
  }, [])

  return (
    <div className="stage">
      <div className="stage-current">
        {current ? (
          <>
            <div className="stage-current-text">{current.text}</div>
            <div className="stage-current-ref">
              <span>{current.sermonTitle}</span>
              <span className="stage-sep">·</span>
              <span>{current.dateCode}</span>
              <span className="stage-sep">·</span>
              <span>{current.paragraphRef}</span>
            </div>
          </>
        ) : (
          <div className="stage-idle">No quote projected</div>
        )}
      </div>

      {next && (
        <div className="stage-next">
          <div className="stage-next-label">Next</div>
          <div className="stage-next-text">{next.text}</div>
          <div className="stage-next-ref">
            <span>{next.sermonTitle}</span>
            <span className="stage-sep">·</span>
            <span>{next.dateCode}</span>
          </div>
        </div>
      )}
    </div>
  )
}
