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

function remember(t: Theme): void {
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* private mode / disabled storage — the main process is still the source of truth */
  }
}

export function useTheme(): { theme: Theme; toggle: () => void; set: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(readCachedTheme)

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

  return { theme, toggle, set }
}
