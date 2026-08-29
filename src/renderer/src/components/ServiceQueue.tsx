import { useState } from 'react'
import type { QueueItem } from '../types'
import { itemTitle } from '../../../shared/queueItem'

interface Props {
  queue: QueueItem[]
  activeIndex: number | null
  activeSlide: number
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

  const canPrev = projectionOpen && activeIndex !== null && (activeIndex > 0 || activeSlide > 0)
  const canNext =
    projectionOpen &&
    queue.length > 0 &&
    (activeIndex === null ||
      activeIndex < queue.length - 1 ||
      activeSlide < (queue[activeIndex]?.slides.length ?? 1) - 1)

  const activeItem = activeIndex !== null ? queue[activeIndex] : undefined
  const nowLine = !projectionOpen
    ? 'Projection window is closed'
    : blanked
      ? 'Screen is hidden'
      : activeItem
        ? `${itemTitle(activeItem)}${activeItem.slides.length > 1 ? `  ·  ${activeSlide + 1} of ${activeItem.slides.length}` : ''}`
        : 'Nothing on screen yet'

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

      {queue.length > 0 && (
        <div className="queue-live-bar">
          <div className="queue-live-now" title="What the congregation is seeing right now">
            <span className="queue-live-label">On screen</span>
            <span className="queue-live-text">{nowLine}</span>
          </div>
          <div className="queue-live-nav">
            <button className="btn-nav" onClick={onPrev} disabled={!canPrev} title="Back one slide (← or Space+Shift)">
              ‹ Back
            </button>
            <button className="btn-nav btn-nav--next" onClick={onNext} disabled={!canNext} title="Next slide (→ or Space)">
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
