import { useState, useEffect, useCallback, type ReactElement } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { HymnaryCandidate, HymnaryPreview } from '../types'
import './SongsPanel.css'

interface Props {
  query: string
  onClose: () => void
  onImported: (songId: number) => void
}

type Stage = 'searching' | 'results' | 'preview' | 'importing' | 'error'

/** No local match (or the local match wasn't the right one) — check
 *  Hymnary.org, pick from real distinct hymns/arrangements it found, preview
 *  the exact text before committing, import. Only ever reachable from
 *  Songs search; never automatic, never required. */
export default function HymnaryImport({ query, onClose, onImported }: Props): ReactElement {
  const [stage, setStage] = useState<Stage>('searching')
  const [candidates, setCandidates] = useState<HymnaryCandidate[]>([])
  const [preview, setPreview] = useState<HymnaryPreview | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const runSearch = useCallback(() => {
    setStage('searching')
    window.electronAPI
      .hymnarySearch(query)
      .then((r) => {
        setCandidates(r)
        setStage('results')
      })
      .catch(() => {
        setErrorMsg("Couldn't reach the internet — check your connection and try again, or keep browsing offline.")
        setStage('error')
      })
  }, [query])

  useEffect(() => {
    runSearch()
  }, [runSearch])

  const openPreview = (url: string): void => {
    setStage('searching')
    window.electronAPI
      .hymnaryPreview(url)
      .then((r) => {
        if (!r.ok) {
          setErrorMsg(
            r.reason === 'not-public-domain'
              ? `This version isn't public domain${r.copyright ? ` (Hymnary.org lists it as "${r.copyright}")` : ''} — BORN only imports text that's genuinely free to use, so this one can't be added.`
              : "Couldn't load this hymn's text — try a different version, or try again."
          )
          setStage('error')
          return
        }
        setPreview(r)
        setStage('preview')
      })
      .catch(() => {
        setErrorMsg("Couldn't reach the internet — check your connection and try again.")
        setStage('error')
      })
  }

  const doImport = (url: string): void => {
    setStage('importing')
    window.electronAPI
      .hymnaryImport(url)
      .then((r) => {
        if (r.ok) {
          onImported(r.id)
          return
        }
        setErrorMsg(
          r.reason === 'not-public-domain'
            ? `This version isn't public domain${r.copyright ? ` (Hymnary.org lists it as "${r.copyright}")` : ''} — BORN only imports text that's genuinely free to use, so this one can't be added.`
            : "Couldn't import this hymn — try a different version, or try again."
        )
        setStage('error')
      })
      .catch(() => {
        setErrorMsg("Couldn't reach the internet — check your connection and try again.")
        setStage('error')
      })
  }

  return (
    <div className="hymnary-import">
      <div className="hymnary-import-head">
        <button className="browse-back" onClick={onClose}>
          <ChevronLeft width={14} height={14} strokeWidth={2.4} /> Songs
        </button>
        <div className="hymnary-import-title">Check Hymnary.org for &ldquo;{query}&rdquo;</div>
      </div>

      {stage === 'searching' && <div className="songs-empty">Searching Hymnary.org…</div>}
      {stage === 'importing' && <div className="songs-empty">Importing…</div>}

      {stage === 'error' && (
        <div className="hymnary-import-error">
          <p>{errorMsg}</p>
          <button className="btn-secondary btn-sm" onClick={runSearch}>
            Search again
          </button>
        </div>
      )}

      {stage === 'results' && (
        <div className="songs-list">
          {candidates.length === 0 && <div className="songs-empty">No matches found on Hymnary.org either.</div>}
          {candidates.map((c) => (
            <button key={c.url} className="hymnary-candidate-row" onClick={() => openPreview(c.url)}>
              {c.title}
            </button>
          ))}
        </div>
      )}

      {stage === 'preview' && preview?.ok && (
        <div className="hymnary-preview">
          <button className="browse-back" onClick={() => setStage('results')}>
            <ChevronLeft width={14} height={14} strokeWidth={2.4} /> Results
          </button>
          <div className="song-detail-title">
            {preview.title}
            {preview.author ? <span className="song-detail-author"> · {preview.author}</span> : null}
          </div>
          <div className="song-provenance">Public Domain · Hymnary.org</div>
          <div className="song-slides">
            {preview.slides.map((s, i) => (
              <div key={i} className="song-slide">
                {s.label && (
                  <div className="song-slide-head">
                    <div className="song-slide-label">{s.label}</div>
                  </div>
                )}
                <div className="song-slide-text">{s.text}</div>
              </div>
            ))}
          </div>
          <button className="btn-primary btn-sm hymnary-import-btn" onClick={() => doImport(preview.url)}>
            Import into BORN
          </button>
        </div>
      )}
    </div>
  )
}
