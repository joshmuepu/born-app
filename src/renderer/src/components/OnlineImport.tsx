import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { OnlineCandidate, OnlinePreview, ParsedSong } from '../types'
import SongReviewScreen from './SongReviewScreen'
import './SongsPanel.css'

interface Props {
  query: string
  onClose: () => void
  onImported: (songId: number) => void
}

type Stage = 'searching' | 'results' | 'preview' | 'error'

const SOURCE_LABEL: Record<OnlineCandidate['source'], string> = {
  hymnary: 'Hymnary.org',
  cyberhymnal: 'Cyber Hymnal'
}

function reasonMessage(reason: string, copyright?: string): string {
  switch (reason) {
    case 'not-public-domain':
    case 'copyrighted':
      return `This version isn't public domain${copyright ? ` (listed as "${copyright}")` : ''} — BORN only imports text that's genuinely free to use, so this one can't be added.`
    case 'blocked':
      return "The source site is temporarily blocking automated requests — wait a moment and try again."
    case 'no-text-on-file':
      return "This source has the hymn indexed, but no full text on file for it — try a different version."
    default:
      return "Couldn't load this hymn's text — try a different version, or try again."
  }
}

/** No local match (or the local match wasn't the right one) — check
 *  Hymnary.org and the Cyber Hymnal together, pick from real distinct hymns
 *  either found, review the exact text (and correct it, same as any other
 *  import) before committing. Only ever reachable from Songs search; never
 *  automatic, never required. */
export default function OnlineImport({ query, onClose, onImported }: Props) {
  const [stage, setStage] = useState<Stage>('searching')
  const [candidates, setCandidates] = useState<OnlineCandidate[]>([])
  const [preview, setPreview] = useState<OnlinePreview | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const runSearch = useCallback(() => {
    setStage('searching')
    window.electronAPI
      .onlineSongSearch(query)
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

  const openPreview = (c: OnlineCandidate): void => {
    setStage('searching')
    window.electronAPI
      .onlineSongPreview(c.url, c.source)
      .then((r) => {
        if (!r.ok) {
          setErrorMsg(reasonMessage(r.reason, r.copyright))
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

  const doImport = async (edited: ParsedSong): Promise<void> => {
    if (!preview?.ok) return
    const r = await window.electronAPI.onlineSongImport(preview.url, preview.source, edited)
    if (r.ok) {
      onImported(r.id)
      return
    }
    setErrorMsg(reasonMessage(r.reason, r.copyright))
    setStage('error')
  }

  if (stage === 'preview' && preview?.ok) {
    return (
      <SongReviewScreen
        song={preview.song}
        reviewKey={preview.url}
        headerTitle={`Import from ${SOURCE_LABEL[preview.source]}`}
        provenanceLabel={preview.provenanceLabel}
        needsConfirmation={preview.needsConfirmation}
        confirmationNote={preview.confirmationNote}
        onClose={() => setStage('results')}
        onSave={doImport}
      />
    )
  }

  return (
    <div className="hymnary-import">
      <div className="hymnary-import-head">
        <button className="browse-back" onClick={onClose}>
          <ChevronLeft width={14} height={14} strokeWidth={2.4} /> Songs
        </button>
        <div className="hymnary-import-title">Check online for &ldquo;{query}&rdquo;</div>
      </div>

      {stage === 'searching' && <div className="songs-empty">Searching Hymnary.org and the Cyber Hymnal…</div>}

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
          {candidates.length === 0 && <div className="songs-empty">No matches found online either.</div>}
          {candidates.map((c) => (
            <button key={`${c.source}:${c.url}`} className="hymnary-candidate-row" onClick={() => openPreview(c)}>
              {c.title}
              <span className="hymnary-candidate-source">{SOURCE_LABEL[c.source]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
