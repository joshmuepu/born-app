import { useLayoutEffect, useState } from 'react'

/**
 * Shrinks the font size of `containerRef`'s single child (measured via
 * `scrollHeight`) until it fits within the container's own height, starting
 * from `baseRem` and never going below `minRem`. Re-measures whenever
 * `content` or `baseRem` changes, and on window resize (a projector's
 * resolution — or this window's — can change mid-service).
 *
 * Shared by the projector output and the operator's confidence-monitor
 * preview, so both auto-fit the same way at whatever size their own
 * container allows.
 */
export function useAutoFitFontSize(
  containerRef: React.RefObject<HTMLElement | null>,
  content: unknown,
  baseRem: number,
  minRem = 0.9
): number {
  const [fitRem, setFitRem] = useState(baseRem)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || !content) return
    let raf = 0
    const fit = (): void => {
      const inner = el.firstElementChild as HTMLElement | null
      if (!inner) return
      let size = baseRem
      const floor = Math.max(minRem, baseRem * 0.4)
      el.style.fontSize = `${size}rem`
      let guard = 0
      while (inner.scrollHeight > el.clientHeight + 1 && size > floor && guard < 120) {
        size = Math.max(floor, size - baseRem * 0.04)
        el.style.fontSize = `${size}rem`
        guard++
      }
      setFitRem(size)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, baseRem, minRem])

  return fitRem
}
