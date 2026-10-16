import { useRef, useState } from 'react'
import { Mic, BookOpen, Music, Check, Image as ImageIcon, FileQuestion, Globe } from 'lucide-react'
import type { ChannelInfo, OutputInfo, QueueItem, RecentService, SlidePayload } from '../types'
import PreviewLivePair from './PreviewLivePair'
import { isQueueDrag, readQueueDrag, type QueueDragPayload } from '../dragItem'
import { useContextMenu, type MenuItem } from './ContextMenu'
import { copyText, useAppActions } from '../AppActions'
import { itemTitle, isProjectable, unprojectableReason } from '../../../shared/queueItem'
import StartScreen from './StartScreen'
import './ServiceQueue.css'


interface OnScreen {
  /** The exact text on the projector right now. */
  text: string
  marker?: string
  reference?: string
  label?: string
  /** The exact text Next will show, when it's already loaded. */
  nextText?: string
}

interface Props {
  queue: QueueItem[]
  /** Ids actually projected at least once this run — see App.tsx's playedIds
   *  for why this is tracked by id rather than "everything before the
   *  current index." */
  playedIds: Set<string>
  activeIndex: number | null
  activeSlide: number
  /** What's actually on the projector right now (follows Next/Prev flow-through). */
  onScreen?: OnScreen | null
  /** Next/Prev flow-through has carried the live slide past the active
   *  item's own queued material — it's still genuinely live, just not what
   *  was actually queued, and the active row needs to say so plainly. */
  readingAhead: boolean
  projectionOpen: boolean
  stageOpen: boolean
  blanked: boolean
  onProject: (index: number, slide?: number) => void
  /** Click a row to go to that item in the source panel (does NOT project it). */
  onSelect: (index: number) => void
  onRemove: (index: number) => void
  /** Resolves to whether it actually moved anything — flow-through means
   *  these rarely run out, but they can (Revelation 22:21, a sermon
   *  transcript's last paragraph); false lets the button give feedback
   *  instead of silently doing nothing. */
  onPrev: () => Promise<boolean>
  onNext: () => Promise<boolean>
  onReorder: (from: number, to: number) => void
  /** Service files — a service file is this queue, so they live here. */
  onNewService: () => void
  onOpenService: () => void
  /** Additive alongside Open (which replaces the whole queue) — combines
   *  one or more separately-saved service files into the current queue. */
  onImportService: () => void
  onSaveService: () => void
  /** Save the queue and its pictures as one .bornpack / open one. Optional: absent = no buttons. */
  onSavePack?: () => void
  onOpenPack?: () => void
  recents: RecentService[]
  onOpenRecent: (path: string) => void
  /** Set when Open/Import couldn't read or parse a file — a damaged or
   *  empty .born file otherwise fails with no feedback at all. Null/absent
   *  when there's nothing to report (including a plain dialog cancel). */
  openError?: string | null
  /** Preview/Live pair (see PreviewLivePair). */
  channels?: ChannelInfo[]
  outputs?: OutputInfo[]
  fontSize?: number
  stagedPayload?: SlidePayload | null
  stagedTitle?: string | null
  nextPayload?: SlidePayload | null
  background?: { mediaId: string; dim: number } | null
  onTake?: () => void
  onUnstage?: () => void
  onToggleBlank?: () => void
  onClearChannel?: (channelId: string) => void
  /** Something dragged in from a browse pane was dropped at `index`. Never
   *  changes what is live — it only inserts. */
  onDropItem?: (payload: QueueDragPayload, index: number) => void
  /** Change a queued picture's display settings (never what is live). */
  onPreflight?: () => void
  onMediaSettings?: (index: number, patch: { fit?: 'fit' | 'fill' | 'stretch' | 'center'; autoAdvanceSec?: number; loop?: boolean }) => void
}

const KIND_BADGE: Record<QueueItem['kind'], string> = {
  quote: 'Quote',
  bible: 'Bible',
  song: 'Song',
  media: 'Media',
  youtube: 'YouTube · Online',
  unknown: 'Unavailable'
}

/** Sermons/quotes are deliberately left as the app's neutral default
 *  (see --sermons "Quiet Stone" in App.css) — Bible and Songs get the two
 *  real accent colors. The icon carries the rest of the at-a-glance
 *  distinction that a label alone doesn't. */
