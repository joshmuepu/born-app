import { useEffect, useRef, useState } from 'react'
import type { DisplayInfo } from '../types'

interface Props {
  displayInfo: DisplayInfo | null
  projectionOpen: boolean
  stageOpen: boolean
  fontSize: number
  onToggleProjection: () => void
  onToggleStage: () => void
  onSetProjectionDisplay: (id: number | null) => void
  onSetStageDisplay: (id: number | null) => void
  onFontSize: (delta: number) => void
}

/** "PA278QV (2) (2560×1440)" → "PA278QV (2)". */
function shortName(label: string): string {
  const m = /^(.*?)\s*\(\d{3,}[×x]\d{3,}/.exec(label)
  return (m ? m[1] : label).trim()
}

/**
 * One place for everything about the two output screens — which monitor each
 * uses, opening/closing them, and the projected text size. Keeps the top bar
 * clear of setup controls that are only touched once per service.
 */
export default function ScreensMenu({
  displayInfo,
  projectionOpen,
  stageOpen,
  fontSize,
  onToggleProjection,
  onToggleStage,
  onSetProjectionDisplay,
  onSetStageDisplay,
  onFontSize
}: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const displays = displayInfo?.displays ?? []
  const multi = displays.length > 1
  const projTarget = displays.find((d) => d.id === displayInfo?.targetId)
  const stageTarget = displays.find((d) => d.id === displayInfo?.stageTargetId)
  const clash = !!displayInfo?.stageClashesProjection

  return (
    <div className="screens-menu" ref={wrapRef}>
      <button
        className={`btn-secondary screens-trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Choose which screens the congregation and the platform see"
      >
        <span className={`screens-dot${projectionOpen ? ' is-live' : ''}`} />
        Screens
        <span className="screens-caret">▾</span>
      </button>

      {open && (
        <div className="screens-popover" role="dialog" aria-label="Screen setup">
          {/* Congregation / main projection */}
          <div className="screens-group">
            <div className="screens-group-head">
              <span className="screens-group-title">Congregation screen</span>
              <button
                className={projectionOpen ? 'btn-quiet btn-sm' : 'btn-primary btn-sm'}
                onClick={onToggleProjection}
              >
                {projectionOpen ? 'Turn off' : 'Turn on'}
              </button>
            </div>
            {multi ? (
              <select
                className="language-select screens-select"
                value={displayInfo?.isOverride ? displayInfo.targetId : ''}
                onChange={(e) => onSetProjectionDisplay(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">
                  {projTarget ? `Automatic — ${shortName(projTarget.label)}` : 'Automatic'}
                </option>
                {displays.map((d) => (
                  <option key={d.id} value={d.id}>{shortName(d.label)}</option>
                ))}
              </select>
            ) : (
              <p className="screens-note">
                Only one screen connected — projection will use this one.
              </p>
            )}
          </div>

          {/* Stage monitor */}
          <div className="screens-group">
            <div className="screens-group-head">
              <span className="screens-group-title">Stage monitor</span>
              <button
                className={stageOpen ? 'btn-quiet btn-sm' : 'btn-secondary btn-sm'}
                onClick={onToggleStage}
              >
                {stageOpen ? 'Turn off' : 'Turn on'}
              </button>
            </div>
            {stageOpen && multi && (
              <select
                className="language-select screens-select"
                value={displayInfo?.stageIsOverride && displayInfo.stageTargetId ? displayInfo.stageTargetId : ''}
                onChange={(e) => onSetStageDisplay(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">
                  {displayInfo?.stageIsWindowed
                    ? 'Automatic — floating window'
                    : `Automatic — ${shortName(stageTarget?.label ?? '')}`}
                </option>
                {displays.map((d) => (
                  <option key={d.id} value={d.id}>{shortName(d.label)}</option>
                ))}
              </select>
            )}
            {stageOpen && displayInfo?.stageIsWindowed && (
              <p className="screens-note">
                No spare screen — the stage monitor is a floating window you can move.
              </p>
            )}
            {stageOpen && clash && (
              <p className="screens-note screens-note--warn">
                ⚠ The stage monitor is on the same screen as the projection — pick a different one.
              </p>
            )}
            {!stageOpen && (
              <p className="screens-note">A second screen for the platform: current slide, what’s next, and the time.</p>
            )}
          </div>

          {/* Text size */}
          <div className="screens-group">
            <div className="screens-group-head">
              <span className="screens-group-title">Projected text size</span>
              <div className="screens-textsize">
                <button className="btn-secondary btn-sm" onClick={() => onFontSize(-0.25)} disabled={fontSize <= 1.5} aria-label="Smaller">−</button>
                <span className="screens-textsize-val">{Math.round((fontSize / 4.5) * 100)}%</span>
                <button className="btn-secondary btn-sm" onClick={() => onFontSize(0.25)} disabled={fontSize >= 8} aria-label="Larger">+</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
