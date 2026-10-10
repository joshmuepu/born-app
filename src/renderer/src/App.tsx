import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Sun, Moon, Flame, Eye, EyeOff, X } from 'lucide-react'
import SearchBar from './components/SearchBar'
import ResultsList from './components/ResultsList'
import SermonFollowView from './components/SermonFollowView'
import ServiceQueue from './components/ServiceQueue'
import ScreensMenu from './components/ScreensMenu'
import RemotePanel from './components/RemotePanel'
import BrowsePanel from './components/BrowsePanel'
import BiblePanel from './components/BiblePanel'
import ChannelSermonsPanel from './components/ChannelSermonsPanel'
import SongsPanel from './components/SongsPanel'
import HelpViewer from './components/HelpViewer'
import type {
  Quote,
  IndexerProgress,
  QueueItem,
  Slide,
  SlidePayload,
  SlideSource,
  ResolvedPassage,
  SongDetail,
  RecentService,
  OutputInfo,
  ChannelInfo,
  BibleTranslation,
  Songbook
} from './types'
import { quoteToItem, makeId, migrateQueue, itemTitle } from '../../shared/queueItem'
import { findMatchingSlideIndex } from './highlight'
import { parseReference, isRefError } from '../../shared/bibleRef'
import { reorder, replaceContributorItems, nextFollowSermon, type FollowSermon } from './queueUtils'
import { cursorsFor, fetchAdjacentSlide, type FlowCursors } from './liveNav'
import { useTheme } from './useTheme'
import { newSerialQueue, serialize } from './serialize'

/** Where the projected slide sits in its source — for the "On screen" highlight. */
export type OnScreenLoc =
  | { kind: 'bible'; bookNum: number; chapter: number; verse: number }
  | { kind: 'quote'; sermonId: number; paragraphRef: string }
  | { kind: 'song'; songId: number; slideIndex: number }
  | null

type TopTab = 'sermons' | 'bible' | 'songs'
type SermonsSubTab = 'search' | 'browse'

interface Projected {
  item: QueueItem
  slide: number
  /** Index into serviceQueue, or null when projecting a preview not in the queue. */
  queueIndex: number | null
  /** Source positions of the first / last loaded slide, for Next/Prev flow-through. */
  head?: FlowCursors['head']
  tail?: FlowCursors['tail']
}

/** This slide's structured source identity, for a channel 'follow'-ing
 *  wherever this gets projected — lets main/index.ts re-resolve the same
 *  content in another language instead of just mirroring this exact text.
 *  Bible: re-parses this specific slide's own citation (same technique
 *  onScreenLoc below already uses for the same reason — an item can span
 *  several verses, one per slide, each needing its own). Quote: uses this
 *  slide's own `paragraphRef`, not the parent item's — a quote's paragraphRef
 *  can be a merged range that this one slide only covers part of, and
 *  flow-through (liveNav.ts) appends slides from entirely different
 *  paragraphs onto the same item, so only the slide itself knows its true
 *  source paragraph. Song: no translated-lyric source exists, so there's
 *  nothing to attach. */
export function slideSource(item: QueueItem, s: Slide): SlideSource | undefined {
  if (item.kind === 'bible') {
    const tail = (s.reference || '').split(' · ')
    const ref = tail[0]?.replace(/([0-9]+)[a-z]$/, '$1')
    const p = ref ? parseReference(ref) : null
    if (p && !isRefError(p) && p.verseStart !== null) {
      return { kind: 'bible', bookNum: p.bookNum, chapter: p.chapter, verse: p.verseStart }
    }
    return undefined
  }
  if (item.kind === 'quote') {
    return {
      kind: 'quote',
      sermonId: item.quote.sermonId,
      paragraphRef: s.paragraphRef ?? item.quote.paragraphRef,
      page: s.page ?? 0
    }
  }
  return undefined
}

function slidePayload(item: QueueItem, slide: number): SlidePayload | null {
  const s = item.slides[slide]
  if (!s) return null
  return {
    kind: item.kind,
    text: s.text,
    label: s.label,
    reference: s.reference,
    marker: s.marker,
    source: slideSource(item, s)
  }
}

/** Which table.branham.org sermon-language code a channel's Bible translation
 *  implies — same map (and same reasoning: one language choice, not two to
 *  keep in sync) as main/index.ts's TRANSLATION_SERMON_LANGUAGE, duplicated
 *  here since it's small, shape-only reference data, not authoritative state.
 *  Extend alongside that one when a new non-English Bible translation ships. */
const TRANSLATION_SERMON_LANGUAGE: Record<string, string> = {
  KJV: 'en',
  WEB: 'en',
  ASV: 'en',
  FRLSG: 'fr'
}

