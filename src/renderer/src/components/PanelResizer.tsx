import { useCallback, useRef, useState } from 'react'
import { currentUiZoom } from '../uiScale'
import './PanelResizer.css'

interface Props {
  /** Current width in px of the panel this edge belongs to. */
  width: number
  min: number
  max: number
  /** Called continuously while dragging / on each key press. */
  onChange: (px: number) => void
  /** Called once when a drag ends or a key press settles — persist here. */
  onCommit?: (px: number) => void
  /** Double-click / Enter-on-handle resets to this width. */
  defaultWidth: number
  label: string
  /** Which side of the panel the handle sits on; dragging toward the other
   *  side makes the panel wider. */
  edge?: 'left' | 'right'
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** A thin draggable edge that is also a keyboard-operable "window splitter":
 *  focus it, then ←/→ resize (Shift = bigger steps), Home/End jump to the
 *  limits, Enter or double-click restores the default. */
export default function PanelResizer({
  width,
  min,
  max,
  onChange,
  onCommit,
  defaultWidth,
  label,
  edge = 'left'
}: Props): JSX.Element {
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; w: number } | null>(null)
  const latest = useRef(width)
  latest.current = width

  const set = useCallback(
    (px: number, commit = false) => {
      const next = clamp(Math.round(px), min, max)
      latest.current = next
      onChange(next)
      if (commit) onCommit?.(next)
    },
    [min, max, onChange, onCommit]
  )

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, w: width }
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!start.current) return
    // Pointer movement is in screen pixels; the width is in (zoomed) CSS pixels.
    const dx = (e.clientX - start.current.x) / currentUiZoom()
    // A panel on the right grows when its left edge moves left.
    set(edge === 'left' ? start.current.w - dx : start.current.w + dx)
  }
  const end = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!start.current) return
    start.current = null
    setDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    onCommit?.(latest.current)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const step = e.shiftKey ? 64 : 16
    // Arrow toward the content grows the panel.
    const grow = edge === 'left' ? 'ArrowLeft' : 'ArrowRight'
    const shrink = edge === 'left' ? 'ArrowRight' : 'ArrowLeft'
    if (e.key === grow) set(width + step, true)
    else if (e.key === shrink) set(width - step, true)
    else if (e.key === 'Home') set(min, true)
    else if (e.key === 'End') set(max, true)
    else if (e.key === 'Enter') set(defaultWidth, true)
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      className={`panel-resizer panel-resizer--${edge}${dragging ? ' is-dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      title={`${label} — drag, or use the arrow keys (double-click resets)`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => set(defaultWidth, true)}
      onKeyDown={onKeyDown}
    />
  )
}
