import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { lazy, Suspense } from 'react'
import './App.css'
import { applyContrast, applyTheme, readCachedContrast, readCachedTheme } from './useTheme'

// Paint the right theme before the first frame; main reconciles on mount.
applyTheme(readCachedTheme())
applyContrast(readCachedContrast())

// Design prototype (Phase 1): isolated, read-only, only reachable explicitly.
const DrillDown = lazy(() => import('./prototype/DrillDown'))
const proto = new URLSearchParams(location.search).get('proto')
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === 'd') {
    location.search = proto ? '' : '?proto=drilldown'
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {proto === 'drilldown' ? (
      <Suspense fallback={null}>
        <DrillDown />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
)
