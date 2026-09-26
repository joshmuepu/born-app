import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { ParsedSong } from '../types'
import SongSlideEditor from './SongSlideEditor'
import './SongsPanel.css'

interface Props {
  song: ParsedSong
  /** Changes whenever a genuinely different song is being reviewed (a new
   *  file in a batch, a different online candidate) — resets the local
   *  editable copy back to that song's own detected structure. */
  reviewKey: string
  headerTitle: string
  queueLabel?: string
  provenanceLabel?: string
  needsConfirmation?: boolean
  confirmationNote?: string
  onClose: () => void
  onSkip?: () => void
  onSave: (song: ParsedSong) => Promise<void> | void
}

/** The shared "here's what we found, fix anything before it's saved" screen
 *  — used for a single unstructured file (docx/pdf/txt) and for a
 *  Hymnary/Cyber Hymnal preview alike, so reviewing an import looks and
 *  works the same regardless of where it came from. */
export default function SongReviewScreen({
  song,
  reviewKey,
  headerTitle,
  queueLabel,
  provenanceLabel,
  needsConfirmation,
  confirmationNote,
  onClose,
  onSkip,
  onSave
}: Props) {
  const [edited, setEdited] = useState(song)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEdited(song)
    setConfirmed(false)
    setError(null)
  }, [reviewKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      await onSave(edited)
    } catch {
      setError("Couldn't save — try again.")
    } finally {
      setSaving(false)
    }
  }

  const blocked = !!needsConfirmation && !confirmed

  return (
    <div className="song-review">
      <div className="hymnary-import-head">
        <button className="browse-back" onClick={onClose}>
          <ChevronLeft width={14} height={14} strokeWidth={2.4} /> Songs
        </button>
        <div className="hymnary-import-title">
          {headerTitle}
          {queueLabel ? ` · ${queueLabel}` : ''}
        </div>
      </div>

      {provenanceLabel && <div className="song-provenance">{provenanceLabel}</div>}

      {confirmationNote && (
        <label className="song-review-confirm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>{confirmationNote} I've checked and confirm this is public domain.</span>
        </label>
      )}

      <SongSlideEditor song={edited} onChange={setEdited} />

      {error && <div className="hymnary-import-error">{error}</div>}

      <div className="paste-song-actions">
        {onSkip && (
          <button className="btn-quiet btn-sm" onClick={onSkip} disabled={saving}>
            Skip this one
          </button>
        )}
        <button className="btn-secondary btn-sm" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving || blocked}>
          {saving ? 'Saving…' : 'Save song'}
        </button>
      </div>
    </div>
  )
}
