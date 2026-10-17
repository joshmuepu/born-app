import TapeDownload from './TapeDownload'
import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Headphones, FolderOpen, Upload, Globe, Zap, Check, AlertTriangle, XCircle, RefreshCw, Trash2, Wand2, Hand } from 'lucide-react'
import type { TapeFolderHit, TapeImportResult, TapePreflight, TapeRecording, TapeFileStatus } from '../../../shared/tape'
import { formatTapeTime } from '../../../shared/tape'
import './Preflight.css'
import './TapeAttach.css'

type Rec = TapeRecording & { status: TapeFileStatus }
const mb = (n: number): string => (n >= 1024 * 1024 * 1024 ? `${(n / 1073741824).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1048576))} MB`)
const ICON = { ok: Check, warn: AlertTriangle, fail: XCircle } as const

/**
 * "Add the tape for this sermon" (mockup 02): choose or drop a file, or pick one the folder scan found, and see in plain words whether it is ready.
 * The file is copied into BORN's own folder; the original is never changed. BORN never downloads anything: "Get audio" only opens the
 * publisher's own page in the browser.
 */
export default function TapeAttach({
  sermonId,
  sermonTitle,
  dateCode,
  onClose,
  onChanged,
  onSync
}: {
  sermonId: number
  sermonTitle: string
  dateCode: string
  onClose: () => void
  onChanged: () => void
  /** open the sync editor for a recording (arrives with the editor) */
  onSync?: (recordingId: string, mode: 'tap' | 'auto') => void
}): JSX.Element {
  const [recs, setRecs] = useState<Rec[]>([])
  const [folder, setFolder] = useState<string | null>(null)
  const [hits, setHits] = useState<TapeFolderHit[]>([])
  const [link, setLink] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [problems, setProblems] = useState<string[]>([])
  const [pf, setPf] = useState<Record<string, TapePreflight | null>>({})
  const [dragOver, setDragOver] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const alive = useRef(true)

  const reload = useCallback(async () => {
    const r = await window.electronAPI.tapeRecordings(sermonId)
    if (!alive.current) return
    setRecs(r)
    for (const x of r) {
      void window.electronAPI.tapePreflight(x.id).then((p) => { if (alive.current) setPf((m) => ({ ...m, [x.id]: p })) })
    }
  }, [sermonId])
  const scan = useCallback(async () => {
    const info = await window.electronAPI.tapeInfo()
    if (!alive.current) return
    setFolder(info.folder)
    setHits(info.folder ? await window.electronAPI.tapeScanFolder() : [])
  }, [])
  useEffect(() => {
    alive.current = true
    void reload()
    void scan()
    return () => { alive.current = false }
  }, [reload, scan])

  const report = (results: TapeImportResult[]): void => {
    const good = results.filter((r): r is Extract<TapeImportResult, { ok: true }> => r.ok)
    const bad = results.filter((r): r is Extract<TapeImportResult, { ok: false }> => !r.ok)
    setNotes(good.flatMap((r) => [r.duplicate ? `“${r.file.name}” was already in BORN — attached to this sermon.` : `Added “${r.file.name}” (${formatTapeTime(r.file.durationSec)}).`, ...r.warnings]))
    setProblems(bad.map((r) => r.message))
    if (good.length) { onChanged(); void reload(); void scan() }
  }
  const choose = async (): Promise<void> => {
    setBusy('Choosing…')
    const r = await window.electronAPI.tapePickAndImport({ sermonId, link })
    setBusy(null)
    if (!r.canceled) report(r.results)
  }
  const drop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDragOver(false)
    const paths = window.electronAPI.tapePathsForFiles(Array.from(e.dataTransfer.files))
    if (!paths.length) return
    setBusy('Adding…')
    report(await window.electronAPI.tapeImportPaths(paths, { sermonId, link }))
    setBusy(null)
  }
  const useHit = async (h: TapeFolderHit, forSermon: number): Promise<void> => {
    setBusy(`Adding ${h.name}…`)
    report(await window.electronAPI.tapeImportConfirmed([{ path: h.path, sermonId: forSermon }]))
    setBusy(null)
  }
  const pickFolder = async (): Promise<void> => {
    const f = await window.electronAPI.tapePickFolder()
    if (f) { await scan(); setNotes([`Your “Tape audio” folder is now ${f}.`]) }
  }

  const mine = hits.filter((h) => h.match?.id === sermonId || h.candidates.some((c) => c.id === sermonId))
  const others = hits.filter((h) => !mine.includes(h))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal preflight tape-attach${dragOver ? ' is-dragover' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Add the tape for this sermon"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => void drop(e)}
      >
        <div className="modal-title-row">
          <div>
            <div className="tape-caps">Sermon {dateCode} · {sermonTitle}</div>
            <h3 className="modal-title"><Headphones width={16} height={16} aria-hidden="true" /> Add the tape for this sermon</h3>
          </div>
          <button className="btn-icon btn-sm" onClick={onClose} aria-label="Close"><X width={15} height={15} strokeWidth={2.2} /></button>
        </div>
        <div className="tape-attach-body">
          <p className="modal-hint">
            The tape plays from a <b>file on this computer</b>, so it works with no internet in the middle of a service. BORN keeps its own copy and never changes the original.
          </p>

          <div className="tape-cards">
            <div className="tape-card tape-card--main">
              <h4><FolderOpen width={15} height={15} aria-hidden="true" /> Use a file from this computer <span className="tape-tag">Recommended</span></h4>
              <p>M4A, MP3, FLAC, OGG or WAV. Drag it onto this window, or choose it.</p>
              <div className="tape-row">
                <button className="btn-primary btn-sm" onClick={() => void choose()} disabled={!!busy}><Upload width={13} height={13} aria-hidden="true" /> Choose a file…</button>
                <label className="tape-check"><input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} /> Link, don’t copy</label>
              </div>
            </div>
            <div className="tape-card">
              <h4><Globe width={15} height={15} aria-hidden="true" /> Get audio</h4>
              <TapeDownload sermon={{ id: sermonId, dateCode, title: sermonTitle }} onDone={(r) => report(r)} />
            </div>
          </div>
          <div className="tape-card tape-card--soon" aria-disabled="true">
            <h4><Zap width={15} height={15} aria-hidden="true" /> Stream it <span className="tape-tag tape-tag--quiet">Not available yet</span></h4>
            <p>Streaming needs the internet all service long and the publisher’s permission. It is listed for a later version.</p>
          </div>

          {busy && <div className="preflight-summary preflight-summary--busy" role="status">{busy}</div>}
          {notes.map((n, i) => <div key={i} className="tape-note" role="status">{n}</div>)}
          {problems.map((n, i) => <div key={i} className="tape-note tape-note--bad" role="alert">{n}</div>)}

          <div className="tape-section">
            <div className="tape-caps">Your “Tape audio” folder</div>
            <div className="tape-row">
              <span className="tape-folder">{folder ?? 'Not chosen yet — keep your recordings in one folder and BORN will find them.'}</span>
              <button className="btn-quiet btn-sm" onClick={() => void pickFolder()}>{folder ? 'Change…' : 'Choose folder…'}</button>
              {folder && <button className="btn-quiet btn-sm" onClick={() => void scan()} aria-label="Look again"><RefreshCw width={13} height={13} aria-hidden="true" /> Look again</button>}
            </div>
            {folder && hits.length === 0 && <div className="tape-empty">No audio files found in that folder yet.</div>}
            {mine.length > 0 && (
              <table className="tape-table">
                <thead><tr><th>File</th><th>Size</th><th>This sermon?</th><th /></tr></thead>
                <tbody>
                  {mine.map((h) => (
                    <tr key={h.path}>
                      <td title={h.path}>{h.name}</td>
                      <td>{mb(h.bytes)}</td>
                      <td>{h.confidence === 'exact' ? <span className="tape-ok">Matches by its date code</span> : <span className="tape-warn">Could be this one — please check</span>}</td>
                      <td>{h.imported ? <span className="tape-faint">Already added</span> : <button className="btn-primary btn-sm" onClick={() => void useHit(h, sermonId)}>Use this</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {others.length > 0 && (
              <details className="tape-others">
                <summary>{others.length} other file{others.length === 1 ? '' : 's'} in the folder</summary>
                <table className="tape-table">
                  <tbody>
                    {others.map((h) => (
                      <tr key={h.path}>
                        <td title={h.path}>{h.name}</td>
                        <td>{h.match ? <span className="tape-faint">looks like {h.match.dateCode} {h.match.title}</span> : <span className="tape-faint">no sermon recognised</span>}</td>
                        <td>{h.match && !h.imported ? <button className="btn-quiet btn-sm" onClick={() => void useHit(h, h.match!.id)}>Add to that sermon</button> : h.imported ? <span className="tape-faint">Already added</span> : <button className="btn-quiet btn-sm" onClick={() => void useHit(h, sermonId)}>Add to this sermon</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>

          {recs.length > 0 && (
            <div className="tape-section">
              <div className="tape-caps">Attached to this sermon</div>
              {recs.map((r) => {
                const p = pf[r.id]
                return (
                  <div key={r.id} className="tape-rec">
                    <div className="tape-rec-head">
                      <Headphones width={15} height={15} aria-hidden="true" />
                      <b>{r.file.name}</b>
                      <span className="tape-faint">{formatTapeTime(r.file.durationSec)} · {r.file.container.toUpperCase()} · {mb(r.file.bytes)}</span>
                      <span style={{ flex: 1 }} />
                      {confirmRemove === r.id ? (
                        <>
                          <span className="tape-faint">Remove from this sermon? The file stays in BORN.</span>
                          <button className="btn-secondary btn-sm" onClick={async () => { await window.electronAPI.tapeRemove(r.id); setConfirmRemove(null); onChanged(); void reload() }}>Remove</button>
                          <button className="btn-quiet btn-sm" onClick={() => setConfirmRemove(null)}>Keep</button>
                        </>
                      ) : (
                        <button className="btn-quiet btn-sm" onClick={() => setConfirmRemove(r.id)} aria-label={`Remove ${r.file.name} from this sermon`}><Trash2 width={13} height={13} aria-hidden="true" /> Remove</button>
                      )}
                    </div>
                    <ul className="tape-checks">
                      {p ? p.checks.map((c) => {
                        const Icon = ICON[c.level]
                        return (
                          <li key={c.id} className={`tape-check-row tape-check-row--${c.level}`}>
                            <Icon width={15} height={15} aria-hidden="true" />
                            <span><b>{c.title}</b>{c.detail ? <span className="tape-faint"> — {c.detail}</span> : null}</span>
                          </li>
                        )
                      }) : <li className="tape-faint">Checking…</li>}
                    </ul>
                    {p && p.checks.some((c) => c.id === 'sync' && c.level !== 'ok') && (
                      <div className="tape-banner">
                        <Wand2 width={16} height={16} aria-hidden="true" />
                        <span><b>The text will follow the tape.</b> BORN times each English recording by itself in the background, so you can play it right away; the text starts following when that finishes.</span>
                        {onSync && (
                          <span className="tape-row">
                            <button className="btn-primary btn-sm" onClick={() => onSync(r.id, 'tap')}><Hand width={13} height={13} aria-hidden="true" /> Tap to sync</button>
                            <button className="btn-secondary btn-sm" onClick={() => onSync(r.id, 'auto')}><Wand2 width={13} height={13} aria-hidden="true" /> Propose automatically</button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="tape-foot"><button className="btn-primary btn-sm" onClick={onClose}>Done</button></div>
      </div>
    </div>
  )
}