const KIND_ICON: Record<QueueItem['kind'], typeof Mic> = {
  quote: Mic,
  bible: BookOpen,
  song: Music,
  media: ImageIcon,
  youtube: Globe,
  unknown: FileQuestion
}

/** Short preview line for a queue row. */
function itemPreview(item: QueueItem): string {
  if (item.kind === 'quote') return item.quote.text
  return item.slides.map((s) => s.text).join('  ·  ')
}

/** The one piece of identifying detail itemTitle() can't carry — mainly for
 *  quotes, where the title is the sermon's title, not the specific
 *  paragraph. Queue three quotes from the same sermon (a completely normal
 *  workflow) and they're otherwise indistinguishable at a glance. Reuses
 *  each slide's own citation string (already built in quoteToItem/songToItem
 *  for exactly this purpose), trimming its redundant leading "title · "
 *  since the title's already shown directly above this. Bible items are
 *  already fully self-identifying via itemTitle() alone (it's the reference
 *  itself), so there's nothing worth repeating here for them. */
function itemSubtitle(item: QueueItem): string | undefined {
  if (item.kind !== 'quote' && item.kind !== 'song') return undefined
  const ref = item.slides[0]?.reference
  if (!ref) return undefined
  const prefix = `${itemTitle(item)} · `
  const trimmed = ref.startsWith(prefix) ? ref.slice(prefix.length) : ref
  return trimmed && trimmed !== itemTitle(item) ? trimmed : undefined
}

