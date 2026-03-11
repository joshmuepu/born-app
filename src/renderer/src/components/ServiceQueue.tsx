import { useState } from 'react'
import type { Quote } from '../types'

interface Props {
  queue: Quote[]
  activeIndex: number | null
  onProject: (index: number) => void
  onRemove: (index: number) => void
  onClear: () => void
  onPrev: () => void
  onNext: () => void
  onReorder: (from: number, to: number) => void
}

export default function ServiceQueue({
  queue,
  activeIndex,
  onProject,
  onRemove,
  onClear,
  onPrev,
  onNext,
  onReorder
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const canPrev = activeIndex !== null && activeIndex > 0
  const canNext = queue.length > 0 && (activeIndex === null || activeIndex < queue.length - 1)

  return (
    <div className="service-queue">
      <div className="queue-header">
        <h2>Service Queue</h2>
        <div className="queue-header-actions">
          <button
            className="btn-secondary btn-sm"
            onClick={onPrev}
            disabled={!canPrev}
            title="Previous quote"
          >
            ← Prev
          </button>
          <button
            className="btn-secondary btn-sm"
            onClick={onNext}
            disabled={!canNext}
            title="Next quote"
          >
            Next →
          </button>
          {queue.length > 0 && (
            <button className="btn-secondary btn-sm" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="queue-empty">
          <p>No quotes queued</p>
        </div>
      ) : (
        <div className="queue-list">
          {queue.map((quote, index) => (
            <div
              key={index}
              className={[
                'queue-item',
                index === activeIndex ? 'queue-item--active' : '',
                index === dragOverIndex && dragIndex !== index ? 'queue-item--drag-over' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(index)
              }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) {
                  onReorder(dragIndex, index)
                }
                setDragIndex(null)
                setDragOverIndex(null)
              }}
              onDragEnd={() => {
                setDragIndex(null)
                setDragOverIndex(null)
              }}
            >
              <div className="queue-item-meta">
                <span className="result-date">{quote.dateCode}</span>
                <span className="result-ref">{quote.paragraphRef}</span>
              </div>
              <p className="queue-item-text">{quote.text}</p>
              <div className="result-actions">
                <button className="btn-primary btn-sm" onClick={() => onProject(index)}>
                  Project
                </button>
                <button className="btn-secondary btn-sm" onClick={() => onRemove(index)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
