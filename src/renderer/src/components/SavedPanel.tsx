import { useEffect, useRef, useState } from 'react'
import { Star, Clock, Mic, BookOpen, Music, X } from 'lucide-react'
import type { Quote, SongSummary } from '../types'
import { useFavorites, toggleFavorite, type Favorite } from '../favorites'
import './SavedPanel.css'

interface Props {
  open: boolean
  onClose: () => void
  onOpenSermon: (sermonId: number, anchorRef: string) => void
  onOpenVerse: (v: { bookNum: number; chapter: number; verse: number }) => void
  onOpenSong: (songId: number) => void
  onAddFavorite: (fav: Favorite) => void
}

/** Favorites and recents in one slide-over, reached from the rail — a clean
 *  place for "the things I keep coming back to" so the browse columns stay
 *  about browsing. Opening something only navigates; it never projects. */
export default function SavedPanel({
  open,
  onClose,
  onOpenSermon,
  onOpenVerse,
  onOpenSong,
  onAddFavorite
}: Props): JSX.Element | null {
  const { list } = useFavorites()
  const [tab, setTab] = useState<'favorites' | 'recent'>('favorites')
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([])
  const [recentVerses, setRecentVerses] = useState<Array<{ reference: string; translation: string }>>([])
  const [recentSongs, setRecentSongs] = useState<SongSummary[]>([])
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    Promise.all([
      window.electronAPI.getRecentSermons().catch(() => [] as Quote[]),
      window.electronAPI.getRecentBibleRefs().catch(() => []),
      window.electronAPI.getRecentSongs().catch(() => [] as SongSummary[])
    ]).then(([q, v, s]) => {
      if (!alive) return
      setRecentQuotes(q.slice(0, 15))
      setRecentVerses(v.slice(0, 15))
      setRecentSongs(s.slice(0, 15))
    })
    ref.current?.focus()
    return () => {
      alive = false
    }
  }, [open])

  if (!open) return null

  const openFav = (f: Favorite): void => {
    onClose()
    if (f.kind === 'sermon') onOpenSermon(f.quote.sermonId, f.quote.paragraphRef)
    else if (f.kind === 'verse') onOpenVerse({ bookNum: f.bookNum, chapter: f.chapter, verse: f.verse })
    else onOpenSong(f.songId)
  }
  const Icon = (k: Favorite['kind']): typeof Mic => (k === 'sermon' ? Mic : k === 'verse' ? BookOpen : Music)

  return (
    <aside
      ref={ref}
      className="saved-panel"
      tabIndex={-1}
      aria-label="Favorites and recents"
      onKeyDown={(e) => {
        // Esc here closes the panel — and must not also blank the screen.
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="saved-head">
        <div className="saved-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'favorites'} className={tab === 'favorites' ? 'is-active' : ''} onClick={() => setTab('favorites')}>
            <Star width={14} height={14} strokeWidth={2.2} aria-hidden="true" /> Favorites
          </button>
          <button role="tab" aria-selected={tab === 'recent'} className={tab === 'recent' ? 'is-active' : ''} onClick={() => setTab('recent')}>
            <Clock width={14} height={14} strokeWidth={2.2} aria-hidden="true" /> Recent
          </button>
        </div>
        <button className="btn-icon btn-sm" onClick={onClose} aria-label="Close">
          <X width={15} height={15} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      <div className="saved-body">
        {tab === 'favorites' ? (
          list.length === 0 ? (
            <p className="saved-empty">
              Nothing starred yet. Right-click a sermon paragraph, a verse or a song and choose <b>Favorite</b>.
            </p>
          ) : (
            list.map((f) => {
              const I = Icon(f.kind)
              return (
                <div key={f.id} className={`saved-row saved-row--${f.kind}`}>
                  <button className="saved-open" onClick={() => openFav(f)} title="Open — this does not put it on the screen">
                    <I width={15} height={15} strokeWidth={2} aria-hidden="true" />
                    <span className="saved-text">
                      <span className="saved-title">{f.title}</span>
                      <span className="saved-sub">{f.subtitle}</span>
                    </span>
                  </button>
                  <button
                    className="saved-add"
                    onClick={() => onAddFavorite(f)}
                    title="Add to the queue"
                    aria-label={`Add ${f.title} to the queue`}
                  >
                    + Queue
                  </button>
                  <button
                    className="saved-remove"
                    onClick={() => toggleFavorite(f)}
                    title="Remove from favorites"
                    aria-label={`Remove ${f.title} from favorites`}
                  >
                    <X width={13} height={13} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
              )
            })
          )
        ) : (
          <>
            <div className="saved-group">Sermons</div>
            {recentQuotes.length === 0 && <p className="saved-empty">Nothing used yet.</p>}
            {recentQuotes.map((q, i) => (
              <div key={`q${i}`} className="saved-row saved-row--sermon">
                <button
                  className="saved-open"
                  onClick={() => {
                    onClose()
                    onOpenSermon(q.sermonId, q.paragraphRef)
                  }}
                >
                  <Mic width={15} height={15} strokeWidth={2} aria-hidden="true" />
                  <span className="saved-text">
                    <span className="saved-title">{q.sermonTitle}</span>
                    <span className="saved-sub">{q.dateCode} · ¶{q.paragraphRef}</span>
                  </span>
                </button>
              </div>
            ))}
            <div className="saved-group">Verses</div>
            {recentVerses.length === 0 && <p className="saved-empty">Nothing looked up yet.</p>}
            {recentVerses.map((v, i) => (
              <div key={`v${i}`} className="saved-row saved-row--verse">
                <button
                  className="saved-open"
                  onClick={() => {
                    onClose()
                    window.electronAPI.lookupPassage(v.reference, v.translation).then((r) => {
                      const p = r as { bookNum?: number; chapter?: number; verseStart?: number; error?: string }
                      if (p && !p.error && p.bookNum != null && p.chapter != null) {
                        onOpenVerse({ bookNum: p.bookNum, chapter: p.chapter, verse: p.verseStart ?? 1 })
                      }
                    })
                  }}
                >
                  <BookOpen width={15} height={15} strokeWidth={2} aria-hidden="true" />
                  <span className="saved-text">
                    <span className="saved-title">{v.reference}</span>
                    <span className="saved-sub">{v.translation}</span>
                  </span>
                </button>
              </div>
            ))}
            <div className="saved-group">Songs</div>
            {recentSongs.length === 0 && <p className="saved-empty">Nothing played yet.</p>}
            {recentSongs.map((s) => (
              <div key={`s${s.id}`} className="saved-row saved-row--song">
                <button
                  className="saved-open"
                  onClick={() => {
                    onClose()
                    onOpenSong(s.id)
                  }}
                >
                  <Music width={15} height={15} strokeWidth={2} aria-hidden="true" />
                  <span className="saved-text">
                    <span className="saved-title">{s.title}</span>
                  </span>
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  )
}
