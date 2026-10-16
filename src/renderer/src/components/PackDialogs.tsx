import { useEffect, useRef, useState } from 'react'
import { X, Check, AlertTriangle, ImagePlus, Package } from 'lucide-react'
import type { PackEstimate, PackImportSummary, PackReview } from '../../../shared/servicePack'
import { PACK_LIMITS } from '../../../shared/servicePack'
import './Preflight.css'
import './MediaPanel.css'

const mb = (n: number): string => (n >= 1024 * 1024 * 1024 ? `${(n / 1024 / 1024 / 1024).toFixed(1)} GB` : n >= 1024 * 1024 ? `${(n / 1048576).toFixed(n > 10 * 1048576 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`)

function Progress({ label, done, total, bytes, onCancel }: { label: string; done: number; total: number; bytes?: string; onCancel?: () => void }): JSX.Element {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0
  return (
    <div className="preflight-summary preflight-summary--busy" role="status" aria-live="polite">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ flex: 1 }}>{label}</span>
        {bytes && <span className="preflight-detail">{bytes}</span>}
      </div>
      <div className="media-progress-bar" style={{ margin: '8px 0' }}><i style={{ width: `${pct}%` }} /></div>
      {onCancel && <button className="btn-quiet btn-sm" onClick={onCancel}>Cancel</button>}
    </div>
  )
}

