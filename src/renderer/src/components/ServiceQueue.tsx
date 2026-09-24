import { useRef, useState } from 'react'
import { Monitor, MonitorPlay, MonitorOff, EyeOff } from 'lucide-react'
import type { QueueItem, RecentService } from '../types'
import { itemTitle } from '../../../shared/queueItem'
import StartScreen from './StartScreen'
import { useAutoFitFontSize } from '../useAutoFitFontSize'

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
  activeIndex: number | null
  activeSlide: number
  /** What's actually on the projector right now (follows Next/Prev flow-through). */
  onScreen?: OnScreen | null
  projectionOpen: boolean
  stageOpen: boolean
  blanked: boolean
  onProject: (index: number, slide?: number) => void
  /** Click a row to go to that item in the source panel (does NOT project it). */
  onSelect: (index: number) => void
  onRemove: (index: number) => void
  onPrev: () => void
  onNext: () => void
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

/** Short preview line for a queue row. */
function itemPreview(item: QueueItem): string {
  if (item.kind === 'quote') return item.quote.text
  return item.slides.map((s) => s.text).join('  ·  ')
}

export default function ServiceQueue({
  queue,
  activeIndex,
  activeSlide,
  onScreen,
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

  const liveTextRef = useRef<HTMLDivElement>(null)
  const liveFitRem = useAutoFitFontSize(liveTextRef, onScreen?.text, LIVE_TEXT_BASE_REM, 0.9)

  // Next/Prev drive flow-through, so they're live whenever something is (or can
  // be) on screen; the handlers clamp at the real edges (a song's last slide).
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
            return (
              <div
                key={item.id}
                className={[
                  'queue-item',
                  `queue-item--${item.kind}`,
                  active ? 'queue-item--active' : '',
                  !active && projectionOpen && index === nextItemIndex ? 'queue-item--next' : '',
                  index === dragOverIndex && dragIndex !== index ? 'queue-item--drag-over' : ''
                ].filter(Boolean).join(' ')}
                role="button"
                tabIndex={0}
                title="Go to this item to read it — use Project to put it on screen"
                onClick={() => onSelect(index)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                    e.preventDefault()
                    onSelect(index)
                  }
                }}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index) }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index)
                  setDragIndex(null)
                  setDragOverIndex(null)
                }}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
              >
                <div className="queue-item-meta">
                  <span className={`queue-badge queue-badge--${item.kind}`}>{KIND_BADGE[item.kind]}</span>
                  <span className="queue-item-title">{itemTitle(item)}</span>
                  {item.slides.length > 1 && (
                    <span className="queue-item-slides">
                      {active ? `${activeSlide + 1}/${item.slides.length}` : `${item.slides.length} slides`}
                    </span>
                  )}
                  {active && <span className="queue-item-live">On screen</span>}
                  {!active && projectionOpen && index === nextItemIndex && (
                    <span className="queue-item-upnext">Up next</span>
                  )}
                </div>
                <p className="queue-item-text">{itemPreview(item)}</p>
                <div className="result-actions">
                  <button
                    className="btn-primary btn-sm"
                    onClick={(e) => { e.stopPropagation(); onProject(index) }}
                  >
                    {active ? 'Restart' : 'Project'}
                  </button>
                  <button
                    className="btn-quiet btn-sm"
                    onClick={(e) => { e.stopPropagation(); onRemove(index) }}
                  >
                    Remove
                  </button>
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
            <button className="btn-nav" onClick={onPrev} disabled={!canPrev} title="Back — previous slide / verse / paragraph (← or Shift+Space)">
              ‹ Back
            </button>
            <button className="btn-nav btn-nav--next" onClick={onNext} disabled={!canNext} title="Next — next slide / verse / paragraph (→ or Space)">
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
