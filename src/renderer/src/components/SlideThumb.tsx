import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EyeOff } from 'lucide-react'
import type { SlidePayload } from '../types'
import { useAutoFitFontSize } from '../useAutoFitFontSize'
import './SlideThumb.css'

/** The stage the thumbnail lays out on — a 1920×1080 screen, scaled down. The
 *  geometry mirrors ProjectionApp.css (vh → 10.8px) and the font sizing uses the
 *  same base-size formula and auto-fit hook as the real output, so a thumbnail
 *  breaks lines and shrinks long text the way the projector will. */
const STAGE_W = 1920
const STAGE_H = 1080

interface Props {
  slide: SlidePayload | null
  /** The operator's Text +/- setting (4.5 = default), same as the output. */
  fontSize?: number
  /** Screen hidden: the output is black even though `slide` is loaded. */
  blanked?: boolean
  /** Shown when there is nothing to draw. */
  emptyLabel?: string
  className?: string
}

export default function SlideThumb({
  slide,
  fontSize = 4.5,
  blanked = false,
  emptyLabel = 'Nothing here',
  className = ''
}: Props): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.15)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = (): void => {
      const w = el.clientWidth
      if (w > 0) setScale(w / STAGE_W)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const baseRem =
    (Math.min(Math.max(STAGE_H * 0.062, 30), 132) / 16) * (fontSize / 4.5)
  const fitRem = useAutoFitFontSize(textRef, slide, baseRem, 0.9)

  // Re-key the stage on content change so a CSS transition can play when a
  // slide lands, without ever delaying what is drawn.
  const [pulse, setPulse] = useState(0)
  const sig = slide ? `${slide.kind}|${slide.reference ?? ''}|${slide.marker ?? ''}|${slide.text}` : ''
  useEffect(() => setPulse((p) => p + 1), [sig, blanked])

  const hidden = blanked
  return (
    <div
      ref={wrapRef}
      className={`slide-thumb${className ? ' ' + className : ''}`}
      role="img"
      aria-label={
        hidden
          ? 'Screen hidden'
          : slide
            ? `${slide.reference ?? ''} ${slide.text}`.trim().slice(0, 140)
            : emptyLabel
      }
    >
      {slide && !hidden ? (
        <div
          key={pulse}
          className={`slide-thumb-stage slide-thumb--${slide.kind}`}
          style={{ transform: `scale(${scale})` }}
        >
          {slide.label && <div className="st-label">{slide.label}</div>}
          <div ref={textRef} className="st-text" style={{ fontSize: `${fitRem}rem` }}>
            <div className="st-text-inner">
              {slide.marker && <span className="st-marker">{slide.marker}</span>}
              {slide.text}
            </div>
          </div>
          {slide.reference && <div className="st-reference">{slide.reference}</div>}
        </div>
      ) : (
        <div className="slide-thumb-empty">
          {hidden ? (
            <>
              <EyeOff width={14} height={14} strokeWidth={2} aria-hidden="true" />
              <span>Screen hidden</span>
            </>
          ) : (
            <span>{emptyLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