export default function App() {
  const [searchResults, setSearchResults] = useState<Quote[]>([])
  /** When set, the search panel shows the whole sermon (scrolled to `anchorRef`)
   *  instead of the results list — opened by clicking a result or projecting one.
   *  `query`/`matchType` are only set when this sermon was actually opened from
   *  a search result — they're what SermonFollowView highlights — so opening a
   *  sermon from Browse or the queue never carries over a stale search term. */
  const [followSermon, setFollowSermon] = useState<FollowSermon | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  /** Bumping this re-runs `term` in SearchBar — how a recent-search chip in
   *  the empty state re-triggers a past search. */
  const [quickSearch, setQuickSearch] = useState<{ term: string; nonce: number } | null>(null)
  const [serviceQueue, setServiceQueue] = useState<QueueItem[]>([])
  /** Ids of queue items actually projected at least once this run — not a
   *  positional "everything before the current index" rule, since operators
   *  jump around and skip items; tracked by id so it survives a reorder and
   *  never marks a skipped item as if it had been shown. Resets on New/Open
   *  service — it describes this run, not a saved property of the file. */
  const [playedIds, setPlayedIds] = useState<Set<string>>(new Set())
  const [projectionOpen, setProjectionOpen] = useState(false)
  const [indexer, setIndexer] = useState<IndexerProgress | null>(null)
  const [projected, setProjected] = useState<Projected | null>(null)
  const [isScreenBlanked, setIsScreenBlanked] = useState(false)
  const [fontSize, setFontSize] = useState(4.5)
  // Reported up by BiblePanel so the remote can request the same translation
  // that's actually live on desktop, instead of being hardcoded to KJV.
  const [bibleTranslation, setBibleTranslation] = useState('KJV')
  const [showAlertDialog, setShowAlertDialog] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertTarget, setAlertTarget] = useState<'stage' | 'congregation' | 'both'>('stage')
  const [appVersion, setAppVersion] = useState('')
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [updateMsg, setUpdateMsg] = useState('')
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [updateStage, setUpdateStage] = useState<
    'idle' | 'downloading' | 'ready' | 'installing' | 'manual' | 'error'
  >('idle')
  const [updatePct, setUpdatePct] = useState(0)
  const [updateFile, setUpdateFile] = useState<string | null>(null)
  const [stageOpen, setStageOpen] = useState(false)
  const [topTab, setTopTab] = useState<TopTab>('sermons')
  const [sermonsTab, setSermonsTab] = useState<SermonsSubTab>('search')
  /** Song the Songs panel should have open (for the follow-along view). */
  const [focusSongId, setFocusSongId] = useState<number | null>(null)
  /** Chapter the Bible panel should show when the operator is previewing a queue
   *  item without projecting it. Cleared the moment anything is projected. */
  const [biblePreview, setBiblePreview] = useState<{
    bookNum: number
    chapter: number
    verse: number
  } | null>(null)
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null)
  const [outputs, setOutputs] = useState<OutputInfo[]>([])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [recents, setRecents] = useState<RecentService[]>([])
  /** Set once on mount — whether sermons.db/library.db were found corrupted
   *  and auto-recovered at startup, so the status line can say exactly
   *  that instead of a generic "needs an internet connection" message. */
  const [dataRecovery, setDataRecovery] = useState<DataRecoveryInfo | null>(null)
  const { theme, toggle: toggleTheme } = useTheme()

  // Channels beyond Main (Phase 5) — each with its own label, persisted
  // translation, and outputs. Empty for every user who hasn't added one.
  const [channels, setChannels] = useState<ChannelInfo[]>([])
  const [availableTranslations, setAvailableTranslations] = useState<BibleTranslation[]>([])
  const [songbooks, setSongbooks] = useState<Songbook[]>([])
  /** Which extra channel's scaled-down operator view is open, if any — a
   *  modal, not a topTab, so it stays fully decoupled from Main's own
   *  sermons/bible/songs navigation and queue. */
  const [openChannelId, setOpenChannelId] = useState<string | null>(null)
  /** Per-channel "what's on screen" for that channel's own BiblePanel
   *  instance to highlight — independent of Main's onScreenLoc, and of every
   *  other channel's, since there's no shared queue to derive it from. */
  const [channelOnScreen, setChannelOnScreen] = useState<
    Record<string, { bookNum: number; chapter: number; verse: number } | null>
  >({})
  /** Same idea as channelOnScreen, for a channel's ChannelSermonsPanel. */
  const [channelSermonOnScreen, setChannelSermonOnScreen] = useState<
    Record<string, { sermonId: number; paragraphRef: string } | null>
  >({})
  /** Which section of a channel's scaled-down operator view is open — reset
   *  to Bible whenever a (possibly different) channel's modal opens. */
  const [channelModalTab, setChannelModalTab] = useState<'bible' | 'sermons'>('bible')

  useEffect(() => {
    window.electronAPI.listChannels().then(setChannels)
    return window.electronAPI.onChannelsChanged(setChannels)
  }, [])

  useEffect(() => {
    window.electronAPI.getBibleTranslations().then(setAvailableTranslations)
  }, [])

  // Only needs a periodic-ish refresh (on mount, and whenever ScreensMenu's
  // Channels section is open and a songbook might have changed in Songs) —
  // no live-push channel for songbooks, same reasoning as every other
  // library-content list (Bible translations, etc.) which is also just
  // fetched once rather than kept hot.
  useEffect(() => {
    window.electronAPI.listSongbooks().then(setSongbooks)
  }, [])

  const handleAddChannel = useCallback(
    (label: string) => {
      window.electronAPI.addChannel(label, bibleTranslation).then(setChannels)
    },
    [bibleTranslation]
  )
  const handleRemoveChannel = useCallback((id: string) => {
    window.electronAPI.removeChannel(id).then(setChannels)
    setOpenChannelId((cur) => (cur === id ? null : cur))
    setChannelOnScreen((cur) => {
      const { [id]: _removed, ...rest } = cur
      return rest
    })
  }, [])
  const handleSetChannelTranslation = useCallback((id: string, translation: string) => {
    window.electronAPI.setChannelTranslation(id, translation).then(setChannels)
  }, [])

  /** Both "Queue" and "Project" do the same thing for a channel's scaled-down
   *  panel — there's no second queue to add to, so Add just projects too. */
  const handleChannelPassage = useCallback((channelId: string, p: ResolvedPassage, slide = 0): void => {
    const s = p.slides[slide] ?? p.slides[0]
    if (!s) return
    const verse = p.slideStarts[slide] ?? p.verseStart
    window.electronAPI.showSlideOnChannel(channelId, {
      kind: 'bible',
      text: s.text,
      label: s.label,
      reference: s.reference,
      marker: s.marker,
      source: { kind: 'bible', bookNum: p.bookNum, chapter: p.chapter, verse }
    })
    setChannelOnScreen((cur) => ({
      ...cur,
      [channelId]: { bookNum: p.bookNum, chapter: p.chapter, verse }
    }))
    window.electronAPI.noteBibleUsed(p.reference, p.translation)
  }, [])

  /** Same precedent as handleChannelPassage: projects a sermon quote straight
   *  to a channel, no queue involved. The quote's own text is used verbatim
   *  (always English — ChannelSermonsPanel's Search tab has no translated
   *  index to search against; Browse already hands back language-native text
   *  via its own initialLanguage prop, so this needs no extra translation
   *  step either way). */
  const handleChannelQuote = useCallback((channelId: string, quote: Quote, slideIndex = 0): void => {
    const item = quoteToItem(quote)
    const payload = slidePayload(item, slideIndex)
    if (!payload) return
    window.electronAPI.showSlideOnChannel(channelId, payload)
    setChannelSermonOnScreen((cur) => ({
      ...cur,
      [channelId]: { sermonId: quote.sermonId, paragraphRef: quote.paragraphRef }
    }))
    window.electronAPI.noteSermonUsed(quote)
  }, [])

  const queueRef = useRef<QueueItem[]>(serviceQueue)
  const projectedRef = useRef<Projected | null>(null)
  const sermonCacheRef = useRef<Map<number, Quote[]>>(new Map())
  const queueLoaded = useRef(false)
  const projectionOpenRef = useRef(false)
  const isScreenBlankedRef = useRef(false)

  useEffect(() => { projectionOpenRef.current = projectionOpen }, [projectionOpen])
  useEffect(() => { isScreenBlankedRef.current = isScreenBlanked }, [isScreenBlanked])
  useEffect(() => { queueRef.current = serviceQueue }, [serviceQueue])
  useEffect(() => { projectedRef.current = projected }, [projected])

  const activeQueueIndex = projected?.queueIndex ?? null

  // True once flow-through has carried the live slide past the queued item's
  // own material (see `advance` below) — the operator is still reading, but
  // no longer reading what was actually queued, which the queue list needs
  // to say plainly rather than just keep showing the original preview text.
  const readingAhead =
    activeQueueIndex != null && projected != null && !!serviceQueue[activeQueueIndex]
      ? projected.slide >= serviceQueue[activeQueueIndex].slides.length
      : false

  // Load persisted queue on mount (migrating the old Quote[] format).
  useEffect(() => {
    window.electronAPI.loadQueue().then((loaded) => {
      queueLoaded.current = true
      const migrated = migrateQueue(loaded)
      if (migrated.length > 0) setServiceQueue(migrated)
    })
  }, [])

  useEffect(() => {
    if (queueLoaded.current) window.electronAPI.saveQueue(serviceQueue)
  }, [serviceQueue])

  // Show the real saved projection text size in the Text control.
  useEffect(() => {
    window.electronAPI.getFontSize().then((s) => {
      if (typeof s === 'number' && s > 0) setFontSize(s)
    })
  }, [])

  // App version + "is there a newer build?" check.
  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion)
    window.electronAPI.checkForUpdate().then(setUpdate)
    const offUpd = window.electronAPI.onUpdateAvailable(setUpdate)
    const offPrg = window.electronAPI.onDownloadProgress(({ received, total }) => {
      setUpdatePct(total > 0 ? Math.round((received / total) * 100) : 0)
    })
    return () => {
      offUpd()
      offPrg()
    }
  }, [])

  const handleCheckForUpdate = useCallback(() => {
    setUpdateMsg('Checking…')
    window.electronAPI.checkForUpdate().then((u) => {
      setUpdate(u)
      setUpdateDismissed(false)
      // checkFailed means the check itself couldn't complete (offline,
      // GitHub unreachable, …) — hasUpdate is just the unchanged default
      // false in that case, not a real answer, so this must not be reported
      // as "you're up to date."
      setUpdateMsg(
        u.checkFailed
          ? "Couldn't check for updates — check your internet connection."
          : u.hasUpdate
            ? ''
            : `You're on the latest version (${u.current}).`
      )
      if (!u.hasUpdate) setTimeout(() => setUpdateMsg(''), 4000)
    })
  }, [])

  const handleDownloadUpdate = useCallback(async () => {
    setUpdateStage('downloading')
    setUpdatePct(0)
    const r = await window.electronAPI.downloadUpdate()
    if (!r.ok || !r.path) {
      setUpdateStage('error')
      setUpdateMsg(r.error || 'Download failed.')
      return
    }
    // Downloaded — wait for the operator to choose when to restart.
    setUpdateFile(r.path)
    setUpdateStage('ready')
  }, [])

  const handleRestartToUpdate = useCallback(async () => {
    if (!updateFile) return
    setUpdateStage('installing')
    // Fully-automatic install; fall back to the manual hand-off if it can't.
    const applied = await window.electronAPI.applyUpdate(updateFile)
    if (applied.ok) {
      window.electronAPI.quitApp() // the helper swaps + relaunches on the new version
      return
    }
    if (applied.error) {
      setUpdateStage('error')
      setUpdateMsg(applied.error)
      return
    }
    const inst = await window.electronAPI.runInstaller(updateFile)
    if (!inst.ok) {
      setUpdateStage('error')
      setUpdateMsg(inst.error || 'Could not open the installer.')
      return
    }
    setUpdateStage('manual')
  }, [updateFile])


  useEffect(() => {
    window.electronAPI.listDisplays().then(setDisplayInfo)
    return window.electronAPI.onDisplaysInfo(setDisplayInfo)
  }, [])

  useEffect(() => {
    window.electronAPI.listOutputs().then(setOutputs)
    return window.electronAPI.onOutputsChanged(setOutputs)
  }, [])

  useEffect(() => {
    const unProj = window.electronAPI.onProjectionClosed(() => {
      setProjectionOpen(false)
      setIsScreenBlanked(false)
      // Closing the projection ends the current "on screen" — clear it so the
      // confidence monitor and source highlights don't point at a stale slide.
      projectedRef.current = null
      setProjected(null)
    })
    const unStage = window.electronAPI.onStageClosed(() => setStageOpen(false))
    const unBlank = window.electronAPI.onOperatorBlankChanged((blank) => setIsScreenBlanked(blank))
    return () => {
      unProj()
      unStage()
      unBlank()
    }
  }, [])

  useEffect(() => {
    window.electronAPI.getIndexerStatus().then(setIndexer)
    return window.electronAPI.onIndexerProgress(setIndexer)
  }, [])

  // ── Projection ─────────────────────────────────────────────────────────────

  const ensureProjectionOpen = useCallback(async () => {
    if (!projectionOpenRef.current) {
      await window.electronAPI.openProjection()
      setProjectionOpen(true)
    }
  }, [])

  const doProject = useCallback(
    async (
      item: QueueItem,
      slide: number,
      queueIndex: number | null,
      cursors?: FlowCursors
    ) => {
      const payload = slidePayload(item, slide)
      if (!payload) return
      await ensureProjectionOpen()

      // Private copy so Next/Prev flow-through never mutates the queued item.
      const stored: QueueItem = { ...item, slides: item.slides.map((s) => ({ ...s })) }
      const c = cursors ?? cursorsFor(item)
      const next: Projected = { item: stored, slide, queueIndex, head: c.head, tail: c.tail }
      projectedRef.current = next
      setProjected(next)
      // Marked here, not in the queue-row click handler — flow-through
      // re-invokes doProject with the same queueIndex on the same item, so
      // this only ever adds an id, never needs to check "is this already
      // the active one" itself.
      if (queueIndex != null) {
        setPlayedIds((prev) => (prev.has(item.id) ? prev : new Set(prev).add(item.id)))
      }
      setIsScreenBlanked(false)
      setBiblePreview(null) // projecting anything ends a queue-item preview
      if (item.kind === 'song') setFocusSongId(item.songId)
      window.electronAPI.showSlide(payload)

      // Stage view: current slide + the next one, when it's already loaded.
      const nextPayload =
        slide + 1 < stored.slides.length ? slidePayload(stored, slide + 1) : null
      window.electronAPI.updateStage(payload, nextPayload)
    },
    [ensureProjectionOpen]
  )

  // Next / Prev walk the current item's slides; past either end they flow into
  // the source (next sermon paragraph, next Bible verse — rolling across
  // chapters). They never jump to another queue item — that's a click.
  // Returns whether it actually moved anything — flow-through means "next"
  // rarely runs out, but it genuinely can (Revelation 22:21, a sermon
  // transcript's last paragraph), and the caller needs to know so it can
  // give feedback instead of leaving a click looking like it did nothing.
  // Two independent callers can race here — the remote's Next button and the
  // keyboard shortcut firing within the same tick, or two rapid taps on
  // either one. doProject() awaits ensureProjectionOpen() before it updates
  // projectedRef, so without serializing, a second call starting before the
  // first finishes reads the same (stale) projectedRef.current, computes the
  // same target slide, and the two taps net out to a single advance instead
  // of two. serialize() makes a call only ever start reading state once the
  // one before it has actually finished writing it.
  const advanceQueueRef = useRef(newSerialQueue())
  const advance = useCallback(
    (dir: 'next' | 'prev'): Promise<boolean> =>
      serialize(advanceQueueRef.current, async () => {
        const p = projectedRef.current
        const q = queueRef.current
        if (!p) {
          if (q.length > 0) {
            await doProject(q[0], 0, 0)
            return true
          }
          return false
        }
        const step = dir === 'next' ? 1 : -1
        const target = p.slide + step

        if (target >= 0 && target < p.item.slides.length) {
          await doProject(p.item, target, p.queueIndex, { head: p.head, tail: p.tail })
          return true
        }

        if (dir === 'next') {
          const ext = await fetchAdjacentSlide(p.tail, 'next', sermonCacheRef.current)
          if (!ext) return false
          const slides = [...p.item.slides, ext.slide]
          await doProject({ ...p.item, slides }, slides.length - 1, p.queueIndex, {
            head: p.head,
            tail: ext.cursor
          })
        } else {
          const ext = await fetchAdjacentSlide(p.head, 'prev', sermonCacheRef.current)
          if (!ext) return false
          const slides = [ext.slide, ...p.item.slides]
          await doProject({ ...p.item, slides }, 0, p.queueIndex, { head: ext.cursor, tail: p.tail })
        }
        return true
      }),
    [doProject]
  )

  const handleNext = useCallback(() => advance('next'), [advance])
  const handlePrev = useCallback(() => advance('prev'), [advance])

  useEffect(() => window.electronAPI.onQueueNavigate((dir) => advance(dir)), [advance])

  // "Next" preview text (confidence monitor + remote) — a queue item only ever
  // holds the slides loaded so far, not the whole source. Sitting on the last
  // loaded slide of a Bible passage or sermon quote does NOT mean the source
  // is exhausted — Next still rolls into the next verse/paragraph via
  // fetchAdjacentSlide (see advance() above). Previously this was inferred
  // from item.slides[slide + 1] alone, so it always said "End of this item —
  // pick the next one" on that last loaded slide even when pressing Next
  // would clearly continue. Peek at the real source with the same read-only
  // fetch, without touching the projected item, so the preview matches what
  // Next will actually do. Songs have no flow-through (cursorsFor returns no
  // tail for them), so fetchAdjacentSlide correctly resolves to null there —
  // "end of item" stays accurate for songs.
  const [nextPreviewText, setNextPreviewText] = useState<string | undefined>(undefined)
  useEffect(() => {
    const p = projected
    if (!p) {
      setNextPreviewText(undefined)
      return
    }
    const loaded = p.item.slides[p.slide + 1]?.text
    if (loaded !== undefined) {
      setNextPreviewText(loaded)
      return
    }
    setNextPreviewText(undefined)
    fetchAdjacentSlide(p.tail, 'next', sermonCacheRef.current).then((ext) => {
      if (projectedRef.current !== p) return // stale — a newer projection landed first
      setNextPreviewText(ext?.slide.text)
    })
  }, [projected])

  // ── Queue ──────────────────────────────────────────────────────────────────

  const addToQueue = useCallback((items: QueueItem[]) => {
    const next = [...queueRef.current, ...items]
    queueRef.current = next
    setServiceQueue(next)
  }, [])

  const handleAddQuote = useCallback(
    (quote: Quote) => {
      addToQueue([quoteToItem(quote)])
      window.electronAPI.noteSermonUsed(quote)
    },
    [addToQueue]
  )
  const handleProjectQuote = useCallback(
    (quote: Quote, slideIndex = 0) => {
      doProject(quoteToItem(quote), slideIndex, null)
      window.electronAPI.noteSermonUsed(quote)
      // Switch the results list to the whole-sermon follow view. Used both by
      // Browse (never a search) and by "Restart here" on a paragraph inside
      // an already-open follow view — nextFollowSermon keeps the existing
      // query/matchType only when this is the sermon already being followed.
      setFollowSermon((prev) => nextFollowSermon(prev, quote))
    },
    [doProject]
  )
  /** Same as handleProjectQuote, but for a search result specifically: a long
   *  paragraph splits into several slides, and the word the operator searched
   *  for can land on any of them — open on the one that actually has it
   *  instead of always page 1, so it's on screen without extra Next clicks.
   *  `query` defaults to the desktop search box's own text, but the web
   *  remote passes its own query explicitly since it isn't the same search. */
  const handleProjectSearchResult = useCallback(
    (quote: Quote, query: string = searchQuery, slideIndex?: number) => {
      const item = quoteToItem(quote)
      const slide =
        slideIndex !== undefined
          ? slideIndex
          : findMatchingSlideIndex(item.slides.map((s) => s.text), query)
      doProject(item, slide, null)
      window.electronAPI.noteSermonUsed(quote)
      setFollowSermon({
        sermonId: quote.sermonId,
        anchorRef: quote.paragraphRef,
        query,
        matchType: quote.matchType
      })
    },
    [doProject, searchQuery]
  )
  /** Click a search result: open the whole sermon at that paragraph, no projection. */
  const handleOpenSermon = useCallback(
    (quote: Quote) =>
      setFollowSermon({
        sermonId: quote.sermonId,
        anchorRef: quote.paragraphRef,
        query: searchQuery,
        matchType: quote.matchType
      }),
    [searchQuery]
  )

  const passageToItem = (p: ResolvedPassage): QueueItem => ({
    kind: 'bible',
    id: makeId('b'),
    translation: p.translation,
    reference: p.reference,
    bookNum: p.bookNum,
    chapter: p.chapter,
    verseStart: p.verseStart,
    verseEnd: p.verseEnd,
    slides: p.slides.map((s) => ({
      text: s.text,
      label: s.label,
      reference: s.reference,
      marker: s.marker
    }))
  })

  const handleAddPassage = useCallback(
    (p: ResolvedPassage) => {
      addToQueue([passageToItem(p)])
      window.electronAPI.noteBibleUsed(p.reference, p.translation)
    },
    [addToQueue]
  )
  const handleProjectPassage = useCallback(
    (p: ResolvedPassage, slide = 0) => {
      doProject(passageToItem(p), slide, null)
      window.electronAPI.noteBibleUsed(p.reference, p.translation)
    },
    [doProject]
  )

  const songToItem = (s: SongDetail): QueueItem => {
    const ref = [s.title, s.author, s.songKey ? `Key of ${s.songKey}` : null]
      .filter(Boolean)
      .join(' · ')
    return {
      kind: 'song',
      id: makeId('s'),
      songId: s.id,
      title: s.title,
      author: s.author ?? undefined,
      slides: s.slides.map((sl) => ({
        text: sl.text,
        label: sl.label ?? undefined,
        reference: ref
      }))
    }
  }

  const handleAddSong = useCallback(
    (s: SongDetail) => {
      addToQueue([songToItem(s)])
      window.electronAPI.noteSongUsed(s.id)
    },
    [addToQueue]
  )
  const handleProjectSong = useCallback(
    (s: SongDetail, slide = 0) => {
      doProject(songToItem(s), slide, null)
      setFocusSongId(s.id)
      window.electronAPI.noteSongUsed(s.id)
    },
    [doProject]
  )

  /** Take the source panel to a queue item — its whole sermon / chapter / song,
   *  scrolled to the right spot. `preview` = navigate only (a click); otherwise
   *  it's paired with projecting. Same experience as the search / Bible / Songs
   *  panels. */
  const followForItem = useCallback((item: QueueItem, preview = false) => {
    if (item.kind === 'quote') {
      setTopTab('sermons')
      setSermonsTab('search')
      setFollowSermon({ sermonId: item.quote.sermonId, anchorRef: item.quote.paragraphRef })
    } else if (item.kind === 'bible') {
      setTopTab('bible')
      if (preview) setBiblePreview({ bookNum: item.bookNum, chapter: item.chapter, verse: item.verseStart })
    } else if (item.kind === 'song') {
      setTopTab('songs')
      setFocusSongId(item.songId)
    }
  }, [])

  const handleProjectFromQueue = useCallback(
    (index: number, slide = 0) => {
      const item = queueRef.current[index]
      if (!item) return
      doProject(item, slide, index)
      followForItem(item)
    },
    [doProject, followForItem]
  )

  /** Click a queue row (not its Project button): go to that item in the source
   *  panel to read / prepare it, without touching the screens. */
  const handleSelectFromQueue = useCallback(
    (index: number) => {
      const item = queueRef.current[index]
      if (item) followForItem(item, true)
    },
    [followForItem]
  )

  /** Jump to the next / previous item in the service queue (never automatic —
   *  Next/Prev only walk the current item's own content). */
  const projectQueueDelta = useCallback(
    (step: 1 | -1) => {
      const q = queueRef.current
      if (q.length === 0) return
      const cur = projectedRef.current?.queueIndex
      const from = cur == null ? (step === 1 ? -1 : q.length) : cur
      const next = from + step
      if (next < 0 || next >= q.length) return
      doProject(q[next], 0, next)
      followForItem(q[next])
    },
    [doProject, followForItem]
  )

  /** After the queue changes, keep `projected.queueIndex` pointing at the same item. */
  const repointProjected = useCallback((nextQueue: QueueItem[]) => {
    const p = projectedRef.current
    if (!p) return
    const newIndex = nextQueue.findIndex((it) => it.id === p.item.id)
    const updated: Projected = { ...p, queueIndex: newIndex === -1 ? null : newIndex }
    projectedRef.current = updated
    setProjected(updated)
  }, [])

  const mutateQueue = useCallback(
    (fn: (q: QueueItem[]) => QueueItem[]) => {
      const next = fn(queueRef.current)
      queueRef.current = next
      setServiceQueue(next)
      repointProjected(next)
    },
    [repointProjected]
  )

  const handleRemoveFromQueue = useCallback(
    (index: number) => mutateQueue((q) => q.filter((_, i) => i !== index)),
    [mutateQueue]
  )
  const handleReorder = useCallback(
    (from: number, to: number) => mutateQueue((q) => reorder(q, from, to)),
    [mutateQueue]
  )

  // ── Projection window / stage / blank ──────────────────────────────────────

  const handleToggleProjection = useCallback(async () => {
    if (projectionOpen) {
      await window.electronAPI.closeProjection()
      setProjectionOpen(false)
      setIsScreenBlanked(false)
    } else {
      await window.electronAPI.openProjection()
      setProjectionOpen(true)
    }
  }, [projectionOpen])

  const handleToggleStage = useCallback(async () => {
    if (stageOpen) {
      await window.electronAPI.closeStage()
      setStageOpen(false)
    } else {
      await window.electronAPI.openStage()
      setStageOpen(true)
    }
  }, [stageOpen])

  const handleToggleBlank = useCallback(() => {
    const b = !isScreenBlanked
    setIsScreenBlanked(b)
    window.electronAPI.setBlankScreen(b)
  }, [isScreenBlanked])

  const handleFontSizeChange = useCallback((delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(8, Math.max(1.5, parseFloat((prev + delta).toFixed(2))))
      window.electronAPI.setFontSize(next)
      return next
    })
  }, [])

  // ── Web remote ─────────────────────────────────────────────────────────────

  useEffect(() => {
    window.electronAPI.syncWebRemote({
      queue: serviceQueue.map((it) => ({
        id: it.id,
        title: itemTitle(it),
        kind: it.kind,
        subtitle: it.slides[0]?.reference ?? '',
        slideCount: it.slides.length,
        played: playedIds.has(it.id),
        source: it.source ? { label: it.source.label } : undefined,
        slides: it.slides.map((s) => ({
          text: s.text,
          label: s.label,
          marker: s.marker,
          reference: s.reference
        }))
      })),
      activeIndex: activeQueueIndex,
      activeSlide: projected?.slide ?? 0,
      blanked: isScreenBlanked,
      bibleTranslation,
      onScreen:
        projected && projectionOpen
          ? {
              kind: projected.item.kind,
              text: projected.item.slides[projected.slide]?.text ?? '',
              marker: projected.item.slides[projected.slide]?.marker,
              reference:
                projected.item.slides[projected.slide]?.reference ?? itemTitle(projected.item),
              label: projected.item.slides[projected.slide]?.label,
              nextText: nextPreviewText,
              readingAhead
            }
          : null
    })
  }, [
    serviceQueue,
    playedIds,
    activeQueueIndex,
    projected,
    isScreenBlanked,
    projectionOpen,
    bibleTranslation,
    nextPreviewText,
    readingAhead
  ])

  // Remote commands address a queue row by its stable id, never by array
  // position (see webRemote.ts's CommandCallback) — resolved against
  // queueRef.current fresh at the moment the command actually lands, so a
  // row that moved (another contributor added/removed something in the
  // meantime) still resolves to the right item, or harmlessly no-ops if it
  // was removed, instead of silently hitting whatever now sits at a stale
  // index.
  const resolveQueueIndex = useCallback(
    (id: string) => queueRef.current.findIndex((it) => it.id === id),
    []
  )

  useEffect(
    () =>
      window.electronAPI.onWebRemoteProject((id) => {
        const index = resolveQueueIndex(id)
        if (index !== -1) handleProjectFromQueue(index)
      }),
    [handleProjectFromQueue, resolveQueueIndex]
  )
  useEffect(
    () =>
      window.electronAPI.onWebRemoteProjectAt(({ id, slide }) => {
        const index = resolveQueueIndex(id)
        if (index !== -1) handleProjectFromQueue(index, slide)
      }),
    [handleProjectFromQueue, resolveQueueIndex]
  )
  // The remote's own touch-friendly Up/Down reorder + Remove — native HTML5
  // drag-and-drop (the desktop interaction) is a mouse-only browser API and
  // simply cannot fire from a touchscreen, so this reuses the exact same
  // handleReorder/handleRemoveFromQueue the desktop's own drag drop calls
  // rather than being a separate, parallel implementation.
  useEffect(
    () =>
      window.electronAPI.onWebRemoteReorder(({ id, toId }) => {
        const from = resolveQueueIndex(id)
        const to = resolveQueueIndex(toId)
        if (from !== -1 && to !== -1) handleReorder(from, to)
      }),
    [handleReorder, resolveQueueIndex]
  )
  useEffect(
    () =>
      window.electronAPI.onWebRemoteRemove((id) => {
        const index = resolveQueueIndex(id)
        if (index !== -1) handleRemoveFromQueue(index)
      }),
    [handleRemoveFromQueue, resolveQueueIndex]
  )

  // The mobile remote's search results reuse the exact same add/project
  // handlers the desktop UI uses — same queue-building, same slide-jump
  // behavior for search matches, same everything.
  useEffect(
    () => window.electronAPI.onWebRemoteQueueSermon((quote) => handleAddQuote(quote)),
    [handleAddQuote]
  )
  useEffect(
    () =>
      window.electronAPI.onWebRemoteProjectSermon(({ quote, query, slideIndex }) =>
        handleProjectSearchResult(quote, query, slideIndex)
      ),
    [handleProjectSearchResult]
  )
  useEffect(
    () =>
      window.electronAPI.onWebRemoteQueueBible(async ({ reference, translation }) => {
        const p = await window.electronAPI.lookupPassage(reference, translation)
        if (p && !('error' in (p as object))) handleAddPassage(p as ResolvedPassage)
      }),
    [handleAddPassage]
  )
  useEffect(
    () =>
      window.electronAPI.onWebRemoteProjectBible(async ({ reference, translation }) => {
        const p = await window.electronAPI.lookupPassage(reference, translation)
        if (p && !('error' in (p as object))) handleProjectPassage(p as ResolvedPassage)
      }),
    [handleProjectPassage]
  )
  useEffect(
    () =>
      window.electronAPI.onWebRemoteQueueSong(async (songId) => {
        const s = await window.electronAPI.getSong(songId)
        if (s) handleAddSong(s as SongDetail)
      }),
    [handleAddSong]
  )
  useEffect(
    () =>
      window.electronAPI.onWebRemoteProjectSong(async (songId, slide) => {
        const s = await window.electronAPI.getSong(songId)
        if (s) handleProjectSong(s as SongDetail, slide)
      }),
    [handleProjectSong]
  )

  // The phone's own "prepared list" workflow: a contributor builds up a
  // batch privately on their device, then sends it all in one round trip —
  // tagged with that phone's stored contributor label, so the operator's
  // grouped queue view can show whose items are whose without accounts. A
  // re-send (the contributor edits their set mid-service) replaces only
  // that contributor's own not-yet-shown items — see
  // replaceContributorItems's own comment for why played/on-screen ones are
  // deliberately left alone.
  useEffect(
    () =>
      window.electronAPI.onWebRemoteQueueBatch(async ({ items, contributor }) => {
        const resolved: QueueItem[] = []
        for (const raw of items as Array<{ kind: string; payload: Record<string, unknown> }>) {
          if (raw.kind === 'sermon' && raw.payload?.quote) {
            resolved.push(quoteToItem(raw.payload.quote as Quote))
          } else if (raw.kind === 'bible' && typeof raw.payload?.reference === 'string') {
            const p = await window.electronAPI.lookupPassage(
              raw.payload.reference as string,
              (raw.payload.translation as string) ?? bibleTranslation
            )
            if (p && !('error' in (p as object))) resolved.push(passageToItem(p as ResolvedPassage))
          } else if (raw.kind === 'song' && typeof raw.payload?.songId === 'number') {
            const s = await window.electronAPI.getSong(raw.payload.songId as number)
            if (s) resolved.push(songToItem(s as SongDetail))
          }
        }
        if (resolved.length === 0) return
        const tagged = resolved.map((it) => ({ ...it, source: contributor }))
        mutateQueue((q) => {
          const protectedId = activeQueueIndex != null ? (q[activeQueueIndex]?.id ?? null) : null
          return replaceContributorItems(q, tagged, contributor.deviceId, playedIds, protectedId)
        })
      }),
    [mutateQueue, playedIds, activeQueueIndex, bibleTranslation]
  )

  // ── Operator keyboard shortcuts ────────────────────────────────────────────

  useEffect(() => {
    const isTyping = (el: EventTarget | null): boolean => {
      const n = el as HTMLElement | null
      if (!n) return false
      return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable
    }

    const onKey = (e: KeyboardEvent): void => {
      if (showAlertDialog) return
      if (e.key === '?') { setShowShortcuts((v) => !v); return }
      if (showShortcuts && e.key === 'Escape') { setShowShortcuts(false); return }
      if (e.key === 'F1') { e.preventDefault(); setShowHelp((v) => !v); return }

      // Esc toggles the projector blackout from anywhere in the control window —
      // including while a search box has focus, so it works under live pressure.
      if (e.key === 'Escape' && projectionOpen) {
        e.preventDefault()
        handleToggleBlank()
        return
      }

      const mod = e.metaKey || e.ctrlKey

      // ⌘/Ctrl+Shift+W: open/close the projection window. Deliberately not
      // plain ⌘/Ctrl+W (which reads as "close this — the control — window")
      // and not Cmd+C/Cmd+X (already Copy/Cut everywhere, including inside
      // this app's own search boxes — repurposing either would risk closing
      // the projector mid-service just from copying a quote).
      if (mod && e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        handleToggleProjection()
        return
      }
      if (mod && e.key === 'Enter') {
        if (searchResults[0]) { e.preventDefault(); handleProjectSearchResult(searchResults[0]) }
        return
      }
      if ((e.key === '/' || (mod && e.key.toLowerCase() === 'f')) && !isTyping(e.target)) {
        e.preventDefault()
        setTopTab('sermons')
        setSermonsTab('search')
        // A sermon open in the follow view replaces the search box entirely
        // (see the conditional render below) — back out of it first, or
        // there's nothing to focus and this becomes a silent no-op.
        setFollowSermon(null)
        document.getElementById('born-search-input')?.focus()
        return
      }

      if (isTyping(e.target)) return
      const t = e.target as HTMLElement | null
      const onControl =
        t && typeof t.closest === 'function' ? t.closest('button, a, [role="button"]') : null
      if (onControl && (e.key === ' ' || e.key === 'Enter')) return

      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && activeQueueIndex !== null) {
        e.preventDefault()
        const to = e.key === 'ArrowUp' ? activeQueueIndex - 1 : activeQueueIndex + 1
        if (to >= 0 && to < queueRef.current.length) handleReorder(activeQueueIndex, to)
        return
      }

      // ⌘/Ctrl + ←/→ : jump to the previous / next item in the service queue.
      if (mod && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        projectQueueDelta(e.key === 'ArrowRight' ? 1 : -1)
        return
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          e.shiftKey && e.key === ' ' ? handlePrev() : handleNext()
          break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          handlePrev()
          break
        case 'b':
        case 'B':
          e.preventDefault()
          handleToggleBlank()
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    showAlertDialog,
    showShortcuts,
    projectionOpen,
    searchResults,
    activeQueueIndex,
    handleProjectSearchResult,
    handleReorder,
    handlePrev,
    handleNext,
    projectQueueDelta,
    handleToggleBlank,
    handleToggleProjection
  ])

  // ── Alert / service files ──────────────────────────────────────────────────

  const handleSearch = useCallback((results: Quote[], query: string) => {
    setSearchResults(results)
    setSearchQuery(query)
    setSearched(true)
    setFollowSermon(null) // a new search means show the results again
  }, [])

  const handleSendAlert = useCallback(() => {
    if (!alertMessage.trim()) return
    window.electronAPI.sendAlert(alertMessage.trim(), alertTarget)
    setAlertMessage('')
    setShowAlertDialog(false)
  }, [alertMessage, alertTarget])

  const refreshRecents = useCallback(() => {
    window.electronAPI.getRecentServices().then(setRecents)
  }, [])
  useEffect(() => refreshRecents(), [refreshRecents])

  useEffect(() => {
    window.electronAPI.getDataRecoveryInfo().then(setDataRecovery)
  }, [])

  const handleNewService = useCallback(() => {
    if (serviceQueue.length === 0) {
      setFollowSermon(null)
      return
    }
    if (window.confirm('Clear the current queue and start a new service?')) {
      setServiceQueue([])
      projectedRef.current = null
      setProjected(null)
      setFollowSermon(null)
      setPlayedIds(new Set())
      // setProjected(null) above only clears this window's own idea of
      // what's live — it sends nothing to the actual projection window, so
      // without this, the congregation screen keeps showing whatever was up
      // before "New service" while the operator's own status bar says
      // "Nothing on screen yet," which is simply false. Blank the real
      // output to match what the operator is being told.
      if (projectionOpen && !isScreenBlanked) {
        setIsScreenBlanked(true)
        window.electronAPI.setBlankScreen(true)
      }
    }
  }, [serviceQueue.length, projectionOpen, isScreenBlanked])

  const handleSaveService = useCallback(async () => {
    const ok = await window.electronAPI.saveService(serviceQueue)
    if (ok) refreshRecents()
  }, [serviceQueue, refreshRecents])

  const loadServiceItems = useCallback((loaded: unknown[]) => {
    setServiceQueue(migrateQueue(loaded))
    projectedRef.current = null
    setProjected(null)
    setFollowSermon(null)
    setPlayedIds(new Set())
    // setProjected(null) only clears this window's own idea of what's live —
    // it sends nothing to the real projection window. Opening a different
    // service while something is still up would otherwise leave the
    // congregation looking at the old service's content while the operator's
    // own status bar claims there's nothing on screen.
    if (projectionOpenRef.current && !isScreenBlankedRef.current) {
      setIsScreenBlanked(true)
      window.electronAPI.setBlankScreen(true)
    }
  }, [])

  // Shown under the queue toolbar when Open/Import can't read or parse a
  // file — a damaged or empty .born file otherwise fails with nothing
  // visible at all. Auto-clears so it doesn't linger once the operator has
  // moved on, same pattern as SongsPanel's import message.
  const [openError, setOpenError] = useState<string | null>(null)
  const openErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showOpenError = useCallback((message: string) => {
    if (openErrorTimer.current) clearTimeout(openErrorTimer.current)
    setOpenError(message)
    openErrorTimer.current = setTimeout(() => setOpenError(null), 8000)
  }, [])

  const handleOpenService = useCallback(async () => {
    try {
      const loaded = await window.electronAPI.openService()
      if (loaded) {
        loadServiceItems(loaded)
        refreshRecents()
      }
    } catch (e) {
      showOpenError(e instanceof Error ? e.message : "Couldn't open that service file.")
    }
  }, [loadServiceItems, refreshRecents, showOpenError])

  const handleOpenRecent = useCallback(
    async (path: string) => {
      try {
        const loaded = await window.electronAPI.openServicePath(path)
        if (loaded) {
          loadServiceItems(loaded)
          refreshRecents()
        } else {
          showOpenError("Couldn't open that service file — it may be damaged or empty.")
        }
      } catch {
        showOpenError("Couldn't open that service file — it may be damaged or empty.")
      }
    },
    [loadServiceItems, refreshRecents, showOpenError]
  )

  /** Untagged items from an imported file (saved before per-item source tags
   *  existed, or just a plain desktop-only save) get that file's own name as
   *  a fallback group label — never silently folded into "Added on
   *  desktop," which is reserved for items actually added through this
   *  app's own Sermons/Bible/Songs panels. Anything that already carries a
   *  real source tag (a file saved from this feature's own tagged remote
   *  flow) passes through untouched. */
  const tagUntaggedItems = useCallback(
    (items: QueueItem[], fallbackLabel: string): QueueItem[] =>
      items.map((it) =>
        it.source
          ? it
          : { ...it, source: { deviceId: `import:${fallbackLabel}`, label: fallbackLabel } }
      ),
    []
  )

  /** "Import" — additive alongside Open (which replaces the whole queue):
   *  combines one or more separately-saved service files into the current
   *  queue instead of requiring only one file open at a time. */
  const handleImportService = useCallback(async () => {
    const { files, failed } = await window.electronAPI.importService()
    if (failed.length > 0) {
      showOpenError(
        failed.length === 1
          ? `Couldn't import "${failed[0]}" — it may be damaged or empty.`
          : `Couldn't import ${failed.length} files (may be damaged or empty): ${failed.join(', ')}`
      )
    }
    if (files.length === 0) return
    const allTagged = files.flatMap((f) => tagUntaggedItems(migrateQueue(f.items), f.name))
    if (allTagged.length > 0) addToQueue(allTagged)
    refreshRecents()
  }, [tagUntaggedItems, addToQueue, refreshRecents, showOpenError])

  // The remote's New/Open/Save already confirm on the phone itself before
  // sending the command — doing it again here (a JS confirm() on an
  // unattended desktop) would just block on nobody being there to click it.
  useEffect(
    () =>
      window.electronAPI.onWebRemoteNewService(() => {
        setServiceQueue([])
        projectedRef.current = null
        setProjected(null)
        setFollowSermon(null)
        setPlayedIds(new Set())
        // Same reasoning as handleNewService's own blank call: clearing this
        // window's idea of what's live doesn't touch the real projection.
        if (projectionOpenRef.current && !isScreenBlankedRef.current) {
          setIsScreenBlanked(true)
          window.electronAPI.setBlankScreen(true)
        }
      }),
    []
  )
  useEffect(
    () =>
      window.electronAPI.onWebRemoteOpenService((items) => {
        loadServiceItems(items)
        refreshRecents()
      }),
    [loadServiceItems, refreshRecents]
  )
  useEffect(
    () =>
      window.electronAPI.onWebRemoteImportService(({ items, label }) => {
        addToQueue(tagUntaggedItems(migrateQueue(items), label))
        refreshRecents()
      }),
    [tagUntaggedItems, addToQueue, refreshRecents]
  )
  useEffect(
    () =>
      window.electronAPI.onWebRemoteSaveQueue(async (name) => {
        await window.electronAPI.saveServiceNamed(name, serviceQueue)
        refreshRecents()
      }),
    [serviceQueue, refreshRecents]
  )

  const isRunning = indexer?.status === 'running'
  const pct = indexer ? Math.round((indexer.scanned / indexer.total) * 100) : 0
  // Covers two cases that used to look identical to the operator: no external
  // display exists at all (isFallback), and a named/remembered display went
  // missing so the app silently picked a different one instead
  // (missingOverrideName) — previously that second case produced no signal
  // whatsoever, the dropdown just quietly relabelled itself.
  const showFallbackBanner = projectionOpen && (displayInfo?.isFallback || !!displayInfo?.missingOverrideName)

  // Version/update-check/sermon-refresh only need to be visible on demand —
  // they're true almost all the time, so keeping them out of the footer text
  // keeps it quiet except when something actually needs attention.
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false)
  const statusPopoverRef = useRef<HTMLDivElement>(null)
  const statusTriggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const onOutside = (e: MouseEvent): void => {
      if (
        statusPopoverRef.current &&
        !statusPopoverRef.current.contains(e.target as Node) &&
        !statusTriggerRef.current?.contains(e.target as Node)
      ) {
        setStatusPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // What's on the projector right now, so the source panels can highlight it.
  const onScreenLoc = useMemo<OnScreenLoc>(() => {
    if (!projected || !projectionOpen || isScreenBlanked) return null
    const slide = projected.item.slides[projected.slide]
    const tail = (slide?.reference || '').split(' · ')
    if (projected.item.kind === 'bible') {
      const ref = tail[0]?.replace(/([0-9]+)[a-z]$/, '$1') // drop the "16a" page suffix
      const p = ref ? parseReference(ref) : null
      if (p && !isRefError(p)) {
        return { kind: 'bible', bookNum: p.bookNum, chapter: p.chapter, verse: p.verseStart ?? 0 }
      }
    }
    if (projected.item.kind === 'quote') {
      // tail is `slide.reference` split on " · " — title / dateCode / paragraph
      // (e.g. "41a"), but a sermon's header slide has no third segment at all
      // ("Title · DateCode"), since it isn't a numbered paragraph. Checking
      // only `tail[tail.length - 1]` for truthiness doesn't catch that case:
      // it falls back to the *dateCode* segment (e.g. "63-0825E"), which
      // parses as a paragraph range [63, 825] and then spuriously overlaps
      // nearly every real paragraph in the sermon in SermonFollowView's
      // on-screen matching. Only trust the last segment when it's genuinely
      // the third one.
      return {
        kind: 'quote',
        sermonId: projected.item.quote.sermonId,
        paragraphRef: tail.length >= 3 ? tail[tail.length - 1] : projected.item.quote.paragraphRef
      }
    }
    if (projected.item.kind === 'song') {
      return { kind: 'song', songId: projected.item.songId, slideIndex: projected.slide }
    }
    return null
  }, [projected, projectionOpen, isScreenBlanked])

  return (
    <div className="app">
      <header className="app-header">
        <button
          className="app-logo-born"
          onClick={handleNewService}
          title="BORN — back to the start screen"
        >
          B
          <Flame className="app-logo-flame" width={17} height={17} strokeWidth={0} fill="currentColor" aria-hidden="true" />
          RN
        </button>

        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun width={16} height={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Moon width={16} height={16} strokeWidth={2} aria-hidden="true" />
            )}
          </button>
          <button className="btn-quiet btn-sm" onClick={() => setShowHelp(true)} title="Open the BORN manual (F1)">
            Help
          </button>
          <button className="btn-quiet btn-sm" onClick={() => setShowShortcuts(true)} title="See keyboard shortcuts">
            Shortcuts
          </button>

          {projectionOpen && (
            <>
              <button
                className={`btn-secondary btn-icon-text${isScreenBlanked ? ' btn-toggle-on' : ''}`}
                onClick={handleToggleBlank}
                title="Black out the congregation screen (Esc)"
              >
                {isScreenBlanked ? (
                  <EyeOff width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <Eye width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                )}
                {isScreenBlanked ? 'Show screen' : 'Hide screen'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  // Defaulting to Stage monitor unconditionally used to send a
                  // message nowhere visible whenever no stage monitor was on
                  // for that session — default to it only when it's actually
                  // showing something, Main screen otherwise.
                  setAlertTarget(stageOpen ? 'stage' : 'congregation')
                  setShowAlertDialog(true)
                }}
                title={
                  stageOpen
                    ? 'Show a short message across the bottom of a screen (defaults to the stage monitor)'
                    : 'Show a short message across the bottom of a screen (defaults to the main screen)'
                }
              >
                Message
              </button>
            </>
          )}

          <ScreensMenu
            displayInfo={displayInfo}
            projectionOpen={projectionOpen}
            stageOpen={stageOpen}
            fontSize={fontSize}
            onToggleProjection={handleToggleProjection}
            onToggleStage={handleToggleStage}
            onSetProjectionDisplay={(id) => window.electronAPI.setProjectionDisplay(id).then(setDisplayInfo)}
            onSetStageDisplay={(id) => window.electronAPI.setStageDisplay(id).then(setDisplayInfo)}
            onFontSize={handleFontSizeChange}
            onRefreshDisplays={() => window.electronAPI.listDisplays().then(setDisplayInfo)}
            onDisplayInfoChange={setDisplayInfo}
            outputs={outputs}
            onAddGraphicsOutput={(channelId) =>
              window.electronAPI.addGraphicsOutput(channelId).then(setOutputs)
            }
            onRemoveOutput={(id) => window.electronAPI.removeOutput(id).then(setOutputs)}
            onSetOutputProfile={(id, profileId) =>
              window.electronAPI.setOutputProfile(id, profileId).then(setOutputs)
            }
            onSetOutputAutoProfile={(id, autoProfile) =>
              window.electronAPI.setOutputAutoProfile(id, autoProfile).then(setOutputs)
            }
            onSetOutputSuppressed={(id, suppressed) =>
              window.electronAPI.setDestinationSuppressed(id, suppressed).then(setOutputs)
            }
            channels={channels.filter((c) => c.id !== 'main')}
            availableTranslations={availableTranslations}
            songbooks={songbooks}
            onAddChannel={handleAddChannel}
            onRemoveChannel={handleRemoveChannel}
            onSetChannelTranslation={handleSetChannelTranslation}
            onSetChannelSongbook={(id, songbookId) =>
              window.electronAPI.setChannelSongbook(id, songbookId).then(setChannels)
            }
            onSetChannelSync={(id, sync) => window.electronAPI.setChannelSync(id, sync).then(setChannels)}
            onOpenChannel={(id) => {
              setChannelModalTab('bible')
              setOpenChannelId(id)
            }}
          />

          <RemotePanel />

          <button
            className={projectionOpen ? 'btn-danger' : 'btn-primary btn-lg'}
            onClick={handleToggleProjection}
          >
            {projectionOpen ? 'Close projection' : 'Open projection'}
          </button>
        </div>
      </header>

      {showFallbackBanner && (
        <div className="fallback-banner">
          {displayInfo?.missingOverrideName ? (
            <>
              <strong>“{displayInfo.missingOverrideName}”</strong> isn’t detected right now — projecting to{' '}
              {displayInfo.isFallback ? 'this screen' : 'a different screen'} instead.{' '}
            </>
          ) : displayInfo?.isOverride ? (
            'Projection is set to this screen. '
          ) : (
            'No external display detected — projecting to this screen. '
          )}
          Press <kbd>Esc</kbd> to hide or show it{displayInfo && displayInfo.displays.length > 1 ? ', or pick a screen above' : ''}.
        </div>
      )}

      {update?.hasUpdate && !updateDismissed && (
        <div className="update-banner">
          {updateStage === 'idle' && (
            <>
              <span>
                <strong>BORN {update.latest}</strong> is available — you have {update.current}.
              </span>
              <span className="update-banner-actions">
                {update.asset ? (
                  <button className="btn-primary btn-sm" onClick={handleDownloadUpdate}>
                    Upgrade
                  </button>
                ) : (
                  <button className="btn-primary btn-sm" onClick={() => window.electronAPI.openReleasePage()}>
                    Get it from the website
                  </button>
                )}
                <button className="btn-quiet btn-sm" onClick={() => setUpdateDismissed(true)}>
                  Later
                </button>
              </span>
            </>
          )}

          {updateStage === 'downloading' && (
            <>
              <span>Downloading BORN {update.latest}… {updatePct}%</span>
              <span className="update-progress">
                <span className="update-progress-fill" style={{ width: `${updatePct}%` }} />
              </span>
            </>
          )}

          {updateStage === 'ready' && (
            <>
              <span>
                <strong>BORN {update.latest}</strong> is ready. It installs when you restart — BORN closes and reopens on the new version.
              </span>
              <span className="update-banner-actions">
                <button className="btn-primary btn-sm" onClick={handleRestartToUpdate}>
                  Restart &amp; update
                </button>
                <button className="btn-quiet btn-sm" onClick={() => setUpdateDismissed(true)}>
                  Later
                </button>
              </span>
            </>
          )}

          {updateStage === 'installing' && <span>Installing — BORN will restart…</span>}

          {updateStage === 'manual' && (
            <>
              <span>
                {navigator.platform.startsWith('Mac')
                  ? 'Almost there — the disk image is open. Drag Branham or Nothing onto Applications (replace the old one), then reopen BORN.'
                  : navigator.platform.startsWith('Win')
                    ? 'The installer is running — click through it, then reopen BORN.'
                    : 'The new AppImage is in your file manager — replace the old one and reopen BORN.'}
              </span>
              <span className="update-banner-actions">
                <button className="btn-primary btn-sm" onClick={() => window.electronAPI.quitApp()}>
                  Quit BORN
                </button>
              </span>
            </>
          )}

          {updateStage === 'error' && (
            <>
              <span>Update didn’t go through: {updateMsg}</span>
              <span className="update-banner-actions">
                <button className="btn-primary btn-sm" onClick={() => window.electronAPI.openReleasePage()}>
                  Open download page
                </button>
                <button className="btn-quiet btn-sm" onClick={() => { setUpdateStage('idle'); setUpdateMsg('') }}>
                  Back
                </button>
              </span>
            </>
          )}
        </div>
      )}

      <main className="app-main">
        <div className="search-panel">
          <div className="panel-tab-bar">
            <button className={`panel-tab panel-tab--sermons${topTab === 'sermons' ? ' active' : ''}`} onClick={() => setTopTab('sermons')}>Sermons</button>
            <button className={`panel-tab panel-tab--bible${topTab === 'bible' ? ' active' : ''}`} onClick={() => setTopTab('bible')}>Bible</button>
            <button className={`panel-tab panel-tab--songs${topTab === 'songs' ? ' active' : ''}`} onClick={() => setTopTab('songs')}>Songs</button>
          </div>

          <div className="panel-view" hidden={topTab !== 'sermons'}>
            <div className="panel-subtab-bar">
              <button className={`panel-subtab${sermonsTab === 'search' ? ' active' : ''}`} onClick={() => setSermonsTab('search')}>Search</button>
              <button className={`panel-subtab${sermonsTab === 'browse' ? ' active' : ''}`} onClick={() => setSermonsTab('browse')}>Browse</button>
            </div>
            <div className="panel-view" hidden={sermonsTab !== 'search'}>
              {followSermon ? (
                <SermonFollowView
                  sermonId={followSermon.sermonId}
                  anchorRef={followSermon.anchorRef}
                  liveRef={
                    onScreenLoc?.kind === 'quote' &&
                    onScreenLoc.sermonId === followSermon.sermonId
                      ? onScreenLoc.paragraphRef
                      : null
                  }
                  query={followSermon.query}
                  matchType={followSermon.matchType}
                  onBack={() => setFollowSermon(null)}
                  onProject={handleProjectQuote}
                  onAddToQueue={handleAddQuote}
                />
              ) : (
                <>
                  <SearchBar onResults={handleSearch} onSearchingChange={setSearching} externalQuery={quickSearch} />
                  <ResultsList
                    results={searchResults}
                    query={searchQuery}
                    loading={searching}
                    searched={searched}
                    onScreen={onScreenLoc?.kind === 'quote' ? onScreenLoc : null}
                    onAddToQueue={handleAddQuote}
                    onSendToProjection={handleProjectSearchResult}
                    onOpenSermon={handleOpenSermon}
                    onQuickSearch={(term) => setQuickSearch({ term, nonce: Date.now() })}
                    onJumpToSermon={(sermonId, anchorRef) => setFollowSermon({ sermonId, anchorRef })}
                  />
                </>
              )}
            </div>
            <div className="panel-view" hidden={sermonsTab !== 'browse'}>
              <BrowsePanel
                visible={topTab === 'sermons' && sermonsTab === 'browse'}
                onScreen={onScreenLoc?.kind === 'quote' ? onScreenLoc : null}
                onAddToQueue={handleAddQuote}
                onSendToProjection={handleProjectQuote}
              />
            </div>
          </div>

          <div className="panel-view" hidden={topTab !== 'bible'}>
            <BiblePanel
              visible={topTab === 'bible'}
              onScreen={onScreenLoc?.kind === 'bible' ? onScreenLoc : null}
              preview={biblePreview}
              onAddPassage={handleAddPassage}
              onProjectPassage={handleProjectPassage}
              onTranslationChange={setBibleTranslation}
            />
          </div>

          <div className="panel-view" hidden={topTab !== 'songs'}>
            <SongsPanel
              visible={topTab === 'songs'}
              onScreen={onScreenLoc?.kind === 'song' ? onScreenLoc : null}
              focusSongId={focusSongId}
              onAddSong={handleAddSong}
              onProjectSong={handleProjectSong}
            />
          </div>
        </div>

        <div className="queue-panel">
          <ServiceQueue
            queue={serviceQueue}
            playedIds={playedIds}
            readingAhead={readingAhead}
            activeIndex={activeQueueIndex}
            activeSlide={projected?.slide ?? 0}
            onScreen={
              projected
                ? {
                    text: projected.item.slides[projected.slide]?.text ?? '',
                    marker: projected.item.slides[projected.slide]?.marker,
                    reference:
                      projected.item.slides[projected.slide]?.reference ?? itemTitle(projected.item),
                    label: projected.item.slides[projected.slide]?.label,
                    nextText: nextPreviewText
                  }
                : null
            }
            projectionOpen={projectionOpen}
            stageOpen={stageOpen}
            blanked={isScreenBlanked}
            onProject={handleProjectFromQueue}
            onSelect={handleSelectFromQueue}
            onRemove={handleRemoveFromQueue}
            onPrev={handlePrev}
            onNext={handleNext}
            onReorder={handleReorder}
            onNewService={handleNewService}
            onOpenService={handleOpenService}
            onImportService={handleImportService}
            onSaveService={handleSaveService}
            recents={recents}
            onOpenRecent={handleOpenRecent}
            openError={openError}
          />
        </div>
      </main>

      {showAlertDialog && (
        <div className="modal-overlay" onClick={() => setShowAlertDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title-row">
              <h3 className="modal-title">Show a message on screen</h3>
              <button className="btn-icon btn-sm" onClick={() => setShowAlertDialog(false)} aria-label="Close">
                <X width={15} height={15} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
            <p className="modal-hint">It appears across the bottom of the screen for about 10 seconds.</p>
            <input
              type="text"
              className="modal-input"
              placeholder="e.g. Please silence your phones"
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendAlert()
                // The app-wide shortcut handler bails out early while this
                // dialog is open (so Space/arrows don't leak through while
                // typing a message) — which also swallows Esc before it ever
                // reaches that handler, so Esc has to close this dialog
                // itself. (Ported from v1-ui-audit-help.)
                else if (e.key === 'Escape') setShowAlertDialog(false)
              }}
              autoFocus
            />
            <div className="alert-target">
              <span className="alert-target-label">Show on</span>
              {(['stage', 'congregation', 'both'] as const).map((t) => (
                <button
                  key={t}
                  className={`filter-mode-btn${alertTarget === t ? ' active' : ''}`}
                  onClick={() => setAlertTarget(t)}
                >
                  {t === 'stage' ? 'Stage monitor' : t === 'congregation' ? 'Main screen' : 'Both'}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAlertDialog(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSendAlert} disabled={!alertMessage.trim()}>Show message</button>
            </div>
          </div>
        </div>
      )}

      {showHelp && <HelpViewer onClose={() => setShowHelp(false)} />}

      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Keyboard shortcuts</h3>
            <dl className="shortcuts-list">
              <div><dt><kbd>→</kbd> <kbd>Space</kbd></dt><dd>Next — next slide, then rolls into the next verse / paragraph</dd></div>
              <div><dt><kbd>←</kbd> <kbd>Shift</kbd>+<kbd>Space</kbd></dt><dd>Back — previous slide / verse / paragraph</dd></div>
              <div><dt><kbd>⌘/Ctrl</kbd>+<kbd>→</kbd>/<kbd>←</kbd></dt><dd>Next / previous <strong>item</strong> in the service queue</dd></div>
              <div><dt><kbd>Esc</kbd> <kbd>B</kbd></dt><dd>Hide / show the congregation screen</dd></div>
              <div><dt><kbd>⌘/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>W</kbd></dt><dd>Open / close the projection window</dd></div>
              <div><dt><kbd>/</kbd></dt><dd>Jump to the search box</dd></div>
              <div><dt><kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd></dt><dd>Project the top search result</dd></div>
              <div><dt><kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd></dt><dd>Move the on-screen item up / down the queue</dd></div>
              <div><dt><kbd>?</kbd></dt><dd>Show / hide this list</dd></div>
              <div><dt><kbd>F1</kbd></dt><dd>Open / close the BORN manual</dd></div>
            </dl>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowShortcuts(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {openChannelId &&
        (() => {
          const ch = channels.find((c) => c.id === openChannelId)
          if (!ch) return null
          return (
            <div className="modal-overlay" onClick={() => setOpenChannelId(null)}>
              <div className="modal channel-operator-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title-row">
                  <div className="channel-modal-title-wrap">
                    <h3 className="modal-title">{ch.label}</h3>
                    <span className="screens-chip screens-chip-lang">{ch.translation}</span>
                    <span
                      className={`screens-chip ${ch.sync.syncMode === 'follow' ? 'screens-chip-follow' : 'screens-chip-indep'}`}
                    >
                      <span className="screens-chip-dot" aria-hidden="true" />
                      {ch.sync.syncMode === 'follow' ? 'Following Main' : 'Independent'}
                    </span>
                  </div>
                  <button className="btn-icon btn-sm" onClick={() => setOpenChannelId(null)} aria-label="Close">
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
                <div className="panel-subtab-bar">
                  <button
                    className={`panel-subtab${channelModalTab === 'bible' ? ' active' : ''}`}
                    onClick={() => setChannelModalTab('bible')}
                  >
                    Bible
                  </button>
                  <button
                    className={`panel-subtab${channelModalTab === 'sermons' ? ' active' : ''}`}
                    onClick={() => setChannelModalTab('sermons')}
                  >
                    Sermons
                  </button>
                </div>
                <div className="channel-operator-body">
                  <div className="panel-view" hidden={channelModalTab !== 'bible'}>
                    <BiblePanel
                      key={ch.id}
                      visible={channelModalTab === 'bible'}
                      onScreen={channelOnScreen[ch.id] ?? null}
                      preview={null}
                      onAddPassage={(p) => handleChannelPassage(ch.id, p)}
                      onProjectPassage={(p, slide) => handleChannelPassage(ch.id, p, slide)}
                      onTranslationChange={(code) => handleSetChannelTranslation(ch.id, code)}
                      initialTranslation={ch.translation}
                    />
                  </div>
                  <div className="panel-view" hidden={channelModalTab !== 'sermons'}>
                    <ChannelSermonsPanel
                      key={ch.id}
                      visible={channelModalTab === 'sermons'}
                      language={TRANSLATION_SERMON_LANGUAGE[ch.translation] ?? 'en'}
                      onScreen={channelSermonOnScreen[ch.id] ?? null}
                      onProject={(quote, slide) => handleChannelQuote(ch.id, quote, slide)}
                    />
                  </div>
                </div>
                <div className="modal-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      window.electronAPI.clearChannel(ch.id)
                      setChannelOnScreen((cur) => ({ ...cur, [ch.id]: null }))
                      setChannelSermonOnScreen((cur) => ({ ...cur, [ch.id]: null }))
                    }}
                  >
                    Clear
                  </button>
                  <button className="btn-primary" onClick={() => setOpenChannelId(null)}>Done</button>
                </div>
              </div>
            </div>
          )
        })()}

      <footer className="status-bar">
        <div className="status-trigger-wrap">
          <button
            className="status-trigger"
            ref={statusTriggerRef}
            onClick={() => setStatusPopoverOpen((v) => !v)}
            title="App info"
          >
            BORN v{appVersion || '—'}
            {update?.hasUpdate && updateDismissed && <span className="status-trigger-dot" />}
          </button>
          {statusPopoverOpen && (
            <div className="status-popover" ref={statusPopoverRef}>
              <div className="status-popover-row">
                {update?.hasUpdate ? (
                  <button
                    className="status-update-link"
                    onClick={() => {
                      setUpdateDismissed(false)
                      setStatusPopoverOpen(false)
                    }}
                  >
                    {updateStage === 'ready' ? `restart to update to ${update.latest} →` : `update to ${update.latest} →`}
                  </button>
                ) : (
                  <button className="status-update-link status-update-link--check" onClick={handleCheckForUpdate}>
                    check for updates
                  </button>
                )}
              </div>
              {updateMsg && <div className="status-popover-row status-text">{updateMsg}</div>}
              {indexer?.status === 'done' && (
                <div className="status-popover-row">
                  <span className="status-text status-ready">● {indexer.indexed.toLocaleString()} sermons ready</span>
                  <button
                    className="btn-secondary btn-sm"
                    title="Re-check the sermon library for any additions or corrections"
                    onClick={() => window.electronAPI.startIndexer({ forceRefresh: true })}
                  >
                    Refresh
                  </button>
                </div>
              )}
              {dataRecovery?.library.recovered && (
                <div className="status-popover-row status-text status-warn">
                  Your local Bible/songs data was damaged — it&rsquo;s been reset and restored. The
                  damaged file was kept, not deleted, in case support needs it.
                </div>
              )}
              <div className="status-popover-row">
                <button
                  className="btn-secondary btn-sm"
                  title="Open the folder holding BORN's local data — useful if support asks for it"
                  onClick={() => window.electronAPI.openDataFolder()}
                >
                  Open data folder
                </button>
              </div>
            </div>
          )}
        </div>

        {indexer === null ? (
          <span className="status-text">Starting…</span>
        ) : isRunning ? (
          <>
            <span className="status-text">
              Updating sermons — {indexer.indexed.toLocaleString()} / {indexer.total.toLocaleString()} ({pct}%)
            </span>
            <div className="status-progress"><div className="status-progress-fill" style={{ width: `${pct}%` }} /></div>
            <button className="btn-secondary btn-sm" onClick={() => window.electronAPI.stopIndexer()}>Stop</button>
          </>
        ) : indexer.indexed === 0 && dataRecovery?.sermons.recovered ? (
          <>
            <span className="status-text status-warn">
              Your local sermon data was damaged — it&rsquo;s been reset and is rebuilding now. The
              damaged file was kept, not deleted, in case support needs it.
            </span>
            <button className="btn-primary btn-sm" onClick={() => window.electronAPI.startIndexer()}>Retry</button>
          </>
        ) : indexer.indexed === 0 ? (
          <>
            <span className="status-text status-warn">Preparing sermon database — search needs an internet connection the first time</span>
            <button className="btn-primary btn-sm" onClick={() => window.electronAPI.startIndexer()}>Retry</button>
          </>
        ) : indexer.status !== 'done' ? (
          <>
            <span className="status-text">{indexer.indexed.toLocaleString()} of {indexer.total.toLocaleString()} sermons — some still downloading</span>
            <button className="btn-secondary btn-sm" onClick={() => window.electronAPI.startIndexer()}>Resume</button>
          </>
        ) : null}
      </footer>
    </div>
  )
}
