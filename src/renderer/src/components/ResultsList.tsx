import { useState } from 'react'
import type { Quote } from '../types'

interface Props {
  results: Quote[]
  onAddToQueue: (quote: Quote) => void
  onSendToProjection: (quote: Quote) => void
  fontSize: number
}

export default function ResultsList({ results, onAddToQueue, onSendToProjection, fontSize }: Props) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  if (results.length === 0) {
    return (
      <div className="results-empty">
        <p>Search for sermon quotes above</p>
      </div>
    )
  }

  const previewQuote = previewIndex !== null ? results[previewIndex] : null

  return (
    <div className="results-panel">
      {previewQuote && (
        <div className="preview-pane">
          <div className="preview-label">Preview</div>
          <div className="preview-screen">
            <div className="preview-text" style={{ fontSize: `${Math.max(0.75, fontSize * 0.22)}rem` }}>
              {previewQuote.text}
            </div>
            <div className="preview-reference">
              <span className="preview-ref-title">{previewQuote.sermonTitle}</span>
              <span className="preview-ref-sep">·</span>
              <span className="preview-ref-date">{previewQuote.dateCode}</span>
              <span className="preview-ref-sep">·</span>
              <span className="preview-ref-para">{previewQuote.paragraphRef}</span>
            </div>
          </div>
        </div>
      )}
      <div className="results-list">
        {results.map((quote, index) => (
          <div
            key={index}
            className={`result-item${previewIndex === index ? ' result-item--selected' : ''}`}
            onClick={() => setPreviewIndex(previewIndex === index ? null : index)}
          >
            <div className="result-meta">
              <span className="result-date">{quote.dateCode}</span>
              <span className="result-title">{quote.sermonTitle}</span>
              <span className="result-ref">{quote.paragraphRef}</span>
            </div>
            <p className="result-text">{quote.text}</p>
            <div className="result-actions">
              <button
                className="btn-secondary btn-sm"
                onClick={(e) => { e.stopPropagation(); onAddToQueue(quote) }}
              >
                + Queue
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={(e) => { e.stopPropagation(); onSendToProjection(quote) }}
              >
                Project
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