/** "Save service with pictures": what goes in, how big, then a file picker, progress and Cancel. */
export function PackExportDialog({ queue, title, onClose, onSaved }: { queue: unknown[]; title: string; onClose: () => void; onSaved: (path: string, count: number) => void }): JSX.Element {
  const [est, setEst] = useState<PackEstimate | null | undefined>(undefined)
  const [busy, setBusy] = useState<null | { done: number; total: number; doneBytes: number; totalBytes: number }>(null)
  const [error, setError] = useState<{ message: string; missing?: Array<{ name: string; status: string }> } | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    void window.electronAPI.packEstimate(queue).then((e) => alive.current && setEst(e))
    const off = window.electronAPI.onPackProgress((p) => {
      if (p.kind === 'export') setBusy({ done: p.done, total: p.total, doneBytes: p.doneBytes ?? 0, totalBytes: p.totalBytes ?? 0 })
    })
    return () => { alive.current = false; off() }
  }, [queue])

  const save = async (): Promise<void> => {
    setError(null)
    setBusy({ done: 0, total: est?.count ?? 0, doneBytes: 0, totalBytes: est?.totalBytes ?? 0 })
    const r = await window.electronAPI.packExport(queue, title)
    if (!alive.current) return
    setBusy(null)
    if (r.ok) { onSaved(r.path, r.count); return }
    if (r.canceled || r.code === 'cancelled') return // chose nothing / cancelled: nothing was written
    setError({ message: r.message, missing: r.missing })
  }
  const cancel = (): void => (busy ? window.electronAPI.packCancel() : onClose())
  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="modal preflight" role="dialog" aria-modal="true" aria-label="Save service with pictures" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel() } }}>
        <div className="modal-title-row">
          <h3 className="modal-title">Save service with pictures</h3>
          <button className="btn-icon btn-sm" onClick={cancel} aria-label="Close"><X width={15} height={15} strokeWidth={2.2} /></button>
        </div>
        <p className="modal-hint">
          One file (<b>.bornpack</b>) with the queue <b>and</b> the pictures it uses. Open it on another computer and the pictures come with it. A plain <b>Save</b> (.born) still works the old way and is smaller.
        </p>
        {est === undefined && <div className="preflight-summary preflight-summary--busy">Counting pictures…</div>}
        {est === null && <div className="preflight-summary preflight-summary--fail">The picture library could not be opened.</div>}
        {est && (
          <>
            {est.count === 0 && est.missing.length === 0 && <div className="preflight-summary preflight-summary--warn">This service has no pictures. Use plain Save instead.</div>}
            <ul className="preflight-list" style={{ maxHeight: 240 }}>
              {est.groups.map((g) => (
                <li key={g.label + g.ids[0]} className="preflight-row preflight-row--pass">
                  <ImagePlus width={18} height={18} aria-hidden="true" />
                  <div className="preflight-text"><div className="preflight-title">{g.label}</div><div className="preflight-detail">{g.sub}</div></div>
                  <span className="preflight-detail">{mb(g.bytes)}</span>
                </li>
              ))}
              {est.missing.map((m) => (
                <li key={m.id} className="preflight-row preflight-row--fail">
                  <AlertTriangle width={18} height={18} aria-hidden="true" />
                  <div className="preflight-text"><div className="preflight-title">{m.name}</div><div className="preflight-detail">{m.status === 'missing' ? 'Missing — the file or its drive is not available.' : m.status === 'changed' ? 'Changed since it was added.' : 'Cannot be read.'}</div></div>
                </li>
              ))}
            </ul>
            <div className="preflight-foot">
              <span><b>{est.count}</b> picture{est.count === 1 ? '' : 's'} · pack size ≈ <b>{mb(est.totalBytes)}</b>{est.freeBytes != null && <> · {mb(est.freeBytes)} free here</>}</span>
              <span>Pictures only — no sermons, songs or settings.</span>
            </div>
            {est.big && !est.tooBig && <div className="preflight-summary preflight-summary--warn">This is a big pack — about {mb(est.totalBytes)}. It will take a few minutes to save and may not fit on a small USB stick.</div>}
            {est.tooBig && <div className="preflight-summary preflight-summary--fail">This service’s pictures come to {mb(est.totalBytes)}, more than one pack can hold ({mb(PACK_LIMITS.maxPackBytes)}). Remove some of the biggest pictures and try again.</div>}
            {est.tooMany && <div className="preflight-summary preflight-summary--fail">More than {PACK_LIMITS.maxPictures.toLocaleString()} pictures. Split the service.</div>}
            {est.missing.length > 0 && <div className="preflight-summary preflight-summary--fail">{est.missing.length} picture{est.missing.length === 1 ? ' is' : 's are'} missing, so nothing can be saved. Use <b>Check</b> to fix them, then save again.</div>}
          </>
        )}
        {busy && <Progress label={`Saving… ${Math.min(busy.done + 1, busy.total)} of ${busy.total} pictures`} done={busy.doneBytes} total={busy.totalBytes} bytes={`${mb(busy.doneBytes)} of ${mb(busy.totalBytes)}`} onCancel={cancel} />}
        {busy && <div className="preflight-detail">Nothing is written to the final file until it is complete.</div>}
        {error && (
          <div className="preflight-summary preflight-summary--fail" role="alert">
            {error.message}
            {error.missing && <ul>{error.missing.slice(0, 8).map((m, i) => <li key={i}>{m.name}</li>)}</ul>}
          </div>
        )}
        <div className="preflight-foot">
          <button className="btn-quiet btn-sm" onClick={cancel}>Cancel</button>
          <button className="btn-primary btn-sm" onClick={() => void save()} disabled={!est || busy !== null || est.count === 0 || est.missing.length > 0 || est.tooBig || est.tooMany}><Package width={14} height={14} /> Choose where to save…</button>
        </div>
      </div>
    </div>
  )
}

