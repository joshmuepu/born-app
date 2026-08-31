import { useState } from 'react'
import type { QueueItem, RecentService } from '../types'
import { itemTitle } from '../../../shared/queueItem'
import StartScreen from './StartScreen'

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
  onProject: (index: number) => void
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

  // Next/Prev drive flow-through, so they're live whenever something is (or can
  // be) on screen; the handlers clamp at the real edges (a song's last slide).
  const projecting = projectionOpen && !blanked && !!onScreen
  const canPrev = projecting
  const canNext = projecting || (projectionOpen && !blanked && queue.length > 0)

  const status = !projectionOpen
    ? 'Projection window is closed'
    : blanked
      ? 'Screen is hidden'
      : !onScreen
        ? 'Nothing on screen yet'
        : null

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
                  index === dragOverIndex && dragIndex !== index ? 'queue-item--drag-over' : ''
                ].filter(Boolean).join(' ')}
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
                </div>
                <p className="queue-item-text">{itemPreview(item)}</p>
                <div className="result-actions">
                  <button className="btn-primary btn-sm" onClick={() => onProject(index)}>
                    {active ? 'Restart' : 'Project'}
                  </button>
                  <button className="btn-quiet btn-sm" onClick={() => onRemove(index)}>Remove</button>
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
              monitor === 'screen'
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
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="monitor-switch-icon">
                    <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" />
                    <path d="M6 14h4M8 11.5V14" />
                  </svg>
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
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="monitor-switch-icon">
                    <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" />
                    <path d="M6.5 5.5l3 2-3 2z" className="monitor-switch-icon-fill" />
                    <path d="M6 14h4M8 11.5V14" />
                  </svg>
                  Stage
                  <span
                    className={`monitor-switch-dot${stageOpen ? ' is-live' : ''}`}
                    title={stageOpen ? 'Stage monitor is open' : 'Stage monitor is closed'}
                  />
                </button>
              </div>
              {onScreen?.reference && !status && (
                <span className="live-now-ref">
                  {onScreen.label ? `${onScreen.label} · ` : ''}
                  {onScreen.reference}
                </span>
              )}
            </div>
            {status ? (
              <div className="live-now-status">{status}</div>
            ) : (
              <div className="live-now-text">
                {onScreen?.marker && <span className="live-now-marker">{onScreen.marker}</span>}
                {onScreen?.text}
              </div>
            )}
            {!status && monitor === 'stage' && (
              <div className="live-next">
                <span className="live-next-label">Next</span>{' '}
                {onScreen?.nextText || 'End of this item — pick the next one from the queue'}
              </div>
            )}
          </div>
          <div className="queue-live-nav">
            <button className="btn-nav" onClick={onPrev} disabled={!canPrev} title="Back (← or Shift+Space)">
              ‹ Back
            </button>
            <button className="btn-nav btn-nav--next" onClick={onNext} disabled={!canNext} title="Next (→ or Space)">
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
