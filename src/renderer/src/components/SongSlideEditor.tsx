import { Scissors, Trash2 } from 'lucide-react'
import type { ParsedSong, ParsedSongSlide } from '../types'

interface Props {
  song: ParsedSong
  onChange: (song: ParsedSong) => void
}

const LABEL_OPTIONS = ['Verse', 'Chorus', 'Bridge', 'Pre-Chorus', 'Intro', 'Outro', 'Tag', 'Ending']

/** The one editable "here's what we detected, fix anything before it's
 *  saved" surface — shared by pasted text, an imported file, and a
 *  Hymnary/Cyber Hymnal preview alike, so correcting a guessed label or a
 *  split verse looks and works the same no matter where the song came from. */
export default function SongSlideEditor({ song, onChange }: Props) {
  const setSlides = (slides: ParsedSongSlide[]): void => onChange({ ...song, slides })

  const updateSlide = (i: number, patch: Partial<ParsedSongSlide>): void => {
    setSlides(song.slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  const removeSlide = (i: number): void => setSlides(song.slides.filter((_, idx) => idx !== i))
  const addSlide = (): void => setSlides([...song.slides, { label: undefined, text: '' }])

  /** Roughly in half by line — good enough for the common case (a verse with
   *  an internal blank line, or two stanzas that landed as one block); the
   *  operator can still hand-edit either half afterward. */
  const splitSlide = (i: number): void => {
    const lines = song.slides[i].text.split('\n')
    if (lines.length < 2) return
    const mid = Math.ceil(lines.length / 2)
    const a: ParsedSongSlide = { ...song.slides[i], text: lines.slice(0, mid).join('\n').trim() }
    const b: ParsedSongSlide = { label: undefined, text: lines.slice(mid).join('\n').trim() }
    const next = [...song.slides]
    next.splice(i, 1, a, b)
    setSlides(next)
  }

  const mergeWithNext = (i: number): void => {
    if (i >= song.slides.length - 1) return
    const a = song.slides[i]
    const b = song.slides[i + 1]
    const next = [...song.slides]
    next.splice(i, 2, { label: a.label, text: `${a.text}\n\n${b.text}` })
    setSlides(next)
  }

  return (
    <div className="song-editor">
      <input
        className="song-editor-title"
        value={song.title}
        onChange={(e) => onChange({ ...song, title: e.target.value })}
        placeholder="Song title"
      />
      <div className="song-editor-meta-row">
        <input
          className="song-editor-field"
          value={song.author ?? ''}
          onChange={(e) => onChange({ ...song, author: e.target.value || undefined })}
          placeholder="Author (optional)"
        />
        <input
          className="song-editor-field"
          value={song.ccli ?? ''}
          onChange={(e) => onChange({ ...song, ccli: e.target.value || undefined })}
          placeholder="CCLI Song # (optional)"
        />
      </div>

      <datalist id="song-editor-label-options">
        {LABEL_OPTIONS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>

      <div className="song-editor-slides">
        {song.slides.map((s, i) => (
          <div className="song-editor-slide" key={i}>
            <div className="song-editor-slide-head">
              <input
                className="song-editor-slide-label"
                value={s.label ?? ''}
                onChange={(e) => updateSlide(i, { label: e.target.value || undefined })}
                placeholder="No label"
                list="song-editor-label-options"
              />
              <div className="song-editor-slide-actions">
                <button
                  type="button"
                  className="song-editor-slide-btn"
                  title="Split into two slides"
                  disabled={s.text.split('\n').length < 2}
                  onClick={() => splitSlide(i)}
                >
                  <Scissors width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="song-editor-slide-btn"
                  title="Merge with the next slide"
                  disabled={i === song.slides.length - 1}
                  onClick={() => mergeWithNext(i)}
                >
                  Merge ↓
                </button>
                <button
                  type="button"
                  className="song-editor-slide-btn"
                  title="Remove this slide"
                  onClick={() => removeSlide(i)}
                >
                  <Trash2 width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            </div>
            <textarea
              className="song-editor-slide-text"
              value={s.text}
              onChange={(e) => updateSlide(i, { text: e.target.value })}
              rows={Math.max(2, s.text.split('\n').length)}
            />
          </div>
        ))}
        <button type="button" className="btn-secondary btn-sm song-editor-add" onClick={addSlide}>
          + Add slide
        </button>
      </div>
    </div>
  )
}
