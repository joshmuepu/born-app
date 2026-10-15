import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const KEY = 'born.theme'

/** Stamp the theme onto <html> so the CSS custom properties switch. */
export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t
}

/** A synchronous best guess for the first paint (main.tsx uses this before
 *  React mounts); the authoritative value comes from the main process. */
export function readCachedTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

const CONTRAST_KEY = 'born.contrast'

/** High contrast is a renderer-only overlay on whichever theme is active
 *  (html[data-contrast='true']), so it needs no main-process setting. */
export function readCachedContrast(): boolean {
  try {
    return localStorage.getItem(CONTRAST_KEY) === '1'
  } catch {
    return false
  }
}

export function applyContrast(on: boolean): void {
  if (on) document.documentElement.dataset.contrast = 'true'
  else delete document.documentElement.dataset.contrast
}

function remember(t: Theme): void {
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* private mode / disabled storage — the main process is still the source of truth */
  }
}

export function useTheme(): {
  theme: Theme
  toggle: () => void
  set: (t: Theme) => void
  contrast: boolean
  toggleContrast: () => void
} {
  const [theme, setThemeState] = useState<Theme>(readCachedTheme)
  const [contrast, setContrast] = useState<boolean>(readCachedContrast)

  const toggleContrast = useCallback(() => {
    setContrast((c) => {
      const next = !c
      applyContrast(next)
      try {
        localStorage.setItem(CONTRAST_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  useEffect(() => {
    window.electronAPI.getTheme().then((t) => {
      setThemeState(t)
      applyTheme(t)
      remember(t)
    })
    return window.electronAPI.onThemeChanged((t) => {
      setThemeState(t)
      applyTheme(t)
      remember(t)
    })
  }, [])

  const set = useCallback((t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    remember(t)
    window.electronAPI.setTheme(t)
  }, [])

  const toggle = useCallback(
    () => set(theme === 'light' ? 'dark' : 'light'),
    [theme, set]
  )

  return { theme, toggle, set, contrast, toggleContrast }
}
