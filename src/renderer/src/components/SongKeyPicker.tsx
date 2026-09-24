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

  useEffect(() => {
    if (open) window.electronAPI.getRecentKeys().then(setRecentKeys)
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
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const pick = (key: string | null): void => {
    onChange(key)
    setOpen(false)
  }

  return (
    <span className="song-key-picker-wrap">
      <button
        ref={toggleRef}
        type="button"
        className={`song-detail-key${songKey ? '' : ' song-detail-key--empty'}`}
        onClick={() => setOpen((v) => !v)}
        title={songKey ? 'Change the key' : 'Add a key'}
      >
        {songKey ? `Key of ${songKey}` : '+ Add key'}
      </button>

      {open && (
        <div className="filter-popover song-key-popover" ref={popoverRef}>
          {recentKeys.length > 0 && (
            <div className="filter-section">
              <div className="filter-section-label">Recently Used</div>
              <div className="song-key-grid song-key-grid--recent">
                {recentKeys.map((k) => (
                  <button
                    key={k}
                    className={`song-key-chip${k === songKey ? ' active' : ''}`}
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
