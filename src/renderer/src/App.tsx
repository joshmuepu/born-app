import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Search, Sun, Moon, Contrast, Eye, EyeOff, X, Mic2, BookOpen, Music2, Image as ImageIcon, ListOrdered, Star, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import BornMark from './components/BornMark'
import GlobalTapeBar from './components/GlobalTapeBar'
import TapePlace, { type TapePlaceTarget } from './components/TapePlace'
import TapeRailButton from './components/TapeRailButton'
import CommandPalette, { type PaletteCommand } from './components/CommandPalette'
import { ToastHost, useToasts } from './components/Toasts'
import SermonModeStrip from './components/SermonModeStrip'
import SavedPanel from './components/SavedPanel'
import PanelResizer from './components/PanelResizer'
import { useUiScale, type UiScaleChoice } from './uiScale'
import { AppActionsContext, type AppActions } from './AppActions'
import { useNavHistory, type NavEntry } from './navHistory'
import { reinsertAt, removeById, moveBackTo, mergeRestore } from './queueUndo'
import type { Favorite } from './favorites'
import { isQueueDrag, readQueueDrag, type QueueDragPayload } from './dragItem'
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
import MediaPanel from './components/MediaPanel'
import Preflight from './components/Preflight'
import MediaImportReview, { type ReviewRequest } from './components/MediaImportReview'
import { PackExportDialog, PackImportDialog } from './components/PackDialogs'
import YouTubeAdd, { type YouTubeChoice } from './components/YouTubeAdd'
import type { PackReview, PackImportSummary } from '../../shared/servicePack'
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
  Songbook,
  QueueSource
} from './types'
import { quoteToItem, makeId, migrateQueue, itemTitle, serializeQueue, isProjectable, mediaToItem, youtubeToItem, slideshowToItem, withMediaSettings, attachMediaRefs, mediaIdsInQueue, collectMediaRefs, remapMediaIds, type MediaItem, type MediaRef } from '../../shared/queueItem'
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

/** Service queue panel width (px). */
const QUEUE_MIN = 280
const QUEUE_MAX = 560
const QUEUE_DEFAULT = 360

