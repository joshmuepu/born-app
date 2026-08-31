import { useState } from 'react'
import type { QueueItem } from '../types'
import { itemTitle } from '../../../shared/queueItem'

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
  blanked: boolean
  onProject: (index: number) => void
  onRemove: (index: number) => void
  onClear: () => void
  onPrev: () => void
  onNext: () => void
  onReorder: (from: number, to: number) => void
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
  blanked,
  onProject,
  onRemove,
  onClear,
  onPrev,
  onNext,
  onReorder
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

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
        {queue.length > 0 && (
          <button className="btn-quiet btn-sm" onClick={onClear}>Clear all</button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="queue-empty">
          <p>Nothing queued yet</p>
          <p className="results-empty-hint">
            Add quotes, Bible passages, or songs and they’ll line up here in order.
          </p>
        </div>
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
          <div className="live-now" title="Exactly what the congregation is seeing right now">
            <div className="live-now-head">
              <span className="queue-live-label">On screen</span>
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
            {!status && onScreen?.nextText && (
              <div className="live-next">
                <span className="live-next-label">Next</span> {onScreen.nextText}
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
