import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export interface SongImportReviewRow {
  groupId: string
  title: string
  author?: string
  /** First line or two of lyrics, so the operator can recognize the song
   *  without opening it. */
  preview: string
  kind: 'new' | 'conflict'
  /** Only set for a 'conflict' row — the library song this one's title
   *  matched, whose lyrics differ enough to not be treated as the same
   *  song automatically. */
  existingTitle?: string
}

export type SongRowDecision = 'add' | 'use-existing' | 'skip'

export type SongImportReviewResult =
  | { action: 'cancel' }
  | { action: 'import-without-adding' }
  | { action: 'proceed'; decisions: Map<string, SongRowDecision> }

interface Props {
  rows: SongImportReviewRow[]
  onResolve: (result: SongImportReviewResult) => void
}

/** One review step before finishing a queue import that contains songs not
 *  already in this computer's library — lists only the songs that would
 *  actually change something (a clean match needs no decision and never
 *  shows up here). Esc cancels, matching every other dialog in the app. */
export default function SongImportReview({ rows, onResolve }: Props): JSX.Element {
  // 'new' rows default to included; 'conflict' rows default to "add as a
  // separate song" — never silently "use existing," which would be the one
  // way this feature could ever overwrite an operator's own edited lyrics.
  const [decisions, setDecisions] = useState<Map<string, SongRowDecision>>(
    () => new Map(rows.map((r) => [r.groupId, 'add' as SongRowDecision]))
  )
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const addCount = rows.filter((r) => decisions.get(r.groupId) === 'add').length

  const setDecision = (groupId: string, decision: SongRowDecision): void =>
    setDecisions((prev) => {
      const next = new Map(prev)
      next.set(groupId, decision)
      return next
    })

  // Nothing selected means the primary action and "Import without adding"
  // below would do the exact same thing — rather than show two buttons with
  // the same label, disable this one and point at that explicit button.
  const primaryLabel =
    addCount === rows.length
      ? `Add ${addCount === 1 ? 'this song' : `all ${addCount} songs`} and import`
      : `Add ${addCount} song${addCount === 1 ? '' : 's'} and import`

  return (
    <div className="modal-overlay" onClick={() => onResolve({ action: 'cancel' })}>
      <div
        className="modal song-import-review"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onResolve({ action: 'cancel' })
        }}
        tabIndex={-1}
        ref={dialogRef}
        role="dialog"
        aria-label="Add songs from this queue to your library"
      >
        <div className="modal-title-row">
          <h3 className="modal-title">
            {rows.length === 1
              ? "1 song in this queue isn't in your library yet"
              : `${rows.length} songs in this queue aren't in your library yet`}
          </h3>
          <button
            className="btn-icon btn-sm"
            onClick={() => onResolve({ action: 'cancel' })}
            aria-label="Close"
          >
            <X width={15} height={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <p className="modal-hint">
          Add them so they show up in Songs and search next time, or import without adding them —
          they'll still work in this queue either way.
        </p>

        <div className="song-import-review-list">
          {rows.map((row) => {
            const decision = decisions.get(row.groupId) ?? 'add'
            return (
              <div key={row.groupId} className="song-import-review-row">
                {row.kind === 'new' ? (
                  <label className="song-import-review-checkbox">
                    <input
                      type="checkbox"
                      checked={decision === 'add'}
                      onChange={(e) => setDecision(row.groupId, e.target.checked ? 'add' : 'skip')}
                    />
                    <span className="song-import-review-info">
                      <span className="song-import-review-title">
                        {row.title}
                        {row.author && <span className="song-import-review-author"> · {row.author}</span>}
                      </span>
                      <span className="song-import-review-preview">{row.preview}</span>
                    </span>
                  </label>
                ) : (
                  <div className="song-import-review-info">
                    <span className="song-import-review-title">
                      {row.title}
                      {row.author && <span className="song-import-review-author"> · {row.author}</span>}
                    </span>
                    <span className="song-import-review-preview">{row.preview}</span>
                    <span className="song-import-review-conflict-note">
                      Already in your library as “{row.existingTitle}” with different lyrics.
                    </span>
                    <div className="song-import-review-choice" role="radiogroup">
                      <label>
                        <input
                          type="radio"
                          name={`choice-${row.groupId}`}
                          checked={decision === 'add'}
                          onChange={() => setDecision(row.groupId, 'add')}
                        />
                        Add as a separate song
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`choice-${row.groupId}`}
                          checked={decision === 'use-existing'}
                          onChange={() => setDecision(row.groupId, 'use-existing')}
                        />
                        Use my existing version
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="modal-actions song-import-review-actions">
          <button className="btn-secondary" onClick={() => onResolve({ action: 'cancel' })}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            onClick={() => onResolve({ action: 'import-without-adding' })}
          >
            Import without adding
          </button>
          <button
            className="btn-primary"
            disabled={addCount === 0}
            onClick={() => onResolve({ action: 'proceed', decisions })}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
