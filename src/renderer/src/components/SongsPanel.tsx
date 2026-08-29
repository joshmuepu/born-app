import { useState, useEffect, useCallback, useRef } from 'react'
import type { SongSummary, SongDetail } from '../types'
import './SongsPanel.css'

interface Props {
  visible: boolean
  onAddSong: (song: SongDetail) => void
  onProjectSong: (song: SongDetail, slide?: number) => void
}

export default function SongsPanel({ visible, onAddSong, onProjectSong }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SongSummary[]>([])
  const [selected, setSelected] = useState<SongDetail | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)

  const runSearch = useCallback((q: string) => {
    window.electronAPI.searchSongs(q).then(setResults)
  }, [])

  useEffect(() => {
    if (visible && !loaded.current) {
      loaded.current = true
      runSearch('')
    }
  }, [visible, runSearch])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => runSearch(query), 200)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query, runSearch])

  const openSong = useCallback((id: number) => {
    window.electronAPI.getSong(id).then(setSelected)
  }, [])

  const handleImport = useCallback(async () => {
    setImportMsg('Importing…')
    const r = await window.electronAPI.importSongs()
    if (!r) {
      setImportMsg(null)
      return
    }
    const parts: string[] = []
    if (r.added.length) parts.push(`${r.added.length} added`)
    if (r.skipped) parts.push(`${r.skipped} already present`)
    if (r.failed.length) parts.push(`${r.failed.length} failed`)
    setImportMsg(parts.join(' · ') || 'Nothing imported')
    runSearch(query)
    setTimeout(() => setImportMsg(null), 6000)
  }, [query, runSearch])

  const handleDelete = useCallback(
    async (id: number) => {
      if (await window.electronAPI.deleteSong(id)) {
        setSelected(null)
        runSearch(query)
      }
    },
    [query, runSearch]
  )

  return (
    <div className="songs-panel">
      <div className="songs-toolbar">
        <input
          className="search-input"
          placeholder="Search songs by title or lyrics…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button className="btn-secondary" onClick={handleImport}>
          Import…
        </button>
      </div>
      {importMsg && <div className="songs-import-msg">{importMsg}</div>}

      {selected ? (
        <div className="song-detail">
          <div className="song-detail-head">
            <button className="browse-back" onClick={() => setSelected(null)}>
              ← Songs
            </button>
            <div className="song-detail-title">
              {selected.title}
              {selected.author ? <span className="song-detail-author"> · {selected.author}</span> : null}
              {selected.songKey ? <span className="song-detail-key">Key of {selected.songKey}</span> : null}
            </div>
            <div className="result-actions">
              <button className="btn-secondary btn-sm" onClick={() => onAddSong(selected)}>
                + Queue
              </button>
              <button className="btn-primary btn-sm" onClick={() => onProjectSong(selected, 0)}>
                Project
              </button>
              {selected.source === 'import' && (
                <button className="btn-secondary btn-sm" onClick={() => handleDelete(selected.id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
          <div className="song-slides">
            {selected.slides.map((s, i) => (
              <div key={i} className="song-slide">
                {s.label && <div className="song-slide-label">{s.label}</div>}
                <div className="song-slide-text">{s.text}</div>
                {selected.songKey && <div className="song-slide-key">{selected.songKey}</div>}
                <button
                  className="btn-secondary btn-sm song-slide-project"
                  onClick={() => onProjectSong(selected, i)}
                >
                  Project
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="songs-list">
          {results.length === 0 && (
            <div className="songs-empty">
              {query ? 'No songs found.' : 'No songs in the library yet — use Import.'}
            </div>
          )}
          {results.map((s) => (
            <div key={s.id} className="song-row" onClick={() => openSong(s.id)}>
              <div className="song-row-title">{s.title}</div>
              <div className="song-row-meta">
                {s.author ? `${s.author} · ` : ''}
                {s.songKey ? `Key of ${s.songKey} · ` : ''}
                {s.slideCount} slide{s.slideCount === 1 ? '' : 's'}
                {s.source === 'import' ? ' · imported' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
