import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { ParsedSong } from '../types'
import SongSlideEditor from './SongSlideEditor'
import './SongsPanel.css'

interface Props {
  onClose: () => void
  onSaved: (songId: number) => void
}

const PLACEHOLDER = `Amazing Grace

Amazing grace, how sweet the sound
That saved a wretch like me...

Chorus:
My chains are gone, I've been set free...`

/** Paste a song and see it structured immediately — no separate "paste"
 *  step followed by a separate "review" step. The left side is the plain
 *  text; the right side is the same live, editable slide breakdown
 *  SongSlideEditor gives every other import path, kept in sync with the
 *  left as you type until you touch a slide yourself, at which point your
 *  edits win and re-typing on the left just offers to re-detect rather than
 *  silently overwriting what you just fixed. */
export default function PasteSongScreen({ onClose, onSaved }: Props) {
  const [raw, setRaw] = useState('')
  const [song, setSong] = useState<ParsedSong | null>(null)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reparse = useCallback((text: string) => {
    if (!text.trim()) {
      setSong(null)
      return
    }
    window.electronAPI.parsePastedText(text).then((r) => {
      setSong('error' in r ? null : r)
    })
  }, [])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const handleRawChange = (text: string): void => {
    setRaw(text)
    if (touched) return // the operator is already fine-tuning the right side — don't clobber it
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => reparse(text), 200)
  }

  const handleRedetect = (): void => {
    setTouched(false)
    reparse(raw)
  }

  const handleSongChange = (next: ParsedSong): void => {
    setTouched(true)
    setSong(next)
  }

  const handleSave = async (): Promise<void> => {
    if (!song) return
    setSaving(true)
    setError(null)
    try {
      const r = await window.electronAPI.commitReviewedSong(song)
      onSaved(r.id)
    } catch {
      setError("Couldn't save — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="paste-song">
      <div className="hymnary-import-head">
        <button className="browse-back" onClick={onClose}>
          <ChevronLeft width={14} height={14} strokeWidth={2.4} /> Songs
        </button>
        <div className="hymnary-import-title">Paste a song</div>
      </div>

      <div className="paste-song-split">
        <div className="paste-song-raw">
          <textarea
            className="paste-song-textarea"
            autoFocus
            value={raw}
            onChange={(e) => handleRawChange(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
          />
          <p className="paste-song-hint">
            First line is the title. Leave a blank line between verses. Start a line with
            "Chorus:" (or "Refrain", "Bridge"…) to label it.
          </p>
        </div>
        <div className="paste-song-preview">
          {song ? (
            <>
              <SongSlideEditor song={song} onChange={handleSongChange} />
              {touched && (
                <button className="btn-quiet btn-sm paste-song-redetect" onClick={handleRedetect}>
                  Undo my edits — re-detect from the text on the left
                </button>
              )}
            </>
          ) : (
            <div className="songs-empty">
              {raw.trim() ? 'No lyrics detected yet — keep typing or pasting.' : 'Paste or type a song on the left to see it here.'}
            </div>
          )}
        </div>
      </div>

      {error && <div className="hymnary-import-error">{error}</div>}

      <div className="paste-song-actions">
        <button className="btn-secondary btn-sm" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn-primary btn-sm" onClick={handleSave} disabled={!song || saving}>
          {saving ? 'Saving…' : 'Save song'}
        </button>
      </div>
    </div>
  )
}
