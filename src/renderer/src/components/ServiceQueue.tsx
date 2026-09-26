import { useRef, useState } from 'react'
import { Monitor, MonitorPlay, MonitorOff, EyeOff, Mic, BookOpen, Music, Check } from 'lucide-react'
import type { QueueItem, RecentService } from '../types'
import { itemTitle } from '../../../shared/queueItem'
import StartScreen from './StartScreen'
import { useAutoFitFontSize } from '../useAutoFitFontSize'
import './ServiceQueue.css'

/** Ceiling for the confidence-monitor text — auto-fit shrinks below this for
 *  longer passages, so a short verse reads large and a long one still fits
 *  in full, with no scrollbar. Sized for a compact glance-at box: content is
 *  always one bounded slide now (a sermon paragraph, a Bible verse, a song
 *  section), never the old multi-paragraph blob this used to accommodate. */
const LIVE_TEXT_BASE_REM = 1.45

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
  onSaveService: () => void
  recents: RecentService[]
  onOpenRecent: (path: string) => void
}

const KIND_BADGE: Record<QueueItem['kind'], string> = {
  quote: 'Quote',
  bible: 'Bible',
  song: 'Song'
}

/** Sermons/quotes are deliberately left as the app's neutral default
 *  (see --sermons "Quiet Stone" in App.css) — Bible and Songs get the two
 *  real accent colors. The icon carries the rest of the at-a-glance
 *  distinction that a label alone doesn't. */
const KIND_ICON: Record<QueueItem['kind'], typeof Mic> = {
  quote: Mic,
  bible: BookOpen,
  song: Music
}

