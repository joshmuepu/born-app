import { useState, useCallback } from 'react'
import type { Quote } from '../types'
import SearchBar from './SearchBar'
import ResultsList from './ResultsList'
import BrowsePanel from './BrowsePanel'
import SermonFollowView from './SermonFollowView'
import { findMatchingSlideIndex } from '../highlight'
import { quoteToItem } from '../../../shared/queueItem'

interface Props {
  visible: boolean
  /** Sermon language for Browse and the full-sermon follow view — Search
   *  itself always searches English text (no translated search index exists
   *  yet; see the project's own scoping notes). Defaults to 'en'. */
  language?: string
  /** The paragraph currently on this channel's screen, so its row/card can
   *  be marked live — independent of Main's own onScreen. */
  onScreen?: { sermonId: number; paragraphRef: string } | null
  /** Both "Queue" and "Project" call this — there's no second queue for a
   *  channel to add to, same precedent as the Bible-only operator view. */
  onProject: (quote: Quote, slideIndex?: number) => void
}

/** Scaled-down Sermons surface for a channel's operator modal — Search and
 *  Browse, mirroring Main's own Sermons tab, but self-contained (no service
 *  queue exists for a channel) instead of wired through App.tsx's queue
 *  state the way Main's is. */
export default function ChannelSermonsPanel({ visible, language = 'en', onScreen, onProject }: Props) {
  const [tab, setTab] = useState<'search' | 'browse'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Quote[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [quickSearch, setQuickSearch] = useState<{ term: string; nonce: number } | null>(null)
  const [followSermon, setFollowSermon] = useState<{ sermonId: number; anchorRef: string } | null>(null)

  const handleResults = useCallback((r: Quote[], q: string) => {
    setResults(r)
    setQuery(q)
    setSearched(true)
  }, [])

  const handleOpenSermon = useCallback(
    (quote: Quote) => setFollowSermon({ sermonId: quote.sermonId, anchorRef: quote.paragraphRef }),
    []
  )

  /** Project (from a list row or the follow view) and switch to reading the
   *  whole sermon at that spot — same flow Main's own Search tab gives. */
  const handleProjectResult = useCallback(
    (quote: Quote, slideIndex?: number) => {
      const slide =
        slideIndex !== undefined
          ? slideIndex
          : findMatchingSlideIndex(quoteToItem(quote).slides.map((s) => s.text), query)
      onProject(quote, slide)
      setFollowSermon({ sermonId: quote.sermonId, anchorRef: quote.paragraphRef })
    },
    [onProject, query]
  )

  const liveRef =
    followSermon && onScreen?.sermonId === followSermon.sermonId ? onScreen.paragraphRef : null

  return (
    <div className="channel-sermons-panel">
      {!followSermon && (
        <div className="panel-subtab-bar">
          <button className={`panel-subtab${tab === 'search' ? ' active' : ''}`} onClick={() => setTab('search')}>
            Search
          </button>
          <button className={`panel-subtab${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>
            Browse
          </button>
        </div>
      )}

      <div className="panel-view" hidden={tab !== 'search'}>
        {followSermon ? (
          <SermonFollowView
            sermonId={followSermon.sermonId}
            anchorRef={followSermon.anchorRef}
            liveRef={liveRef}
            query={query}
            language={language}
            onBack={() => setFollowSermon(null)}
            onProject={handleProjectResult}
            onAddToQueue={handleProjectResult}
          />
        ) : (
          <>
            <SearchBar onResults={handleResults} onSearchingChange={setSearching} externalQuery={quickSearch} />
            <ResultsList
              results={results}
              query={query}
              loading={searching}
              searched={searched}
              onScreen={onScreen}
              onAddToQueue={handleProjectResult}
              onSendToProjection={handleProjectResult}
              onOpenSermon={handleOpenSermon}
              onQuickSearch={(term) => setQuickSearch({ term, nonce: Date.now() })}
              onJumpToSermon={(sermonId, anchorRef) => setFollowSermon({ sermonId, anchorRef })}
            />
          </>
        )}
      </div>

      <div className="panel-view" hidden={tab !== 'browse'}>
        <BrowsePanel
          visible={visible && tab === 'browse'}
          onScreen={onScreen}
          onAddToQueue={handleProjectResult}
          onSendToProjection={handleProjectResult}
          initialLanguage={language}
        />
      </div>
    </div>
  )
}
