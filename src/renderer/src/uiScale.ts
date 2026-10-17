import { useCallback, useEffect, useState } from 'react'

/** Interface size for the operator window.
 *
 *  Done with CSS zoom on the app root, not browser/webContents zoom: Chromium
 *  keeps browser zoom per origin, and the projection output is served from the
 *  same origin, so zooming the control window that way also zooms the
 *  projector (measured: it did). CSS zoom lives in this window's document only,
 *  so the projection and stage windows can never be affected. */
export type UiScaleChoice = 'auto' | 1 | 1.25 | 1.5 | 1.75

const KEY = 'born.uiScale'

/** What "auto" picks for a window `cssWidth` CSS pixels wide. A laptop
 *  (<= ~1900) stays at 100%; a 2560-wide monitor gets 125%; 3000+ gets 150%;
 *  4K-class gets 175%. High OS display scaling already shrinks the CSS width
 *  (a 2560 panel at 200% is 1280 CSS px), so it correctly stays at 100%. */
export function autoUiScale(cssWidth: number): number {
  if (cssWidth >= 3400) return 1.75
  if (cssWidth >= 2800) return 1.5
  if (cssWidth >= 2200) return 1.25
  return 1
}

export function readUiScaleChoice(): UiScaleChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'auto' || v === null) return 'auto'
    const n = Number(v)
    return n === 1 || n === 1.25 || n === 1.5 || n === 1.75 ? n : 'auto'
  } catch {
    return 'auto'
  }
}

/** The zoom currently applied to the app root (1 when none). Pointer
 *  coordinates are in screen pixels while CSS lengths are multiplied by this,
 *  so anything that positions by clientX/clientY must divide by it. */
export function currentUiZoom(): number {
  const v = parseFloat(document.documentElement.style.getPropertyValue('--ui-zoom'))
  return Number.isFinite(v) && v > 0 ? v : 1
}

/** How wide the interface really is, in the units its CSS uses: the window width divided by the interface scale. Media queries cannot say this
 *  (they see the window, not the scaled page), so a 1040 px window at 150 % was laid out as 693 px but styled as 1040. */
export type WidthClass = 'wide' | 'narrow' | 'tight'
export function widthClass(cssWidth: number): WidthClass {
  return cssWidth <= 900 ? 'tight' : cssWidth <= 1100 ? 'narrow' : 'wide'
}

export function applyUiZoom(factor: number): void {
  const root = document.getElementById('root')
  document.documentElement.style.setProperty('--ui-zoom', String(factor))
  if (root) root.style.zoom = factor === 1 ? '' : String(factor)
  document.documentElement.dataset.cssw = widthClass(window.innerWidth / factor)
}

export function useUiScale(): {
  choice: UiScaleChoice
  setChoice: (c: UiScaleChoice) => void
  factor: number
} {
  const [choice, setChoiceState] = useState<UiScaleChoice>(readUiScaleChoice)
  const [factor, setFactor] = useState(1)

  useEffect(() => {
    const apply = (): void => {
      const f = choice === 'auto' ? autoUiScale(window.innerWidth) : choice
      applyUiZoom(f)
      setFactor(f)
    }
    apply()
    let t = 0
    const onResize = (): void => {
      window.clearTimeout(t)
      t = window.setTimeout(apply, 120)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', onResize)
    }
  }, [choice])

  const setChoice = useCallback((c: UiScaleChoice) => {
    try {
      localStorage.setItem(KEY, String(c))
    } catch {
      /* ignore */
    }
    setChoiceState(c)
  }, [])

  return { choice, setChoice, factor }
}
