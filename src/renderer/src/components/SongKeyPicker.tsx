import { useState, useRef, useEffect, type ReactElement } from 'react'
import { MAJOR_KEYS, MINOR_KEYS } from '../../../shared/songKeys'

interface Props {
  songKey: string | null
  onChange: (key: string | null) => void
}

/**
 * The key segment of the song detail header, made clickable — reuses the
 * app's existing Filters-popover visual language (SearchBar.tsx) rather than
 * inventing a new one: click the pill, get a small anchored popover, pick a
 * key or click away. No modal, no Save button — the pick itself is the save.
 */
export default function SongKeyPicker({ songKey, onChange }: Props): ReactElement {
  const [open, setOpen] = useState(false)
  const [recentKeys, setRecentKeys] = useState<string[]>([])
  const popoverRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const openRef = useRef(false)
  openRef.current = open

  useEffect(() => {
    if (open) window.electronAPI.getRecentKeys().then(setRecentKeys)
  }, [open])
  // the keyboard moves into the picker when it opens: to the chosen key, else the first one
  useEffect(() => {
    if (!open) return
    const el = popoverRef.current
    const first = el?.querySelector<HTMLElement>('.song-key-grid:not(.song-key-grid--recent) .song-key-chip.active') ?? el?.querySelector<HTMLElement>('.song-key-chip')
    first?.focus()
  }, [open])

  useEffect(() => {
    const onOutside = (e: MouseEvent): void => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !toggleRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.shiftKey && openRef.current) {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const pick = (key: string | null): void => {
    onChange(key)
    setOpen(false)
    toggleRef.current?.focus()
  }

  return (
    <span className="song-key-picker-wrap">
      <button
        ref={toggleRef}
        type="button"
        className={`song-detail-key${songKey ? '' : ' song-detail-key--empty'}`}
        onClick={() => setOpen((v) => !v)}
        title={songKey ? 'Change the key' : 'Add a key'}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {songKey ? `Key of ${songKey}` : '+ Add key'}
      </button>

      {open && (
        <div className="filter-popover song-key-popover" ref={popoverRef} role="dialog" aria-label="Choose the key">
          {recentKeys.length > 0 && (
            <div className="filter-section">
              <div className="filter-section-label">Recently Used</div>
              <div className="song-key-grid song-key-grid--recent">
                {recentKeys.map((k) => (
                  <button
                    key={k}
                    className={`song-key-chip${k === songKey ? ' active' : ''}`}
                  aria-pressed={k === songKey}
                    onClick={() => pick(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="filter-section">
            <div className="filter-section-label">Major</div>
            <div className="song-key-grid">
              {MAJOR_KEYS.map((k) => (
                <button
                  key={k}
                  className={`song-key-chip${k === songKey ? ' active' : ''}`}
                  aria-pressed={k === songKey}
                  onClick={() => pick(k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-section-label">Minor</div>
            <div className="song-key-grid">
              {MINOR_KEYS.map((k) => (
                <button
                  key={k}
                  className={`song-key-chip${k === songKey ? ' active' : ''}`}
                  aria-pressed={k === songKey}
                  onClick={() => pick(k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-popover-footer">
            <button className="filter-clear" onClick={() => pick(null)}>
              No key
            </button>
            <span />
          </div>
        </div>
      )}
    </span>
  )
}