/** "Open service pack": review before anything is copied; Cancel changes nothing; the copy is all-or-nothing. */
export function PackImportDialog({ review, onClose, onOpened }: { review: PackReview; onClose: () => void; onOpened: (summary: PackImportSummary) => void }): JSX.Element {
  const [busy, setBusy] = useState<null | { phase: 'check' | 'import'; done: number; total: number }>(null)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    const off = window.electronAPI.onPackProgress((p) => { if (p.kind !== 'export') setBusy({ phase: p.kind === 'check' ? 'check' : 'import', done: p.done, total: p.total }) })
    return () => { alive.current = false; off() }
  }, [])
  const go = async (): Promise<void> => {
    setError(null)
    setBusy({ phase: 'check', done: 0, total: review.files.length })
    const r = await window.electronAPI.packImport(review.path)
    if (!alive.current) return
    setBusy(null)
    if (r.ok) { onOpened(r.summary); return }
    if (r.code !== 'cancelled') setError(r.message)
    else onClose() // cancelled: library and queue are exactly as before
  }
  const cancel = (): void => (busy ? window.electronAPI.packCancel() : onClose())
  const { counts } = review
  const when = review.createdAt ? new Date(review.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="modal preflight" role="dialog" aria-modal="true" aria-label="Open service pack" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel() } }}>
        <div className="modal-title-row">
          <h3 className="modal-title">Open service pack</h3>
          <button className="btn-icon btn-sm" onClick={cancel} aria-label="Close"><X width={15} height={15} strokeWidth={2.2} /></button>
        </div>
        <p className="modal-hint"><b>{review.title}</b>{when && <> · made {when}</>} · {mb(review.packBytes)} · {review.files.length} picture{review.files.length === 1 ? '' : 's'}. <b>Nothing has been copied yet.</b> Every file was checked against its fingerprint.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 8px' }}>
          <span className="media-chip">{counts.new} new</span>
          <span className="media-chip">{counts.have} already here</span>
          {counts.damaged > 0 && <span className="media-chip media-chip--bad">{counts.damaged} damaged</span>}
        </div>
        <ul className="preflight-list" style={{ maxHeight: 240 }}>
          {review.items.filter((i) => i.new + i.have + i.damaged > 0).map((it, i) => (
            <li key={i} className={`preflight-row ${it.damaged ? 'preflight-row--fail' : 'preflight-row--pass'}`}>
              {it.damaged ? <AlertTriangle width={18} height={18} aria-hidden="true" /> : <Check width={18} height={18} aria-hidden="true" />}
              <div className="preflight-text">
                <div className="preflight-title">{it.title}</div>
                <div className="preflight-detail">{[it.new && `${it.new} new`, it.have && `${it.have} already in your library`, it.damaged && `${it.damaged} damaged in the file`].filter(Boolean).join(' · ')}</div>
              </div>
            </li>
          ))}
        </ul>
        {counts.damaged > 0 && <div className="preflight-summary preflight-summary--warn">{counts.damaged} picture{counts.damaged === 1 ? ' was' : 's were'} damaged when the pack was copied. You can still open the service; those items will show as missing until you add the pictures. Ask for the pack again if you can.</div>}
        <div className="preflight-detail">Opening does <b>not</b> put anything on a screen, and it <b>replaces your current queue</b> (with Undo).{review.backgrounds > 0 && <> {review.backgrounds} background{review.backgrounds === 1 ? '' : 's'} came with the pack; set them from Media ▸ Backgrounds if you want them.</>}</div>
        {busy && <Progress label={busy.phase === 'check' ? 'Checking… ' : `Copying… ${Math.min(busy.done + 1, busy.total)} of ${busy.total}`} done={busy.done} total={busy.total} onCancel={cancel} />}
        {busy && <div className="preflight-detail">Cancel now and your library and queue stay exactly as they were.</div>}
        {error && <div className="preflight-summary preflight-summary--fail" role="alert">{error}</div>}
        <div className="preflight-foot">
          <button className="btn-quiet btn-sm" onClick={cancel}>{busy ? 'Cancel' : 'Cancel — change nothing'}</button>
          <button className="btn-primary btn-sm" onClick={() => void go()} disabled={busy !== null}>{counts.new > 0 ? `Add ${counts.new} picture${counts.new === 1 ? '' : 's'} and open` : 'Open service'}</button>
        </div>
      </div>
    </div>
  )
}
