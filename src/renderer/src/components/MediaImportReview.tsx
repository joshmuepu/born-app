import { X, ImageOff } from 'lucide-react'
import type { MediaRef } from '../../../shared/queueItem'
import './Preflight.css'

export interface ReviewRequest {
  missing: MediaRef[]
  total: number
  resolve: (choice: 'locate' | 'open' | 'cancel') => void
}

/** Shown once, before a shared service is opened, when some of its pictures are not in this
 *  computer's library. Nothing has been changed yet: Cancel leaves everything exactly as it was. */
export default function MediaImportReview({ request }: { request: ReviewRequest | null }): JSX.Element | null {
  if (!request) return null
  const { missing, total, resolve } = request
  return (
    <div className="modal-overlay" onClick={() => resolve('cancel')}>
      <div
        className="modal preflight"
        role="dialog"
        aria-modal="true"
        aria-label="Pictures missing from this computer"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); resolve('cancel') } }}
      >
        <div className="modal-title-row">
          <h3 className="modal-title">{missing.length} of {total} picture{total === 1 ? '' : 's'} in this service aren’t on this computer</h3>
          <button className="btn-icon btn-sm" onClick={() => resolve('cancel')} aria-label="Cancel"><X width={15} height={15} strokeWidth={2.2} /></button>
        </div>
        <p className="modal-hint">
          The service file lists its pictures but doesn’t contain them. If you have the pictures (for example on a USB stick or in a
          shared folder), choose that folder and BORN will find them by what they are — names don’t matter — and add only those.
        </p>
        <ul className="preflight-list" style={{ maxHeight: 220 }}>
          {missing.slice(0, 40).map((m) => (
            <li key={m.hash} className="preflight-row preflight-row--warn">
              <ImageOff width={18} height={18} aria-hidden="true" />
              <div className="preflight-text">
                <div className="preflight-title">{m.name}</div>
                <div className="preflight-detail">{m.width}×{m.height} · {(m.bytes / 1048576).toFixed(m.bytes > 1048576 ? 1 : 2)} MB</div>
              </div>
            </li>
          ))}
          {missing.length > 40 && <li className="preflight-detail">…and {missing.length - 40} more.</li>}
        </ul>
        <div className="preflight-foot">
          <button className="btn-quiet btn-sm" onClick={() => resolve('cancel')}>Cancel — change nothing</button>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn-quiet btn-sm" onClick={() => resolve('open')}>Open anyway</button>
            <button className="btn-primary btn-sm" onClick={() => resolve('locate')}>Find the pictures…</button>
          </span>
        </div>
        <p className="preflight-detail" style={{ marginTop: 8 }}>“Open anyway” opens the service with those pictures marked missing; “Is tonight ready?” will list them.</p>
      </div>
    </div>
  )
}
