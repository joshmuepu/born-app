import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'
import { applyTheme, readCachedTheme } from './useTheme'

// Paint the right theme before the first frame; main reconciles on mount.
applyTheme(readCachedTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