type TopTab = 'sermons' | 'bible' | 'songs' | 'media' | 'tape'
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
  if (item.kind === 'unknown') return null
  const s = item.slides[slide]
  if (!s) return null
  if (item.kind === 'media') {
    if (!s.media) return null
    return { kind: 'media', text: item.mediaIds && item.mediaIds.length > 1 ? `${item.name} — ${slide + 1} of ${item.mediaIds.length}` : item.name, media: s.media }
  }
  if (item.kind === 'youtube') {
    if (!s.media) return null
    // Rides as a media slide: the congregation window turns it into YouTube's player, every other screen shows the name.
    return { kind: 'media', text: s.text, label: 'YouTube', media: s.media }
  }
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
  // where the Tape place should land when it is opened from somewhere else (the bar, a sermon's chip)
  const [tapeTarget, setTapeTarget] = useState<TapePlaceTarget | null>(null)
  const openTapePlace = useCallback((t: Omit<TapePlaceTarget, 'nonce'> = {}) => { setTapeTarget({ ...t, nonce: Date.now() }); setTopTab('tape') }, [])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { toasts, push: pushToast, dismiss: dismissToast, undoLatest } = useToasts()
  const { choice: uiScale, setChoice: setUiScale } = useUiScale()
  // Queue panel: open during a service (anything queued or projecting),
  // collapsed otherwise — until the operator chooses, which is remembered.
  const [queueChoice, setQueueChoice] = useState<'open' | 'closed' | null>(() => {
    try {
      const v = localStorage.getItem('born.queuePanel')
      return v === 'open' || v === 'closed' ? v : null
    } catch {
      return null
    }
  })
  // Queue panel width: draggable edge, remembered. Default ~360, never wider
  // than half the window so the browse side always keeps room.
  const [queueWidth, setQueueWidth] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('born.queueWidth'))
      return Number.isFinite(v) && v >= QUEUE_MIN ? v : QUEUE_DEFAULT
    } catch {
      return QUEUE_DEFAULT
    }
  })
  const [resizingQueue, setResizingQueue] = useState(false)
  const resizeTimer = useRef(0)
  const [winWidth, setWinWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = (): void => setWinWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const queueMax = Math.max(QUEUE_MIN, Math.min(QUEUE_MAX, Math.floor(winWidth * 0.5)))
  const queueW = Math.min(Math.max(queueWidth, QUEUE_MIN), queueMax)
  const queueOpen = queueChoice ? queueChoice === 'open' : serviceQueue.length > 0 || projectionOpen
  const toggleQueue = useCallback(() => {
    const next = queueOpen ? 'closed' : 'open'
    setQueueChoice(next)
    try {
      localStorage.setItem('born.queuePanel', next)
    } catch {
      /* ignore */
    }
  }, [queueOpen])
  const [sermonsTab, setSermonsTab] = useState<SermonsSubTab>('search')
  const [browseModeRequest, setBrowseModeRequest] = useState<{
    tab: 'date' | 'series' | 'location' | 'recent'
    nonce: number
  } | null>(null)
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
  const { theme, toggle: toggleTheme, contrast, toggleContrast } = useTheme()

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
    if (queueLoaded.current) window.electronAPI.saveQueue(serializeQueue(serviceQueue) as never)
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
    const unBlank = window.electronAPI.onOperatorBlankChanged((blank) => {
      blankEpoch.current += 1 // any blank/unblank from Esc, the phone or the API cancels a take still loading
      setIsScreenBlanked(blank)
    })
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

  /** Bumped every time the screen is blanked or un-blanked by anyone. A take that was still
   *  loading (e.g. a big picture) when that happened is dropped, so Esc can never be
   *  undone a moment later by something that was already on its way. */
  const blankEpoch = useRef(0)

  const doProject = useCallback(
    async (
      item: QueueItem,
      slide: number,
      queueIndex: number | null,
      cursors?: FlowCursors
    ) => {
      const payload = slidePayload(item, slide)
      if (!payload) return
      const epoch = blankEpoch.current
      // A picture is only ever put up if its file is there and readable right now. If not, nothing on
      // the screen changes and the operator is told why (see also Preflight).
      if (item.kind === 'media') {
        const mid = item.slides[slide]?.media?.mediaId
        const r = mid ? await window.electronAPI.mediaPrepareDisplay(mid) : { ok: false, status: 'missing' }
        if (!r.ok) {
          const why = r.status === 'offline' ? 'its drive is not connected' : r.status === 'unreadable' ? "BORN can't read the file" : r.status === 'changed' ? 'the file was changed' : 'the file is missing'
          pushToast({ message: `Can't show “${item.name}” — ${why}. The screen was not changed.`, timeoutMs: 9000 })
          return
        }
      }
      await ensureProjectionOpen()
      if (blankEpoch.current !== epoch) return // the screen was blanked while this was loading: honour that

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
      setStagedId((cur) => (cur === item.id ? null : cur))
      setIsScreenBlanked(false)
      setBiblePreview(null) // projecting anything ends a queue-item preview
      if (item.kind === 'song') setFocusSongId(item.songId)
      window.electronAPI.showSlide(payload)

      // Stage view: current slide + the next one, when it's already loaded.
      const nextPayload =
        slide + 1 < stored.slides.length ? slidePayload(stored, slide + 1) : null
      window.electronAPI.updateStage(payload, nextPayload)
    },
    [ensureProjectionOpen, pushToast]
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
        // A looping slideshow wraps instead of running out.
        if (p.item.kind === 'media' && p.item.loop && p.item.slides.length > 1) {
          await doProject(p.item, dir === 'next' ? 0 : p.item.slides.length - 1, p.queueIndex)
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

  // Slideshow auto-advance. It only ever runs for a slideshow the operator has taken, and it stops the
  // moment anything else goes up, the screen is hidden, or the operator steps manually (every change
  // of what is live restarts or cancels the timer).
  useEffect(() => {
    const p = projected
    if (!p || p.item.kind !== 'media' || isScreenBlanked) return
    const sec = p.item.autoAdvanceSec
    if (!sec || p.item.slides.length < 2) return
    const last = p.slide >= p.item.slides.length - 1
    if (last && !p.item.loop) return
    const t = window.setTimeout(() => {
      const cur = projectedRef.current
      if (!cur || cur.item.id !== p.item.id || cur.slide !== p.slide) return
      void doProject(p.item, last ? 0 : p.slide + 1, p.queueIndex, { head: p.head, tail: p.tail })
    }, sec * 1000)
    return () => window.clearTimeout(t)
  }, [projected, isScreenBlanked, doProject])

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
  const [nextFlowPayload, setNextFlowPayload] = useState<SlidePayload | null>(null)
  // The queue item the operator has staged for the Preview pane by clicking its
  // row. Staging only ever changes Preview; nothing goes live until it's taken.
  const [stagedId, setStagedId] = useState<string | null>(null)
  useEffect(() => {
    const p = projected
    if (!p) {
      setNextPreviewText(undefined)
      setNextFlowPayload(null)
      return
    }
    const loaded = p.item.slides[p.slide + 1]?.text
    if (loaded !== undefined) {
      setNextPreviewText(loaded)
      setNextFlowPayload(slidePayload(p.item, p.slide + 1))
      return
    }
    setNextPreviewText(undefined)
    setNextFlowPayload(null)
    fetchAdjacentSlide(p.tail, 'next', sermonCacheRef.current).then((ext) => {
      if (projectedRef.current !== p) return // stale — a newer projection landed first
      setNextPreviewText(ext?.slide.text)
      setNextFlowPayload(
        ext
          ? {
              kind: p.item.kind as SlidePayload['kind'],
              text: ext.slide.text,
              label: ext.slide.label,
              reference: ext.slide.reference,
              marker: ext.slide.marker
            }
          : null
      )
    })
  }, [projected])

  // ── Queue ──────────────────────────────────────────────────────────────────

  const addToQueue = useCallback((items: QueueItem[]) => {
    const next = [...queueRef.current, ...items]
    queueRef.current = next
    setServiceQueue(next)
  }, [])

  const handleAddQuote = useCallback(
    (quote: Quote, source?: QueueSource) => {
      const item = quoteToItem(quote)
      addToQueue([source ? { ...item, source } : item])
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
    (p: ResolvedPassage, source?: QueueSource) => {
      const item = passageToItem(p)
      addToQueue([source ? { ...item, source } : item])
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
    (s: SongDetail, source?: QueueSource) => {
      const item = songToItem(s)
      addToQueue([source ? { ...item, source } : item])
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
      if (!item || !isProjectable(item)) return
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
      if (item && isProjectable(item)) {
        setStagedId(item.id)
        followForItem(item, true)
      }
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
      let next = from + step
      // Step over anything this build can't show (newer-format or damaged items).
      while (next >= 0 && next < q.length && !isProjectable(q[next])) next += step
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
    (index: number) => {
      const before = queueRef.current
      const item = before[index]
      if (!item) return
      mutateQueue((q) => q.filter((_, i) => i !== index))
      pushToast({
        message: `Removed “${itemTitle(item)}” from the queue`,
        actionLabel: 'Undo',
        // Puts just this item back where it was (anything added or moved since
        // stays); if it was live it is re-linked by id.
        onAction: () => mutateQueue((q) => reinsertAt(q, item, index))
      })
    },
    [mutateQueue, pushToast]
  )
  /** Resolve something dragged in from a browse pane into a queue item and
   *  insert it at `index`. Insert only: it never projects, and a live item that
   *  ends up shifted is re-linked by id (mutateQueue → repointProjected). */
  const handleDropToQueue = useCallback(
    async (payload: QueueDragPayload, index: number) => {
      let item: QueueItem | null = null
      try {
        if (payload.type === 'quote') {
          item = quoteToItem(payload.quote)
          window.electronAPI.noteSermonUsed(payload.quote)
        } else if (payload.type === 'bible') {
          const res = await window.electronAPI.lookupPassage(payload.reference, bibleTranslation)
          if (res && !('error' in (res as object))) item = passageToItem(res as ResolvedPassage)
        } else if (payload.type === 'song') {
          const song = await window.electronAPI.getSong(payload.songId)
          if (song) {
            item = songToItem(song as SongDetail)
            window.electronAPI.noteSongUsed(payload.songId)
          }
        } else if (payload.type === 'media') {
          const rec = await window.electronAPI.mediaGet(payload.mediaId)
          if (rec) item = mediaToItem(rec)
        }
      } catch {
        item = null
      }
      if (!item) {
        pushToast({ message: "Couldn't add that to the queue." })
        return
      }
      const placed = item
      const before = queueRef.current
      const at = Math.max(0, Math.min(index, before.length))
      mutateQueue((q) => [...q.slice(0, at), placed, ...q.slice(at)])
      pushToast({
        message: `Added “${itemTitle(placed)}” to the queue`,
        actionLabel: 'Undo',
        timeoutMs: 5000,
        onAction: () => mutateQueue((q) => removeById(q, placed.id))
      })
    },
    [bibleTranslation, mutateQueue, pushToast]
  )
  /** "Add a YouTube video": appends, with an Undo. Never changes what is live and never starts anything playing. */
  const handleAddYouTube = useCallback(
    (c: YouTubeChoice) => {
      setYoutubeOpen(false)
      const item = youtubeToItem(c.videoId, c)
      mutateQueue((q) => [...q, item])
      pushToast({ message: `Added “${itemTitle(item)}” (YouTube, online) to the queue`, actionLabel: 'Undo', timeoutMs: 5000, onAction: () => mutateQueue((q) => removeById(q, item.id)) })
    },
    [mutateQueue, pushToast]
  )
  /** "Add to queue" from the Media area: appends, with an Undo. Never changes what is live. */
  const handleAddMediaToQueue = useCallback(
    (recs: Array<{ id: string; name: string; animated?: boolean }>) => {
      if (recs.length === 0) return
      const placed = recs.map((r) => mediaToItem(r))
      mutateQueue((q) => [...q, ...placed])
      pushToast({
        message: placed.length === 1 ? `Added “${placed[0].name}” to the queue` : `Added ${placed.length} pictures to the queue`,
        actionLabel: 'Undo',
        timeoutMs: 5000,
        onAction: () => mutateQueue((q) => placed.reduce((acc, it) => removeById(acc, it.id), q))
      })
      recs.forEach((r) => void window.electronAPI.mediaMarkUsed(r.id))
    },
    [mutateQueue, pushToast]
  )
  const [mediaFocusId, setMediaFocusId] = useState<string | null>(null)
  const [preflightOpen, setPreflightOpen] = useState(false)
  /** Ctrl/Cmd+Shift+L: put the church logo on screen (or just black if none is set). */
  const showLogo = useCallback(async () => {
    const id = await window.electronAPI.mediaLogoGet()
    if (!id) {
      setIsScreenBlanked(true)
      window.electronAPI.setBlankScreen(true)
      pushToast({ message: 'No logo is set, so the screen was blanked. In Media, open a picture and choose “Use as the church logo”.', timeoutMs: 8000 })
      return
    }
    await doProject(mediaToItem({ id, name: 'Logo' }), 0, null)
  }, [doProject, pushToast])
  const [mainBackground, setMainBackground] = useState<{ mediaId: string; dim: number } | null>(null)
  useEffect(() => window.electronAPI.onLogoShortcut(() => void showLogo()), [showLogo])
  // plain-words messages from the main process (the tape paused a video, an alert was kept off the YouTube player, …)
  // A phone moved the tape to another paragraph (it asked first): say so on the computer, with an Undo that puts the tape back where it was.
  useEffect(() => window.electronAPI.onTapePhoneJumped?.((j) => pushToast({
    message: `A phone moved the tape to ¶${j.toParagraph}${j.fromParagraph !== null ? ` (it was at ¶${j.fromParagraph})` : ''}`,
    actionLabel: 'Undo',
    timeoutMs: 15000,
    onAction: () => { void window.electronAPI.tapeCommand({ type: 'seek', to: j.fromSec }) }
  })), [pushToast])
  useEffect(() => window.electronAPI.onOperatorNotice?.((message) => pushToast({ message, timeoutMs: 9000 })), [pushToast])
  useEffect(() => {
    const load = (): void => {
      void window.electronAPI.mediaBackgroundsGet().then((b) => setMainBackground(b.congregationMain)).catch(() => setMainBackground(null))
    }
    load()
    return window.electronAPI.onMediaBackgroundsChanged(load)
  }, [])

  /** A slideshow of several library pictures as one queue item. */
  const handleAddSlideshow = useCallback(
    (recs: Array<{ id: string; name: string }>) => {
      if (recs.length === 0) return
      const it = slideshowToItem(recs)
      mutateQueue((q) => [...q, it])
      pushToast({
        message: `Added slideshow “${it.name}” (${recs.length} pictures) to the queue`,
        actionLabel: 'Undo',
        timeoutMs: 5000,
        onAction: () => mutateQueue((q) => removeById(q, it.id))
      })
      recs.forEach((r) => void window.electronAPI.mediaMarkUsed(r.id))
    },
    [mutateQueue, pushToast]
  )

  /** Change how a queued picture/slideshow is shown (fit, auto-advance, loop). Only edits the queue
   *  entry: whatever is live right now keeps using the copy it was taken with. */
  const handleMediaSettings = useCallback(
    (index: number, patch: Partial<Pick<MediaItem, 'fit' | 'autoAdvanceSec' | 'loop'>>) => {
      const it = queueRef.current[index]
      if (!it || it.kind !== 'media') return
      mutateQueue((q) => q.map((x) => (x.id === it.id && x.kind === 'media' ? withMediaSettings(x, patch) : x)))
    },
    [mutateQueue]
  )
  // ── Back / forward history across the drill-down ───────────────────────────
  // Every time the operator opens a sermon, a chapter or a song it is noted;
  // Alt+←/→, the mouse's back/forward buttons or the header chevrons walk it.
  // Going back only *navigates* (re-opens the thing) — it never projects.
  const applyNav = useCallback((entry: NavEntry) => {
    if (entry.kind === 'sermon') {
      setTopTab('sermons')
      setSermonsTab('search')
      setFollowSermon({ sermonId: entry.sermonId, anchorRef: entry.anchorRef })
    } else if (entry.kind === 'bible') {
      setTopTab('bible')
      setBiblePreview({ bookNum: entry.bookNum, chapter: entry.chapter, verse: entry.verse })
    } else {
      // A song can be deleted from the library after it was opened; say so
      // instead of landing on an empty pane.
      window.electronAPI
        .getSong(entry.songId)
        .then((song) => {
          if (!song) {
            pushToast({ message: 'That song is no longer in the library.', timeoutMs: 3500 })
            return
          }
          setTopTab('songs')
          // Re-opening the same song that is already focused must still re-open it.
          setFocusSongId(null)
          window.setTimeout(() => setFocusSongId(entry.songId), 0)
        })
        .catch(() => {})
    }
  }, [pushToast])
  const {
    record: recordNav,
    back: navBack,
    forward: navForward,
    canBack: canNavBack,
    canForward: canNavForward
  } = useNavHistory(applyNav)

  // A sermon opened from a search result / a favorite / the palette lands as
  // the follow view — note it.
  useEffect(() => {
    if (followSermon) {
      recordNav({ kind: 'sermon', sermonId: followSermon.sermonId, anchorRef: followSermon.anchorRef })
    }
  }, [followSermon?.sermonId, followSermon?.anchorRef, recordNav]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const el = e.target as HTMLElement | null
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      if (typing) return
      e.preventDefault()
      if (e.key === 'ArrowLeft') navBack()
      else navForward()
    }
    const onMouse = (e: MouseEvent): void => {
      if (e.button === 3) {
        e.preventDefault()
        navBack()
      } else if (e.button === 4) {
        e.preventDefault()
        navForward()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mouseup', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onMouse)
    }
  }, [navBack, navForward])

  // Favorites / recents slide-over, and the actions panels' context menus use.
  const [savedOpen, setSavedOpen] = useState(false)
  const openSermonAt = useCallback((sermonId: number, anchorRef: string) => {
    setTopTab('sermons')
    setSermonsTab('search')
    setFollowSermon({ sermonId, anchorRef })
  }, [])
  const openVerseAt = useCallback((v: { bookNum: number; chapter: number; verse: number }) => {
    setTopTab('bible')
    setBiblePreview(v)
    recordNav({ kind: 'bible', ...v })
  }, [recordNav])
  const openSongById = useCallback((songId: number) => {
    setTopTab('songs')
    setFocusSongId(songId)
  }, [])
  const addNextInQueue = useCallback(
    (payload: QueueDragPayload) => {
      const live = projectedRef.current?.queueIndex
      void handleDropToQueue(payload, (live ?? -1) + 1)
    },
    [handleDropToQueue]
  )
  const addFavoriteToQueue = useCallback(
    (f: Favorite) => {
      const at = queueRef.current.length
      if (f.kind === 'sermon') void handleDropToQueue({ type: 'quote', quote: f.quote }, at)
      else if (f.kind === 'verse') void handleDropToQueue({ type: 'bible', reference: f.reference }, at)
      else void handleDropToQueue({ type: 'song', songId: f.songId }, at)
    },
    [handleDropToQueue]
  )
  const appActions = useMemo<AppActions>(
    () => ({
      addNext: addNextInQueue,
      openSermon: openSermonAt,
      openVerse: openVerseAt,
      openSong: openSongById,
      notify: (message) => {
        pushToast({ message, timeoutMs: 2500 })
      }
    }),
    [addNextInQueue, openSermonAt, openVerseAt, openSongById, pushToast]
  )

  const handleReorder = useCallback(
    (from: number, to: number) => {
      const before = queueRef.current
      const item = before[from]
      if (!item || from === to) return
      mutateQueue((q) => reorder(q, from, to))
      pushToast({
        message: `Moved “${itemTitle(item)}”`,
        actionLabel: 'Undo',
        timeoutMs: 5000,
        onAction: () => mutateQueue((q) => moveBackTo(q, item.id, from))
      })
    },
    [mutateQueue, pushToast]
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
    blankEpoch.current += 1
    const b = !isScreenBlanked
    setIsScreenBlanked(b)
    window.electronAPI.setBlankScreen(b)
  }, [isScreenBlanked])

  // Preview/Live pair inputs. A staged item that has left the queue simply
  // stops being staged.
  const stagedItem = stagedId ? (serviceQueue.find((it) => it.id === stagedId) ?? null) : null
  const stagedPayload = stagedItem ? slidePayload(stagedItem, 0) : null
  const previewNextPayload =
    nextFlowPayload ?? (!projected && serviceQueue[0] ? slidePayload(serviceQueue[0], 0) : null)
  const handleTake = useCallback(() => {
    const q = queueRef.current
    const idx = stagedId ? q.findIndex((it) => it.id === stagedId) : -1
    if (idx >= 0) {
      handleProjectFromQueue(idx)
    } else {
      handleNext()
    }
  }, [stagedId, handleProjectFromQueue, handleNext])

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
          reference: s.reference,
          ...(s.media ? { media: s.media } : {})
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
              readingAhead,
              ...(projected.item.slides[projected.slide]?.media ? { mediaId: projected.item.slides[projected.slide]?.media?.mediaId } : {})
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
    () =>
      window.electronAPI.onWebRemoteQueueSermon(({ quote, contributor }) =>
        handleAddQuote(quote, contributor)
      ),
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
      window.electronAPI.onWebRemoteQueueBible(async ({ reference, translation, contributor }) => {
        const p = await window.electronAPI.lookupPassage(reference, translation)
        if (p && !('error' in (p as object))) handleAddPassage(p as ResolvedPassage, contributor)
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
      window.electronAPI.onWebRemoteQueueSong(async ({ songId, contributor }) => {
        const s = await window.electronAPI.getSong(songId)
        if (s) handleAddSong(s as SongDetail, contributor)
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

  // ── Command palette (Ctrl/Cmd+K): one search for everything + app actions ──

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      // Ctrl/Cmd+Z undoes the newest undo toast — but never steals the
      // shortcut from a text field, where it means "undo typing".
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
        const el = e.target as HTMLElement | null
        const typing =
          !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
        if (!typing && undoLatest()) e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoLatest])

  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    const cmds: PaletteCommand[] = [
      { id: 'go-sermons', label: 'Go to Sermons', keywords: 'quotes messages', run: () => setTopTab('sermons') },
      { id: 'go-bible', label: 'Go to Bible', keywords: 'scripture verse', run: () => setTopTab('bible') },
      { id: 'go-songs', label: 'Go to Songs', keywords: 'hymns music lyrics', run: () => setTopTab('songs') },
      { id: 'preflight', label: "Check that tonight's service is ready", keywords: 'preflight check ready missing files problems', run: () => setPreflightOpen(true) },
      { id: 'logo', label: 'Show the church logo', keywords: 'panic blank logo', hint: 'Ctrl+Shift+L', run: () => void showLogo() },
      { id: 'yt-add', label: 'Add a YouTube video…', keywords: 'youtube video link online paste', run: () => setYoutubeOpen(true) },
      { id: 'go-media', label: 'Go to Media', keywords: 'pictures photos images slides library backgrounds', run: () => setTopTab('media') },
      { id: 'media-add', label: 'Add pictures to the library…', keywords: 'import photos images media', run: () => { setTopTab('media'); void window.electronAPI.mediaPickAndImport({}) } },
      {
        id: 'search-sermons',
        label: 'Search sermons',
        keywords: 'find quote word phrase',
        hint: '/',
        run: () => {
          setTopTab('sermons')
          setSermonsTab('search')
          setFollowSermon(null)
          window.setTimeout(() => document.getElementById('born-search-input')?.focus(), 0)
        }
      },
      { id: 'queue', label: queueOpen ? 'Hide the service queue' : 'Show the service queue', keywords: 'panel', run: toggleQueue },
      { id: 'theme', label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', keywords: 'theme appearance', run: toggleTheme },
      { id: 'contrast', label: contrast ? 'Turn off high contrast' : 'Turn on high contrast', keywords: 'accessibility', run: toggleContrast },
      { id: 'projection', label: projectionOpen ? 'Close projection' : 'Open projection', keywords: 'screen display output', hint: 'Ctrl+Shift+W', run: handleToggleProjection },
      { id: 'stage', label: stageOpen ? 'Close stage monitor' : 'Open stage monitor', run: handleToggleStage },
      ...([
        ['auto', 'Interface size: automatic for this screen'],
        [1, 'Interface size: 100%'],
        [1.25, 'Interface size: 125%'],
        [1.5, 'Interface size: 150%'],
        [1.75, 'Interface size: 175%']
      ] as Array<[UiScaleChoice, string]>)
        .filter(([c]) => c !== uiScale)
        .map(([c, label]) => ({
          id: `ui-scale-${c}`,
          label,
          keywords: 'zoom bigger smaller larger text display scale size',
          run: () => setUiScale(c)
        })),
      { id: 'help', label: 'Open the manual', keywords: 'help guide', hint: 'F1', run: () => setShowHelp(true) },
      { id: 'shortcuts', label: 'Keyboard shortcuts', keywords: 'keys', hint: '?', run: () => setShowShortcuts(true) }
    ]
    if (projectionOpen) {
      cmds.push({
        id: 'blank',
        label: isScreenBlanked ? 'Show the screen' : 'Hide the screen',
        keywords: 'blank black out',
        hint: 'Esc',
        run: handleToggleBlank
      })
    }
    return cmds
  }, [
    queueOpen,
    toggleQueue,
    theme,
    toggleTheme,
    contrast,
    toggleContrast,
    projectionOpen,
    handleToggleProjection,
    stageOpen,
    handleToggleStage,
    isScreenBlanked,
    handleToggleBlank,
    uiScale,
    setUiScale
  ])

  // ── Operator keyboard shortcuts ────────────────────────────────────────────

  useEffect(() => {
    const isTyping = (el: EventTarget | null): boolean => {
      const n = el as HTMLElement | null
      if (!n) return false
      return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable
    }

    const onKey = (e: KeyboardEvent): void => {
      if (showAlertDialog || paletteOpen) return
      if (e.key === '?') { setShowShortcuts((v) => !v); return }
      if (showShortcuts && e.key === 'Escape') { setShowShortcuts(false); return }
      if (e.key === 'F1') { e.preventDefault(); setShowHelp((v) => !v); return }

      // Esc toggles the projector blackout from anywhere in the control window —
      // including while a search box has focus, so it works under live pressure.
      if (e.key === 'Escape' && projectionOpen) {
        e.preventDefault()
        // Shift+Esc blanks (never un-blanks) and pauses the tape; plain Esc toggles and leaves the tape playing unless Tape options say otherwise
        const wasBlanked = isScreenBlankedRef.current
        if (e.shiftKey) { if (!wasBlanked) handleToggleBlank() } else handleToggleBlank()
        window.electronAPI.tapeEsc?.(e.shiftKey, e.shiftKey ? true : !wasBlanked)
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
      if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        void showLogo()
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
    paletteOpen,
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

  /** Everything a destructive queue action changes, so Undo can put it all
   *  back — including un-hiding the screen if (and only if) the action hid it. */
  const snapshotService = useCallback(
    () => ({
      queue: queueRef.current,
      played: playedIds,
      projected: projectedRef.current,
      follow: followSermon,
      staged: stagedId
    }),
    [playedIds, followSermon, stagedId]
  )
  const restoreService = useCallback(
    (snap: ReturnType<typeof snapshotService>, unblank: boolean, liveAtAction: unknown) => {
      // The old queue comes back; anything added since stays, after it.
      const merged = mergeRestore(snap.queue, queueRef.current)
      queueRef.current = merged
      setServiceQueue(merged)
      setPlayedIds(snap.played)
      setFollowSermon(snap.follow)
      setStagedId(snap.staged)
      // What is on the screen is only put back if nothing has been put up
      // since the action — otherwise Undo would change what the congregation
      // sees (or point the operator window at something that is not live).
      const liveUnchanged = projectedRef.current === liveAtAction
      if (liveUnchanged) {
        projectedRef.current = snap.projected
        setProjected(snap.projected)
        if (unblank && projectionOpenRef.current && isScreenBlankedRef.current) {
          setIsScreenBlanked(false)
          window.electronAPI.setBlankScreen(false)
        }
      } else if (snap.projected) {
        // Re-link the live item to its restored row by id, nothing more.
        const live = projectedRef.current
        if (live) {
          const idx = merged.findIndex((it) => it.id === live.item.id)
          const relinked = { ...live, queueIndex: idx === -1 ? null : idx }
          projectedRef.current = relinked
          setProjected(relinked)
        }
      }
    },
    []
  )

  const handleNewService = useCallback(() => {
    if (serviceQueue.length === 0) {
      setFollowSermon(null)
      return
    }
    // Something is on the congregation's screen right now: starting over would
    // black it out, so that one still asks first. Otherwise it just happens,
    // and Undo (toast, or Ctrl/Cmd+Z) brings the whole queue back.
    const liveNow = projectionOpen && !isScreenBlanked && projectedRef.current !== null
    if (liveNow && !window.confirm('Something is on the screen right now. Clear the queue, hide the screen and start a new service?')) {
      return
    }
    const snap = snapshotService()
    const count = serviceQueue.length
    setServiceQueue([])
    queueRef.current = []
    projectedRef.current = null
    setProjected(null)
    setFollowSermon(null)
    setPlayedIds(new Set())
    setStagedId(null)
    // setProjected(null) above only clears this window's own idea of
    // what's live — it sends nothing to the actual projection window, so
    // without this, the congregation screen keeps showing whatever was up
    // before "New service" while the operator's own status bar says
    // "Nothing on screen yet," which is simply false. Blank the real
    // output to match what the operator is being told.
    let blankedByUs = false
    if (projectionOpen && !isScreenBlanked) {
      blankedByUs = true
      setIsScreenBlanked(true)
      window.electronAPI.setBlankScreen(true)
    }
    pushToast({
      message: `Started a new service — ${count} item${count === 1 ? '' : 's'} cleared`,
      actionLabel: 'Undo',
      onAction: () => restoreService(snap, blankedByUs, null)
    })
  }, [serviceQueue.length, projectionOpen, isScreenBlanked, snapshotService, restoreService, pushToast])

  // ── Pictures travelling with a saved service ──────────────────────────────
  // A saved service names each picture by what it IS (a content hash), because another computer's
  // library ids mean nothing. On opening, pictures this computer already has are matched silently;
  // for the rest the operator reviews once, before anything changes.
  const [mediaReview, setMediaReview] = useState<ReviewRequest | null>(null)

  const withMediaRefs = useCallback(async (q: QueueItem[]): Promise<QueueItem[]> => {
    const ids = mediaIdsInQueue(q)
    if (ids.length === 0) return q
    const recs = await Promise.all(ids.map((id) => window.electronAPI.mediaGet(id)))
    const refs = new Map<string, MediaRef>()
    for (const r of recs) if (r) refs.set(r.id, { id: r.id, hash: r.hash, name: r.name, width: r.width, height: r.height, bytes: r.bytes })
    return attachMediaRefs(q, (id) => refs.get(id) ?? null)
  }, [])

  /** Match a loaded queue's pictures to this library. Resolves to the queue to use, or null if the
   *  operator cancelled (nothing is changed in that case). */
  const prepareMediaForQueue = useCallback(
    async (items: QueueItem[], opts: { silent?: boolean } = {}): Promise<QueueItem[] | null> => {
      let current = items
      for (let round = 0; round < 3; round++) {
        const refs = collectMediaRefs(current)
        if (refs.length === 0) return current
        const have = await window.electronAPI.mediaResolveHashes(refs.map((r) => r.hash))
        const map: Record<string, string> = {}
        for (const r of refs) if (have[r.hash]) map[r.id] = have[r.hash]
        current = remapMediaIds(current, map)
        const missing = refs.filter((r) => !have[r.hash])
        if (missing.length === 0 || opts.silent) return current // silent (unattended remote import): never wait on a dialog
        const choice = await new Promise<'locate' | 'open' | 'cancel'>((resolve) => setMediaReview({ missing, total: refs.length, resolve }))
        setMediaReview(null)
        if (choice === 'cancel') return null
        if (choice === 'open') return current
        const r = await window.electronAPI.mediaLocateFolder(missing.map((m) => ({ hash: m.hash, bytes: m.bytes })))
        if (r.canceled) return null
        // loop: re-match against the (now larger) library
      }
      return current
    },
    []
  )

  const handleSaveService = useCallback(async () => {
    const withRefs = await withMediaRefs(serviceQueue)
    const ok = await window.electronAPI.saveService(serializeQueue(withRefs) as never)
    if (ok) refreshRecents()
  }, [serviceQueue, refreshRecents, withMediaRefs])

  // Service pack: the queue and its pictures in one .bornpack (design: docs/design/media/07-service-pack.md)
  const [packExport, setPackExport] = useState<unknown[] | null>(null)
  const [youtubeOpen, setYoutubeOpen] = useState(false)
  const [packReview, setPackReview] = useState<PackReview | null>(null)
  const handleSavePack = useCallback(async () => {
    const withRefs = await withMediaRefs(serviceQueue)
    setPackExport(serializeQueue(withRefs) as unknown[])
  }, [serviceQueue, withMediaRefs])

  const loadServiceItems = useCallback(
    (loaded: unknown[]) => {
      const snap = snapshotService()
      const hadItems = snap.queue.length > 0
      const items = migrateQueue(loaded)
      setServiceQueue(items)
      queueRef.current = items
      projectedRef.current = null
      setProjected(null)
      setFollowSermon(null)
      setPlayedIds(new Set())
      setStagedId(null)
      // setProjected(null) only clears this window's own idea of what's live —
      // it sends nothing to the real projection window. Opening a different
      // service while something is still up would otherwise leave the
      // congregation looking at the old service's content while the operator's
      // own status bar claims there's nothing on screen.
      let blankedByUs = false
      if (projectionOpenRef.current && !isScreenBlankedRef.current) {
        blankedByUs = true
        setIsScreenBlanked(true)
        window.electronAPI.setBlankScreen(true)
      }
      if (hadItems) {
        pushToast({
          message: `Opened a service (${items.length} item${items.length === 1 ? '' : 's'}) — your previous queue was replaced`,
          actionLabel: 'Undo',
          onAction: () => restoreService(snap, blankedByUs, null)
        })
      }
    },
    [snapshotService, restoreService, pushToast]
  )

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
        const prepared = await prepareMediaForQueue(migrateQueue(loaded))
        if (!prepared) return // cancelled at the picture review: nothing changed
        loadServiceItems(serializeQueue(prepared))
        refreshRecents()
      }
    } catch (e) {
      showOpenError(e instanceof Error ? e.message : "Couldn't open that service file.")
    }
  }, [loadServiceItems, refreshRecents, showOpenError, prepareMediaForQueue])

  const handleOpenPack = useCallback(async () => {
    try {
      const r = await window.electronAPI.packPickAndInspect()
      if (r.ok) setPackReview(r.review)
      else if (!r.canceled && r.code !== 'cancelled') showOpenError(r.message)
    } catch (e) {
      showOpenError(e instanceof Error ? e.message : "Couldn't open that service pack.")
    }
  }, [showOpenError])

  // Dropping a .bornpack anywhere on the window starts the same review as "Open pack".
  useEffect(() => {
    const over = (e: DragEvent): void => { if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) e.preventDefault() }
    const drop = (e: DragEvent): void => {
      const f = Array.from(e.dataTransfer?.files ?? []).find((x) => /\.bornpack$/i.test(x.name))
      if (!f) return
      e.preventDefault()
      e.stopPropagation() // the Media panel's own drop handler must not see it
      const path = window.electronAPI.mediaPathsForFiles([f])[0]
      if (!path) return
      void window.electronAPI.packInspectPath(path).then((r) => { if (r.ok) setPackReview(r.review); else showOpenError(r.message) })
    }
    window.addEventListener('dragover', over, true)
    window.addEventListener('drop', drop, true)
    return () => { window.removeEventListener('dragover', over, true); window.removeEventListener('drop', drop, true) }
  }, [showOpenError])

  /** The pack's pictures are now in the library: match the queue to them exactly like any shared service, then open it. */
  const handlePackOpened = useCallback(
    async (summary: PackImportSummary) => {
      setPackReview(null)
      try {
        const prepared = await prepareMediaForQueue(migrateQueue(summary.queue), { silent: true })
        if (prepared) loadServiceItems(serializeQueue(prepared))
        const bits = [`${summary.added} picture${summary.added === 1 ? '' : 's'} added`, summary.already ? `${summary.already} already here` : '', summary.damaged ? `${summary.damaged} damaged (shown as missing)` : '', summary.backgrounds ? `${summary.backgrounds} background${summary.backgrounds === 1 ? '' : 's'} came with it — set from Media ▸ Backgrounds` : ''].filter(Boolean)
        pushToast({ message: `Service pack opened. ${bits.join(' · ')}.` })
      } catch (e) {
        showOpenError(e instanceof Error ? e.message : "Couldn't open that service pack.")
      }
    },
    [prepareMediaForQueue, loadServiceItems, pushToast, showOpenError]
  )

  const handleOpenRecent = useCallback(
    async (path: string) => {
      try {
        const loaded = await window.electronAPI.openServicePath(path)
        if (loaded) {
          const prepared = await prepareMediaForQueue(migrateQueue(loaded))
          if (!prepared) return
          loadServiceItems(serializeQueue(prepared))
          refreshRecents()
        } else {
          showOpenError("Couldn't open that service file — it may be damaged or empty.")
        }
      } catch {
        showOpenError("Couldn't open that service file — it may be damaged or empty.")
      }
    },
    [loadServiceItems, refreshRecents, showOpenError, prepareMediaForQueue]
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
    const allTagged0 = files.flatMap((f) => tagUntaggedItems(migrateQueue(f.items), f.name))
    const allTagged = await prepareMediaForQueue(allTagged0)
    if (!allTagged) return // cancelled at the picture review: nothing was added
    if (allTagged.length > 0) addToQueue(allTagged)
    refreshRecents()
  }, [tagUntaggedItems, addToQueue, refreshRecents, showOpenError, prepareMediaForQueue])

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
        void prepareMediaForQueue(tagUntaggedItems(migrateQueue(items), label), { silent: true }).then((p) => p && addToQueue(p))
        refreshRecents()
      }),
    [tagUntaggedItems, addToQueue, refreshRecents, prepareMediaForQueue]
  )
  useEffect(
    () =>
      window.electronAPI.onWebRemoteSaveQueue(async (name) => {
        await window.electronAPI.saveServiceNamed(name, serializeQueue(await withMediaRefs(serviceQueue)) as never)
        refreshRecents()
      }),
    [serviceQueue, refreshRecents, withMediaRefs]
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
    <AppActionsContext.Provider value={appActions}>
    <div className="app">
      <header className="app-header">
        <button
          className="app-logo-born"
          onClick={handleNewService}
          title="Born Again — back to the start screen"
        >
          <BornMark size={26} />
          <span className="app-logo-word">
            <b>Born</b> <span>Again</span>
          </span>
        </button>

        <div className="header-actions">
          <div className="nav-history" role="group" aria-label="History">
            <button
              className="btn-icon"
              onClick={navBack}
              disabled={!canNavBack}
              title="Back to what you had open (Alt+←)"
              aria-label="Back"
            >
              <ChevronLeft width={16} height={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button
              className="btn-icon"
              onClick={navForward}
              disabled={!canNavForward}
              title="Forward (Alt+→)"
              aria-label="Forward"
            >
              <ChevronRight width={16} height={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
          <button
            className="palette-trigger"
            onClick={() => setPaletteOpen(true)}
            title="Search everything and run actions"
          >
            <Search width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Search everything</span>
            <kbd>{/Mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
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
          <button
            className={`btn-icon${contrast ? ' btn-toggle-on' : ''}`}
            onClick={toggleContrast}
            aria-pressed={contrast}
            title={contrast ? 'High contrast is on' : 'Turn on high contrast'}
            aria-label="High contrast"
          >
            <Contrast width={16} height={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <button className="btn-quiet btn-sm" onClick={() => setShowHelp(true)} title="Open the Born Again manual (F1)">
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
                <strong>Born Again {update.latest}</strong> is available — you have {update.current}.
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
              <span>Downloading Born Again {update.latest}… {updatePct}%</span>
              <span className="update-progress">
                <span className="update-progress-fill" style={{ width: `${updatePct}%` }} />
              </span>
            </>
          )}

          {updateStage === 'ready' && (
            <>
              <span>
                <strong>Born Again {update.latest}</strong> is ready. It installs when you restart — Born Again closes and reopens on the new version.
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

          {updateStage === 'installing' && <span>Installing — Born Again will restart…</span>}

          {updateStage === 'manual' && (
            <>
              <span>
                {navigator.platform.startsWith('Mac')
                  ? 'Almost there — the disk image is open. Drag Branham or Nothing onto Applications (replace the old one), then reopen Born Again.'
                  : navigator.platform.startsWith('Win')
                    ? 'The installer is running — click through it, then reopen Born Again.'
                    : 'The new AppImage is in your file manager — replace the old one and reopen Born Again.'}
              </span>
              <span className="update-banner-actions">
                <button className="btn-primary btn-sm" onClick={() => window.electronAPI.quitApp()}>
                  Quit Born Again
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
          <nav className="app-rail" aria-label="Sections">
            {([
              ['sermons', 'Sermons', Mic2],
              ['bible', 'Bible', BookOpen],
              ['songs', 'Songs', Music2],
              ['media', 'Media', ImageIcon]
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                className={`rail-btn rail-btn--${id}${topTab === id ? ' active' : ''}`}
                onClick={() => setTopTab(id)}
                aria-current={topTab === id ? 'page' : undefined}
              >
                <Icon width={20} height={20} strokeWidth={1.9} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
            <TapeRailButton active={topTab === 'tape'} onClick={() => { setTapeTarget(null); setTopTab('tape') }} />
            <span className="rail-spacer" />
            <button
              className={`rail-btn rail-btn--saved${savedOpen ? ' active' : ''}`}
              onClick={() => setSavedOpen((v) => !v)}
              aria-pressed={savedOpen}
              title="Favorites and recents"
            >
              <Star width={20} height={20} strokeWidth={1.9} aria-hidden="true" />
              <span>Saved</span>
            </button>
            <button
              className="rail-btn rail-btn--open"
              onClick={handleOpenService}
              title="Open a saved service file"
            >
              <FolderOpen width={20} height={20} strokeWidth={1.9} aria-hidden="true" />
              <span>Open</span>
            </button>
            <button
              className={`rail-btn rail-btn--queue${queueOpen ? ' active' : ''}`}
              onClick={toggleQueue}
              onDragOver={(e) => {
                if (isQueueDrag(e.dataTransfer)) e.preventDefault()
              }}
              onDragEnter={(e) => {
                // Hovering a dragged item over the Queue button opens the panel
                // so the exact slot can be chosen.
                if (isQueueDrag(e.dataTransfer) && !queueOpen) setQueueChoice('open')
              }}
              onDrop={(e) => {
                const payload = readQueueDrag(e.dataTransfer)
                if (!payload) return
                e.preventDefault()
                void handleDropToQueue(payload, queueRef.current.length)
              }}
              aria-pressed={queueOpen}
              title={queueOpen ? 'Hide the service queue' : 'Show the service queue'}
            >
              <ListOrdered width={20} height={20} strokeWidth={1.9} aria-hidden="true" />
              <span>Queue</span>
              {serviceQueue.length > 0 && <em className="rail-badge">{serviceQueue.length}</em>}
            </button>
          </nav>
          <div className="search-main">
          <div className="panel-view" hidden={topTab !== 'sermons'}>
            <div className="panel-view" hidden={sermonsTab !== 'search'}>
              <SermonModeStrip
                active="search"
                onSelect={(m) => {
                  if (m === 'search') return
                  setSermonsTab('browse')
                  setBrowseModeRequest({ tab: m, nonce: Date.now() })
                }}
              />
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
                onGoSearch={() => setSermonsTab('search')}
                onSermonOpened={(sm) => recordNav({ kind: 'sermon', sermonId: sm.id, anchorRef: '' })}
                modeRequest={browseModeRequest}
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
              onChapterOpened={(v) => recordNav({ kind: 'bible', ...v })}
            />
          </div>

          <div className="panel-view" hidden={topTab !== 'songs'}>
            <SongsPanel
              visible={topTab === 'songs'}
              onScreen={onScreenLoc?.kind === 'song' ? onScreenLoc : null}
              focusSongId={focusSongId}
              onAddSong={handleAddSong}
              onProjectSong={handleProjectSong}
              onSongOpened={(id) => recordNav({ kind: 'song', songId: id })}
            />
          </div>

          <div className="panel-view" hidden={topTab !== 'tape'}>
            <TapePlace visible={topTab === 'tape'} target={tapeTarget} pushToast={pushToast} />
          </div>

          <div className="panel-view" hidden={topTab !== 'media'}>
            <MediaPanel
              visible={topTab === 'media'}
              onAddToQueue={handleAddMediaToQueue}
              onAddSlideshow={handleAddSlideshow}
              onAddYouTube={() => setYoutubeOpen(true)}
              pushToast={pushToast}
              focusId={mediaFocusId}
              onFocused={() => setMediaFocusId(null)}
            />
          </div>
          </div>
        </div>

        <div
          className={`queue-panel${queueOpen ? '' : ' is-collapsed'}${resizingQueue ? ' is-resizing' : ''}`}
          aria-hidden={!queueOpen}
          style={{ ['--queue-w' as string]: `${queueW}px` }}
        >
          {queueOpen && (
            <PanelResizer
              label="Resize the service queue"
              width={queueW}
              min={QUEUE_MIN}
              max={queueMax}
              defaultWidth={QUEUE_DEFAULT}
              onChange={(px) => {
                // Resizing must track the pointer exactly, so the open/close
                // width animation is switched off while it is happening.
                setResizingQueue(true)
                window.clearTimeout(resizeTimer.current)
                resizeTimer.current = window.setTimeout(() => setResizingQueue(false), 350)
                setQueueWidth(px)
              }}
              onCommit={(px) => {
                try {
                  localStorage.setItem('born.queueWidth', String(px))
                } catch {
                  /* ignore */
                }
              }}
            />
          )}
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
            onMediaSettings={handleMediaSettings}
            onPreflight={() => setPreflightOpen(true)}
            onSelect={handleSelectFromQueue}
            onRemove={handleRemoveFromQueue}
            onPrev={handlePrev}
            onNext={handleNext}
            onReorder={handleReorder}
            onNewService={handleNewService}
            onOpenService={handleOpenService}
            onImportService={handleImportService}
            onSaveService={handleSaveService}
            onSavePack={handleSavePack}
            onOpenPack={handleOpenPack}
            recents={recents}
            onOpenRecent={handleOpenRecent}
            openError={openError}
            channels={channels}
            outputs={outputs}
            fontSize={fontSize}
            stagedPayload={stagedPayload}
            stagedTitle={stagedItem ? itemTitle(stagedItem) : null}
            nextPayload={previewNextPayload}
            background={mainBackground}
            onTake={handleTake}
            onUnstage={() => setStagedId(null)}
            onToggleBlank={handleToggleBlank}
            onClearChannel={(id) => window.electronAPI.clearChannel(id)}
            onDropItem={handleDropToQueue}
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
              <div><dt><kbd>Esc</kbd> <kbd>B</kbd></dt><dd>Hide / show the congregation screen (also cancels anything still loading)</dd></div>
              <div><dt><kbd>⌘/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd></dt><dd>Show the church logo (set in Media)</dd></div>
              <div><dt><kbd>Q</kbd> / <kbd>F</kbd> in Media</dt><dd>Add the picture to the queue / favorite it</dd></div>
              <div><dt><kbd>⌘/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>W</kbd></dt><dd>Open / close the projection window</dd></div>
              <div><dt><kbd>/</kbd></dt><dd>Jump to the search box</dd></div>
              <div><dt><kbd>⌘/Ctrl</kbd>+<kbd>K</kbd></dt><dd>Search everything and run actions</dd></div>
              <div><dt><kbd>\</kbd></dt><dd>Slide the browse columns away / back</dd></div>
              <div><dt><kbd>⌘/Ctrl</kbd>+<kbd>Z</kbd></dt><dd>Undo the last queue change</dd></div>
              <div><dt><kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd></dt><dd>Back / forward through what you opened</dd></div>
              <div><dt><kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> on a queue row</dt><dd>Move that row up / down</dd></div>
              <div><dt><kbd>Menu</kbd> / <kbd>Shift</kbd>+<kbd>F10</kbd></dt><dd>Open the right-click menu on the focused item</dd></div>
              <div><dt><kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd></dt><dd>Project the top search result</dd></div>
              <div><dt><kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd></dt><dd>Move the on-screen item up / down the queue</dd></div>
              <div><dt><kbd>?</kbd></dt><dd>Show / hide this list</dd></div>
              <div><dt><kbd>F1</kbd></dt><dd>Open / close the Born Again manual</dd></div>
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

      <MediaImportReview request={mediaReview} />
      {youtubeOpen && <YouTubeAdd onClose={() => setYoutubeOpen(false)} onAdd={handleAddYouTube} />}
      {packExport && <PackExportDialog queue={packExport} title="Sunday service" onClose={() => setPackExport(null)} onSaved={(_p, n) => { setPackExport(null); pushToast({ message: `Saved a service pack with ${n} picture${n === 1 ? '' : 's'}.` }) }} />}
      {packReview && <PackImportDialog review={packReview} onClose={() => setPackReview(null)} onOpened={(sum) => void handlePackOpened(sum)} />}

      <Preflight open={preflightOpen} queue={serviceQueue} onClose={() => setPreflightOpen(false)} onRemoveItem={(i) => handleRemoveFromQueue(i)} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={paletteCommands}
        translation={bibleTranslation}
        onOpenSermon={(q) => {
          setTopTab('sermons')
          setSermonsTab('search')
          setFollowSermon({ sermonId: q.sermonId, anchorRef: q.paragraphRef })
        }}
        onOpenSong={(id) => {
          setTopTab('songs')
          setFocusSongId(id)
        }}
        onOpenMedia={(id) => {
          setTopTab('media')
          setMediaFocusId(id)
        }}
        onOpenVerse={(v) => {
          setTopTab('bible')
          setBiblePreview(v)
        }}
      />

      <SavedPanel
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        onOpenSermon={openSermonAt}
        onOpenVerse={openVerseAt}
        onOpenSong={openSongById}
        onAddFavorite={addFavoriteToQueue}
      />

      <ToastHost toasts={toasts} onDismiss={dismissToast} />

      <GlobalTapeBar onOpenTape={(sermonId) => openTapePlace({ sermonId })} />

      <footer className="status-bar">
        <div className="status-trigger-wrap">
          <button
            className="status-trigger"
            ref={statusTriggerRef}
            onClick={() => setStatusPopoverOpen((v) => !v)}
            title="App info"
          >
            Born Again v{appVersion || '—'}
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
                  title="Open the folder holding Born Again's local data — useful if support asks for it"
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
        <div className="status-live" aria-live="polite">
          <span className={`status-chip${projectionOpen ? (isScreenBlanked ? ' is-blank' : ' is-live') : ''}`}>
            <span className="status-chip-dot" aria-hidden="true" />
            {projectionOpen ? (isScreenBlanked ? 'Screen hidden' : 'On air') : 'Projection off'}
          </span>
          {stageOpen && <span className="status-chip">Stage monitor</span>}
          {displayInfo && (
            <span className="status-chip" title={displayInfo.targetName ?? undefined}>
              {displayInfo.displays.length} display{displayInfo.displays.length === 1 ? '' : 's'}
            </span>
          )}
          <span className="status-chip">
            {serviceQueue.length} in queue
          </span>
        </div>
      </footer>
    </div>
    </AppActionsContext.Provider>
  )
}