/** Short preview line for a queue row. */
function itemPreview(item: QueueItem): string {
  if (item.kind === 'quote') return item.quote.text
  return item.slides.map((s) => s.text).join('  ·  ')
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
  onSaveService,
  recents,
  onOpenRecent
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  // Which monitor the operator is following: the congregation's screen (current
  // slide only) or the stage monitor (current slide + what Next will show).
  const [monitor, setMonitor] = useState<'screen' | 'stage'>('screen')
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

  const liveTextRef = useRef<HTMLDivElement>(null)
  const liveFitRem = useAutoFitFontSize(liveTextRef, onScreen?.text, LIVE_TEXT_BASE_REM, 0.9)

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

  const StatusIcon = !projectionOpen ? MonitorOff : blanked ? EyeOff : Monitor

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

  return (
    <div className="service-queue">
      <div className="queue-header">
        <h2>Service Queue</h2>
        <div className="queue-file-actions">
          <button className="btn-quiet btn-sm" onClick={onNewService} title="Start a new, empty service (clears the queue)">New</button>
          <button className="btn-quiet btn-sm" onClick={onOpenService} title="Open a saved service file">Open</button>
          <button className="btn-quiet btn-sm" onClick={onSaveService} title="Save this service to a file" disabled={queue.length === 0}>Save</button>
        </div>
      </div>

      {queue.length === 0 ? (
        <StartScreen recents={recents} onOpen={onOpenService} onOpenRecent={onOpenRecent} />
      ) : (
        <div className="queue-list">
          {queue.map((item, index) => {
            const active = index === activeIndex
            const played = !active && playedIds.has(item.id)
            const isNext = !active && projectionOpen && index === nextItemIndex
            const Icon = KIND_ICON[item.kind]
            const dragProps = {
              draggable: true,
              onDragStart: () => setDragIndex(index),
              onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOverIndex(index) },
              onDragLeave: () => setDragOverIndex(null),
              onDrop: () => {
                if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index)
                setDragIndex(null)
                setDragOverIndex(null)
              },
              onDragEnd: () => { setDragIndex(null); setDragOverIndex(null) }
            }
            const rowClass = [
              'queue-row',
              `queue-row--${item.kind}`,
              active ? 'queue-row--active' : 'queue-row--compact',
              played ? 'queue-row--played' : '',
              isNext ? 'queue-row--next' : '',
              index === dragOverIndex && dragIndex !== index ? 'queue-row--drag-over' : ''
            ].filter(Boolean).join(' ')

            if (!active) {
              return (
                <div
                  key={item.id}
                  className={rowClass}
                  role="button"
                  tabIndex={0}
                  title={played ? 'Already shown — click to go to it' : 'Go to this item to read it — use Project to put it on screen'}
                  onClick={() => onSelect(index)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                      e.preventDefault()
                      onSelect(index)
                    }
                  }}
                  {...dragProps}
                >
                  <span className="queue-row-icon" aria-hidden="true">
                    {played ? <Check width={14} height={14} strokeWidth={2.4} /> : <Icon width={14} height={14} strokeWidth={2} />}
                  </span>
                  <span className="queue-row-title">{itemTitle(item)}</span>
                  {item.slides.length > 1 && <span className="queue-row-count">{item.slides.length}</span>}
                  {isNext && <span className="queue-row-tag">Up next</span>}
                  <span className="queue-row-actions">
                    <button className="btn-quiet btn-sm" onClick={(e) => { e.stopPropagation(); onProject(index) }}>Project</button>
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
                  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                    e.preventDefault()
                    onSelect(index)
                  }
                }}
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
          })}
        </div>
      )}

      {(projectionOpen || queue.length > 0) && (
        <div className="queue-live-bar">
          <div
            className="live-now"
            title={
              blanked && onScreen
                ? 'Hidden from the congregation — this is what Show screen will bring back'
                : monitor === 'screen'
                  ? 'Exactly what the congregation is seeing right now'
                  : 'What the stage monitor shows — the current slide and what Next will bring up'
            }
          >
            <div className="live-now-head">
              <div
                className="monitor-switch"
                role="tablist"
                aria-label="Preview the main screen or the stage monitor"
              >
                <button
                  role="tab"
                  aria-selected={monitor === 'screen'}
                  className={`monitor-switch-tab${monitor === 'screen' ? ' is-active' : ''}`}
                  onClick={() => setMonitor('screen')}
                  title="What the congregation sees on the main screen"
                >
                  <Monitor className="monitor-switch-icon" width={14} height={14} strokeWidth={2} aria-hidden="true" />
                  Main screen
                </button>
                <button
                  role="tab"
                  aria-selected={monitor === 'stage'}
                  className={`monitor-switch-tab${monitor === 'stage' ? ' is-active' : ''}`}
                  onClick={() => setMonitor('stage')}
                  title={
                    stageOpen
                      ? 'What the platform sees on the stage monitor — current slide plus what Next brings up'
                      : 'Preview of the stage monitor (that window is currently closed)'
                  }
                >
                  <MonitorPlay className="monitor-switch-icon" width={14} height={14} strokeWidth={2} aria-hidden="true" />
                  Stage
                  <span
                    className={`monitor-switch-dot${stageOpen ? ' is-live' : ''}`}
                    title={stageOpen ? 'Stage monitor is open' : 'Stage monitor is closed'}
                  />
                </button>
              </div>
              {blanked && onScreen && !status && (
                <span className="live-now-hidden-badge" title="The congregation sees black — this is what's loaded, ready to bring back">
                  <EyeOff width={12} height={12} strokeWidth={2} aria-hidden="true" />
                  Hidden from screen
                </span>
              )}
              {orphaned && (
                <span className="live-now-hidden-badge live-now-hidden-badge--warn" title="This isn't tracked by any row in your queue — it was either removed while live, or projected without being queued">
                  Not in your queue
                </span>
              )}
              {readingAhead && !orphaned && !status && (
                <span className="live-now-hidden-badge" title="Still live, but past what was actually queued">
                  Reading ahead
                </span>
              )}
              {onScreen?.reference && !status && (
                <span className="live-now-ref">
                  {onScreen.label ? `${onScreen.label} · ` : ''}
                  {onScreen.reference}
                </span>
              )}
            </div>
            {status ? (
              <div className="live-now-status">
                <StatusIcon width={18} height={18} strokeWidth={1.75} aria-hidden="true" />
                <span>{status}</span>
              </div>
            ) : (
              <div ref={liveTextRef} className="live-now-text" style={{ fontSize: `${liveFitRem}rem` }}>
                <div className="live-now-text-inner">
                  {onScreen?.marker && <span className="live-now-marker">{onScreen.marker}</span>}
                  {onScreen?.text}
                </div>
              </div>
            )}
            {!status && monitor === 'stage' && (
              <div className="live-next">
                <div className="live-next-label">Next</div>
                <div className="live-next-text">
                  {onScreen?.nextText || 'End of this item — pick the next one from the queue'}
                </div>
              </div>
            )}
          </div>
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