export default function ServiceQueue({
  queue,
  playedIds,
  activeIndex,
  activeSlide,
  onScreen,
  readingAhead,
  projectionOpen,
  stageOpen,
  blanked,
  onProject,
  onSelect,
  onRemove,
  onPrev,
  onNext,
  onReorder,
  onNewService,
  onOpenService,
  onImportService,
  onSaveService,
  onSavePack,
  onOpenPack,
  recents,
  onOpenRecent,
  openError,
  channels = [],
  outputs = [],
  fontSize = 4.5,
  stagedPayload = null,
  stagedTitle = null,
  nextPayload = null,
  onTake = () => {},
  onUnstage = () => {},
  onToggleBlank = () => {},
  onClearChannel = () => {},
  onDropItem = () => {},
  onMediaSettings,
  onPreflight,
  background
}: Props) {
  const actions = useAppActions()
  const ctx = useContextMenu()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  // Where a drop would land (0..queue.length), for both an item being reordered
  // and one dragged in from a browse pane. Shown as an insertion line.
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  // Brief feedback when Prev/Next genuinely has nowhere to go (the true start
  // of the service, or the true end of all available content) — flow-through
  // means that's rare, so a silent no-op reads as broken rather than "you're
  // at the edge." Cleared automatically; purely a CSS animation trigger.
  const [bump, setBump] = useState<'prev' | 'next' | null>(null)
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerBump = (dir: 'prev' | 'next'): void => {
    setBump(dir)
    if (bumpTimer.current) clearTimeout(bumpTimer.current)
    bumpTimer.current = setTimeout(() => setBump(null), 260)
  }
  const handlePrevClick = async (): Promise<void> => {
    if (!(await onPrev())) triggerBump('prev')
  }
  const handleNextClick = async (): Promise<void> => {
    if (!(await onNext())) triggerBump('next')
  }

  // Next/Prev drive flow-through, so they're live whenever something is (or can
  // be) on screen; the handlers themselves report back when they hit a real edge.
  const projecting = projectionOpen && !blanked && !!onScreen
  const canPrev = projecting
  const canNext = projecting || (projectionOpen && !blanked && queue.length > 0)

  // The confidence monitor's job is to show the operator what will come back
  // the moment they un-blank — so a blank only replaces the box with a status
  // placeholder when there's nothing loaded to show. If something is loaded,
  // it stays visible (with a "Hidden from screen" badge) even while blanked.
  const status = !projectionOpen
    ? 'Projection window is closed'
    : !onScreen
      ? blanked
        ? 'Screen is hidden'
        : 'Nothing on screen yet'
      : null

  // Something is genuinely live, but no row in the queue is tracking it —
  // either its item was removed from the queue while it was on screen, or it
  // was projected ad hoc from a source panel without being queued at all.
  // Either way the queue list correctly shows nothing as active; the live
  // bar is where an operator would actually notice the mismatch, so it has
  // to say so there rather than look like a normal tracked "on screen."
  const orphaned = !status && activeIndex == null && !!onScreen

  // The next thing in the service after what's on screen. Next/Prev never jump
  // here automatically — it's an explicit choice.
  const nextItemIndex =
    activeIndex == null ? (queue.length > 0 ? 0 : -1) : activeIndex + 1
  const nextItem = nextItemIndex >= 0 && nextItemIndex < queue.length ? queue[nextItemIndex] : null

  // A song's slides carry real labels (Verse 1, Chorus…) — surface them as
  // one-tap jump chips right where the operator is already looking, instead
  // of making them reopen the Songs panel to jump to (or repeat) the chorus.
  const activeItem = activeIndex != null ? queue[activeIndex] : null
  const showSlideJump = !status && activeItem?.kind === 'song' && activeItem.slides.length > 1

  // Grouped by contributor label — a remote-side "Song Leader"/"Preacher"
  // tag on an item (see shared/queueItem.ts's QueueSource), falling back to
  // one quiet "Added on desktop" bucket for anything with no tag at all.
  // Deliberately grouped by *label*, not by device — two phones both
  // labeled "Song Leader" read as one section, matching how the operator
  // actually thinks about who's contributing, not how many devices they're
  // using. Position within the underlying flat array (which is what Next/
  // Prev and drag-reorder actually operate on) is untouched by this — it's
  // a display grouping laid over the same one queue, not a second data
  // model, so dragging a row into a different section's slot still just
  // reorders the real array and the row settles back into its own group on
  // the next render. Headers only appear once there's genuinely more than
  // one contributor — a single-operator service looks exactly like it
  // always did.
  const UNTAGGED = ' desktop'
  const groupOrder: string[] = []
  const groupIndices = new Map<string, number[]>()
  queue.forEach((item, index) => {
    const key = item.source?.label ?? UNTAGGED
    if (!groupIndices.has(key)) {
      groupIndices.set(key, [])
      groupOrder.push(key)
    }
    groupIndices.get(key)!.push(index)
  })
  const orderedKeys = groupOrder.filter((k) => k !== UNTAGGED)
  if (groupIndices.has(UNTAGGED)) orderedKeys.push(UNTAGGED)
  const groups = orderedKeys.map((key) => ({
    label: key === UNTAGGED ? 'Added on desktop' : key,
    indices: groupIndices.get(key)!
  }))
  const showGroupHeaders = groups.length > 1

  const mediaMenu = (item: QueueItem, index: number): MenuItem[] => {
    if (item.kind !== 'media' || !onMediaSettings) return []
    const check = (on: boolean): string => (on ? '✓ ' : '')
    const fit = item.fit ?? 'fit'
    const fits: Array<['fit' | 'fill' | 'stretch' | 'center', string]> = [['fit', 'Fit — whole picture'], ['fill', 'Fill — crop edges'], ['stretch', 'Stretch'], ['center', 'Original size, centred']]
    const out: MenuItem[] = fits.map(([f, label], i) => ({
      id: 'fit-' + f,
      label: check(fit === f) + label,
      separatorBefore: i === 0,
      onSelect: () => onMediaSettings(index, { fit: f })
    }))
    if (item.slides.length > 1) {
      const secs = [0, 3, 5, 8, 15]
      secs.forEach((s, i) =>
        out.push({
          id: 'auto-' + s,
          label: check((item.autoAdvanceSec ?? 0) === s) + (s === 0 ? 'Advance by hand' : `Advance every ${s} s`),
          separatorBefore: i === 0,
          onSelect: () => onMediaSettings(index, { autoAdvanceSec: s })
        })
      )
      out.push({ id: 'loop', label: check(!!item.loop) + 'Loop (start over after the last)', onSelect: () => onMediaSettings(index, { loop: !item.loop }) })
    } else if (item.mediaKind === 'video') {
      out.push({ id: 'loop', label: check(!!item.loop) + 'Loop the video (start over when it ends)', separatorBefore: true, onSelect: () => onMediaSettings(index, { loop: !item.loop }) })
    }
    return out
  }

  const queueMenu = (item: QueueItem, index: number): MenuItem[] => {
    const ref = item.slides[0]?.reference ?? itemTitle(item)
    const playableItem = isProjectable(item)
    return [
      ...(playableItem
        ? [
            { id: 'project', label: index === activeIndex ? 'Restart from the top' : 'Project now', onSelect: () => onProject(index) },
            { id: 'stage', label: 'Stage in Preview', hint: 'goes live only when taken', onSelect: () => onSelect(index) }
          ]
        : []),
      { id: 'up', label: 'Move up', hint: 'Alt+↑', disabled: index === 0, separatorBefore: playableItem, onSelect: () => onReorder(index, index - 1) },
      { id: 'down', label: 'Move down', hint: 'Alt+↓', disabled: index === queue.length - 1, onSelect: () => onReorder(index, index + 1) },
      {
        id: 'copy',
        label: 'Copy reference',
        separatorBefore: true,
        onSelect: () => void copyText(ref).then((ok) => actions.notify(ok ? 'Copied the reference' : "Couldn't copy"))
      },
      ...mediaMenu(item, index),
      { id: 'remove', label: 'Remove from queue', danger: true, separatorBefore: true, onSelect: () => onRemove(index) }
    ]
  }

  const renderRow = (item: QueueItem, index: number): JSX.Element => {
    const menuBind = ctx.bind(() => queueMenu(item, index))
    const active = index === activeIndex
    const played = !active && playedIds.has(item.id)
    const isNext = !active && projectionOpen && index === nextItemIndex
    const Icon = KIND_ICON[item.kind] ?? FileQuestion
    const playable = isProjectable(item)
    const whyNot = unprojectableReason(item)
    const dragProps = {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        setDragIndex(index)
        e.dataTransfer.effectAllowed = 'move'
      },
      onDragOver: (e: React.DragEvent) => {
        if (dragIndex === null && !isQueueDrag(e.dataTransfer)) return
        e.preventDefault()
        e.stopPropagation()
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setDropIndex(e.clientY > r.top + r.height / 2 ? index + 1 : index)
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const at = dropIndex ?? index
        if (dragIndex !== null) {
          // Moving within the queue: "insert before slot `at`" → final index.
          const to = at > dragIndex ? at - 1 : at
          if (to !== dragIndex) onReorder(dragIndex, to)
        } else {
          const payload = readQueueDrag(e.dataTransfer)
          if (payload) onDropItem(payload, at)
        }
        setDragIndex(null)
        setDropIndex(null)
      },
      onDragEnd: () => { setDragIndex(null); setDropIndex(null) }
    }
    // Keyboard alternative to dragging: Alt+↑/↓ moves the focused row. Handled
    // here, on the row, so it never reaches the global Alt+↑/↓ (which moves the
    // item that is on screen).
    const moveWithKeys = (e: React.KeyboardEvent): boolean => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.target !== e.currentTarget) return false
      e.preventDefault()
      e.stopPropagation()
      const to = e.key === 'ArrowUp' ? index - 1 : index + 1
      if (to >= 0 && to < queue.length) onReorder(index, to)
      return true
    }
    const rowClass = [
      'queue-row',
      `queue-row--${item.kind}`,
      active ? 'queue-row--active' : 'queue-row--compact',
      played ? 'queue-row--played' : '',
      isNext ? 'queue-row--next' : '',
      dragIndex === index ? 'queue-row--dragging' : '',
      // The insertion line is painted on the row (no extra element), so nothing
      // shifts or re-mounts under the pointer while a drag is in flight.
      dropIndex === index ? 'queue-row--drop-before' : '',
      dropIndex === queue.length && index === queue.length - 1 ? 'queue-row--drop-after' : ''
    ].filter(Boolean).join(' ')

    if (!active) {
      const subtitle = itemSubtitle(item)
      const preview = item.kind === 'media' || item.kind === 'unknown' ? undefined : item.slides[0]?.text
      const detail = [subtitle, preview].filter(Boolean).join('  —  ')
      return (
        <div
          key={item.id}
          className={rowClass}
          role="button"
          tabIndex={0}
          title={
            !playable
              ? `${whyNot ?? 'Not available'} — it stays in your service file; it cannot be shown here`
              : played
                ? 'Already shown — click to go to it'
                : 'Go to this item to read it — use Project to put it on screen'
          }
          aria-disabled={!playable || undefined}
          onClick={() => playable && onSelect(index)}
          onKeyDown={(e) => {
            if (moveWithKeys(e)) return
            if (playable && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
              e.preventDefault()
              onSelect(index)
            }
          }}
          onKeyDownCapture={menuBind.onKeyDownCapture}
          onContextMenu={menuBind.onContextMenu}
          {...dragProps}
        >
          <span className="queue-row-icon" aria-hidden="true">
            {played ? <Check width={14} height={14} strokeWidth={2.4} /> : <Icon width={14} height={14} strokeWidth={2} />}
          </span>
          <div className="queue-row-main">
            <div className="queue-row-line">
              <span className="queue-row-title">{itemTitle(item)}</span>
              {item.slides.length > 1 && <span className="queue-row-count">{item.slides.length}</span>}
              {isNext && <span className="queue-row-tag">Up next</span>}
            </div>
            {detail && <div className="queue-row-detail">{detail}</div>}
            {!playable && whyNot && item.kind !== 'unknown' && <div className="queue-row-detail">{whyNot}</div>}
            {item.kind === 'media' && (
              <div className="queue-row-detail">
                {[
                  item.mediaKind === 'video' ? 'Video' : item.slides.length > 1 ? `${item.slides.length} pictures` : 'Picture',
                  item.slides.length > 1 ? (item.autoAdvanceSec ? `auto ${item.autoAdvanceSec} s` : 'by hand') : null,
                  item.loop ? 'loop' : null,
                  item.fit && item.fit !== 'fit' ? item.fit : null
                ].filter(Boolean).join(' · ')}
              </div>
            )}
            {item.kind === 'unknown' && (
              <div className="queue-row-detail">
                {item.reason === 'newer' ? 'Kept in the file — open it with the newer version.' : 'Kept as it was — it may be damaged.'}
              </div>
            )}
          </div>
          <span className="queue-row-actions">
            {playable && <button className="btn-quiet btn-sm" onClick={(e) => { e.stopPropagation(); onProject(index) }}>Project</button>}
            <button className="btn-quiet btn-sm" onClick={(e) => { e.stopPropagation(); onRemove(index) }}>Remove</button>
          </span>
        </div>
      )
    }

    // Active row: expanded, and reflects the real current slide —
    // not the item's static preview — so reading ahead into
    // adjacent source content shows up here as it happens.
    const liveText = onScreen?.text || itemPreview(item)
    return (
      <div
        key={item.id}
        className={rowClass}
        role="button"
        tabIndex={0}
        title="Go to this item to read it — use Restart to project it again from the top"
        onClick={() => onSelect(index)}
        onKeyDown={(e) => {
          if (moveWithKeys(e)) return
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
            e.preventDefault()
            onSelect(index)
          }
        }}
        onKeyDownCapture={menuBind.onKeyDownCapture}
        onContextMenu={menuBind.onContextMenu}
        {...dragProps}
      >
        <div className="queue-item-meta">
          <span className={`queue-badge queue-badge--${item.kind}`}>
            <Icon width={11} height={11} strokeWidth={2.2} aria-hidden="true" />
            {KIND_BADGE[item.kind]}
          </span>
          <span className="queue-item-title">{itemTitle(item)}</span>
          {item.slides.length > 1 && (
            <span className="queue-item-slides">{activeSlide + 1}/{item.slides.length}</span>
          )}
          <span className="queue-item-live">On screen</span>
          {readingAhead && (
            <span className="queue-item-ahead" title="Still live, but past what was actually queued">
              Reading ahead
            </span>
          )}
        </div>
        <p className="queue-item-text">{liveText}</p>
        <div className="result-actions">
          <button className="btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); onProject(index) }}>Restart</button>
          <button className="btn-quiet btn-sm" onClick={(e) => { e.stopPropagation(); onRemove(index) }}>Remove</button>
        </div>
      </div>
    )
  }

  return (
    <div className="service-queue">
      {ctx.element}
      <div className="queue-header">
        <h2>Service Queue</h2>
        <div className="queue-file-actions">
          <button className="btn-quiet btn-sm" onClick={onNewService} title="Start a new, empty service (clears the queue)">New</button>
          <button className="btn-quiet btn-sm" onClick={onOpenService} title="Open a saved service file">Open</button>
          <button className="btn-quiet btn-sm" onClick={onImportService} title="Combine one or more saved service files into the current queue">Import</button>
          <button className="btn-quiet btn-sm" onClick={onSaveService} title="Save this service to a file" disabled={queue.length === 0}>Save</button>
          {onSavePack && <button className="btn-quiet btn-sm" onClick={onSavePack} title="Save this service and its pictures together in one file you can carry to another computer" disabled={queue.length === 0 || !queue.some((i) => i.kind === 'media')}>Save + pictures</button>}
          {onOpenPack && <button className="btn-quiet btn-sm" onClick={onOpenPack} title="Open a service pack (a service with its pictures)">Open pack</button>}
          {onPreflight && <button className="btn-quiet btn-sm" onClick={onPreflight} title="Check that everything in this service is ready to show" disabled={queue.length === 0}>Check</button>}
        </div>
      </div>

      {openError && <div className="queue-open-error">{openError}</div>}

      {queue.length === 0 ? (
        <div
          className={`queue-empty-drop${dropIndex === 0 ? ' is-over' : ''}`}
          onDragOver={(e) => {
            if (!isQueueDrag(e.dataTransfer)) return
            e.preventDefault()
            setDropIndex(0)
          }}
          onDragLeave={() => setDropIndex(null)}
          onDrop={(e) => {
            e.preventDefault()
            const payload = readQueueDrag(e.dataTransfer)
            if (payload) onDropItem(payload, 0)
            setDropIndex(null)
          }}
        >
          <StartScreen recents={recents} onOpen={onOpenService} onOpenRecent={onOpenRecent} />
        </div>
      ) : (
        <div
          className="queue-list"
          onDragOver={(e) => {
            if (dragIndex === null && !isQueueDrag(e.dataTransfer)) return
            e.preventDefault()
            setDropIndex(queue.length)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropIndex(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (dragIndex !== null) {
              if (queue.length - 1 !== dragIndex) onReorder(dragIndex, queue.length - 1)
            } else {
              const payload = readQueueDrag(e.dataTransfer)
              if (payload) onDropItem(payload, queue.length)
            }
            setDragIndex(null)
            setDropIndex(null)
          }}
        >
          {groups.map((group) => (
            <div className="queue-section" key={group.label}>
              {showGroupHeaders && (
                <div className="queue-section-header">
                  <span className="queue-section-label">{group.label}</span>
                  <span className="queue-section-count">{group.indices.length}</span>
                </div>
              )}
              <div className="queue-section-items">
                {group.indices.map((index) => renderRow(queue[index], index))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(projectionOpen || queue.length > 0) && (
        <div className="queue-live-bar">
          <PreviewLivePair
            channels={channels}
            outputs={outputs}
            fontSize={fontSize}
            stagedPayload={stagedPayload}
            stagedTitle={stagedTitle}
            nextPayload={nextPayload}
            background={background}
            projectionOpen={projectionOpen}
            canTake={canNext || !!stagedPayload}
            onTake={onTake}
            onUnstage={onUnstage}
            onToggleBlank={onToggleBlank}
            onClearChannel={onClearChannel}
          />
          {(orphaned || (readingAhead && !status)) && (
            <div className="live-flags">
              {orphaned && (
                <span className="live-now-hidden-badge live-now-hidden-badge--warn" title="This isn't tracked by any row in your queue — it was either removed while live, or projected without being queued">
                  Not in your queue
                </span>
              )}
              {readingAhead && !orphaned && (
                <span className="live-now-hidden-badge" title="Still live, but past what was actually queued">
                  Reading ahead
                </span>
              )}
            </div>
          )}
          {showSlideJump && activeItem?.kind === 'song' && (
            <div className="live-slide-jump" role="tablist" aria-label="Jump to a verse or chorus">
              {activeItem.slides.map((s, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === activeSlide}
                  className={`live-slide-jump-chip${i === activeSlide ? ' is-active' : ''}`}
                  onClick={() => onProject(activeIndex as number, i)}
                  title={i === activeSlide ? `Repeat: ${s.label ?? `Slide ${i + 1}`}` : `Jump to ${s.label ?? `Slide ${i + 1}`}`}
                >
                  {s.label ?? `Slide ${i + 1}`}
                </button>
              ))}
            </div>
          )}
          <div className="queue-live-nav">
            <button
              className={`btn-nav${bump === 'prev' ? ' is-bump' : ''}`}
              onClick={handlePrevClick}
              disabled={!canPrev}
              title="Back — previous slide / verse / paragraph (← or Shift+Space)"
            >
              ‹ Back
            </button>
            <button
              className={`btn-nav btn-nav--next${bump === 'next' ? ' is-bump' : ''}`}
              onClick={handleNextClick}
              disabled={!canNext}
              title="Next — next slide / verse / paragraph (→ or Space)"
            >
              Next ›
            </button>
          </div>
          {nextItem && !status && (
            <div className="queue-upnext-hint">
              Up next: <strong>{itemTitle(nextItem)}</strong>
              <span className="queue-upnext-key"> — ⌘/Ctrl + →</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
