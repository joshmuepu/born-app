import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Shrinks the font size of `containerRef`'s single child (measured via
 * `scrollHeight`) until it fits within the container's own height, starting
 * from `baseRem` and never going below `minRem` (nor `floorRatio` of `baseRem`). Re-measures whenever
 * `content` or `baseRem` changes, whenever the container itself comes back
 * on the page (the projector's text is not on the page while the screen is
 * hidden, so a size change made then is applied on Show screen), and on
 * window resize (a projector's resolution — or this window's — can change
 * mid-service).
 *
 * The fit runs before the browser draws, so a new slide is never shown for a
 * frame at the previous slide's size first.
 *
 * Shared by the projector output and the operator's confidence-monitor
 * preview, so both auto-fit the same way at whatever size their own
 * container allows.
 */
/** The fit itself: sets `el`'s font size (in rem) from `baseRem` down, in steps of 4% of it, until its single child fits its height or the floor
 *  is reached, and returns that size (null when `el` has no child). Also used to measure a slide off screen (ProjectionApp.tsx). */
export function fitFontToBox(el: HTMLElement, baseRem: number, minRem = 0.9, floorRatio = 0.4): number | null {
  const inner = el.firstElementChild as HTMLElement | null
  if (!inner) return null
  let size = baseRem
  const floor = Math.max(minRem, baseRem * floorRatio)
  el.style.fontSize = `${size}rem`
  let guard = 0
  while (inner.scrollHeight > el.clientHeight + 1 && size > floor && guard < 120) {
    size = Math.max(floor, size - baseRem * 0.04)
    el.style.fontSize = `${size}rem`
    guard++
  }
  return size
}

export function useAutoFitFontSize(
  containerRef: React.RefObject<HTMLElement | null>,
  content: unknown,
  baseRem: number,
  minRem = 0.9,
  floorRatio = 0.4
): number {
  const [fitRem, setFitRem] = useState(baseRem)
  const params = useRef({ content, baseRem, minRem, floorRatio })
  params.current = { content, baseRem, minRem, floorRatio }

  const fit = useCallback((): void => {
    const el = containerRef.current
    const { content: c, baseRem: base, minRem: min, floorRatio: ratio } = params.current
    if (!el || !c) return
    const size = fitFontToBox(el, base, min, ratio)
    if (size != null) setFitRem(size)
  }, [containerRef])

  // after every render: fit again when the slide, the size or the container element itself has changed
  const last = useRef<{ el: HTMLElement | null; content: unknown; baseRem: number; minRem: number } | null>(null)
  useLayoutEffect(() => {
    const el = containerRef.current
    const l = last.current
    if (l && l.el === el && l.content === content && l.baseRem === baseRem && l.minRem === minRem) return
    last.current = { el, content, baseRem, minRem }
    fit()
  })

  useEffect(() => {
    let raf = 0
    const onResize = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fit)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [fit])

  return fitRem
}
