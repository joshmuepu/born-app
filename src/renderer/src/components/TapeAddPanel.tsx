import { useCallback, useEffect, useMemo, useState } from 'react'
import { Headphones, FolderOpen, Globe, RefreshCw, Check, Upload, X } from 'lucide-react'
import type { TapeAddOutcome, TapeFolderHit } from '../../../shared/tape'
import TapeDownload from './TapeDownload'

export interface SermonRef { id: number; dateCode: string; title: string }
export type PendingFile = TapeAddOutcome['pending'][number]
const mb = (n: number): string => (n >= 1073741824 ? `${(n / 1073741824).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1048576))} MB`)

/**
 * Add a recording (the Tape place's Add tab). One click on "Add a recording…" opens the file picker IN your Tape audio folder; a file whose name says which
 * sermon it is (65-0418M …) is added at once and the Tape place lands on it. Only a file BORN cannot place waits here, for one click. Below: what is already
 * in the Tape audio folder, and — if you do not have the file — downloading it from the publisher.
 */
export default function TapeAddPanel({
  busy,
  message,
  problems,
  pending,
  onAdd,
  onDropPaths,
  onResolve,
  onSkip,
  onChanged,
  preferredSermonId
}: {
  busy: boolean
  message: string | null
  problems: string[]
  pending: PendingFile[]
  onAdd: () => void
  onDropPaths: (paths: string[]) => void
  onResolve: (file: PendingFile, sermonId: number) => void
  onSkip: (file: PendingFile) => void
  onChanged: () => void
  preferredSermonId?: number | null
}): JSX.Element {
  const [sermons, setSermons] = useState<SermonRef[]>([])
  const [folder, setFolder] = useState<string | null>(null)
  const [hits, setHits] = useState<TapeFolderHit[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [folderMsg, setFolderMsg] = useState<string | null>(null)

  useEffect(() => { void Promise.resolve(window.electronAPI.tapeSermonList?.()).then((l) => setSermons(l ?? [])) }, [])
  const scan = useCallback(async (): Promise<TapeFolderHit[]> => {
    const info = await window.electronAPI.tapeInfo()
    setFolder(info.folder)
    const found = info.folder ? ((await window.electronAPI.tapeScanFolder()) as TapeFolderHit[]) : []
    setHits(found)
    return found
  }, [])
  const [looking, setLooking] = useState(false)
  /** "Look again": read the folder once more (files you put there since) and SAY what it found — a list that looks the same must not look like nothing happened. */
  const lookAgain = async (): Promise<void> => {
    setLooking(true); setFolderMsg(null)
    const found = await scan()
    await new Promise((r) => setTimeout(r, 300))
    const fresh = found.filter((h) => !h.imported).length
    setFolderMsg(found.length === 0 ? 'Looked again: no audio files in that folder.' : `Looked again: ${found.length} audio file${found.length === 1 ? '' : 's'} in the folder, ${fresh === 0 ? 'all already added' : `${fresh} not added yet`}.`)
    setLooking(false)
  }
  useEffect(() => { void scan() }, [scan, message])

  const pickFolder = async (): Promise<void> => {
    const f = await window.electronAPI.tapePickFolder()
    if (f) { await scan(); setFolderMsg(`Your “Tape audio” folder is now ${f}.`) }
  }
  const ready = useMemo(() => hits.filter((h) => !h.imported), [hits])
  const exact = ready.filter((h) => h.match && h.confidence === 'exact')

  return (
    <div
      className={`tpa${dragOver ? ' is-dragover' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const paths = window.electronAPI.tapePathsForFiles(Array.from(e.dataTransfer.files)); if (paths.length) onDropPaths(paths) }}
    >
      <section className="tp-card tpa-main">
        <h4><Headphones width={15} height={15} aria-hidden="true" /> Add a recording</h4>
        <div className="tpa-actions">
          <button className="btn-primary" onClick={onAdd} disabled={busy}><Upload width={14} height={14} aria-hidden="true" /> {busy ? 'Adding…' : 'Add a recording…'}</button>
          <span className="tp-faint">or drop the file anywhere on this page</span>
        </div>
        <p className="tp-faint">The file picker opens in {folder ? 'your Tape audio folder' : 'your Downloads folder'}. A file named with its date code (like <b>65-0418M</b>) goes to the right sermon by itself and shows in the list on the left. BORN keeps its own copy and never changes your file.</p>
        {message && <p role="status" className="tpa-ok"><Check width={13} height={13} aria-hidden="true" /> {message}</p>}
        {problems.map((p, i) => <p key={i} role="alert" className="tp-warn">{p}</p>)}
      </section>

      {pending.length > 0 && (
        <section className="tp-card tpa-pending" aria-label="Which sermon is it?">
          <h4>Which sermon {pending.length === 1 ? 'is this file' : 'are these files'} for?</h4>
          {pending.map((f) => <PendingRow key={f.path} file={f} sermons={sermons} preferredSermonId={preferredSermonId ?? null} onResolve={onResolve} onSkip={onSkip} />)}
        </section>
      )}

      <section className="tp-card">
        <h4><FolderOpen width={15} height={15} aria-hidden="true" /> In your “Tape audio” folder</h4>
        <div className="tpa-actions">
          <span className="tp-faint tpa-folder">{folder ?? 'Using your Downloads folder until you choose another — pick the folder where you keep recordings and BORN will find them.'}</span>
          <button className="btn-secondary btn-sm" onClick={() => void pickFolder()}>{folder ? 'Change…' : 'Choose a folder…'}</button>
          {folder && <button className="btn-quiet btn-sm" onClick={() => void lookAgain()} disabled={looking} title="Read the Tape audio folder again, for files you have put there since"><RefreshCw width={12} height={12} aria-hidden="true" className={looking ? 'tpa-spin' : undefined} /> {looking ? 'Looking…' : 'Look again'}</button>}
        </div>
        {folderMsg && <p className="tp-faint" role="status">{folderMsg}</p>}
        {folder && ready.length === 0 && <p className="tp-faint">{hits.length ? 'Everything in that folder is already added.' : 'No audio files found in that folder yet.'}</p>}
        {exact.length > 1 && <div className="tpa-actions"><button className="btn-primary btn-sm" disabled={busy} onClick={() => onDropPaths(exact.map((h) => h.path))}>Add all {exact.length} that match a sermon</button></div>}
        {ready.length > 0 && (
          <table className="tp-table">
            <thead><tr><th>File</th><th>Size</th><th>Looks like</th><th /></tr></thead>
            <tbody>
              {ready.map((h) => (
                <tr key={h.path}>
                  <td title={h.path}>{h.name}</td>
                  <td>{mb(h.bytes)}</td>
                  <td>{h.match ? <span className={h.confidence === 'exact' ? 'tp-ok' : 'tp-warn'}>{h.match.dateCode} {h.match.title}{h.confidence === 'exact' ? '' : ' (please check)'}</span> : <span className="tp-faint">no sermon recognised</span>}</td>
                  <td><button className="btn-secondary btn-sm" disabled={busy} onClick={() => onDropPaths([h.path])}>Add</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="tp-card">
        <h4><Globe width={15} height={15} aria-hidden="true" /> Don’t have the file? Get audio</h4>
        <DownloadPicker sermons={sermons} preferredSermonId={preferredSermonId ?? null} onDone={onChanged} />
      </section>
    </div>
  )
}

/** One file BORN could not place: its likeliest sermons are one click each; or find the sermon by title or date code. */
function PendingRow({ file, sermons, preferredSermonId, onResolve, onSkip }: { file: PendingFile; sermons: SermonRef[]; preferredSermonId: number | null; onResolve: (f: PendingFile, id: number) => void; onSkip: (f: PendingFile) => void }): JSX.Element {
  const [q, setQ] = useState('')
  const found = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    return sermons.filter((x) => x.title.toLowerCase().includes(s) || x.dateCode.toLowerCase().includes(s.replace(/\s+/g, ''))).slice(0, 6)
  }, [q, sermons])
  const pref = preferredSermonId != null ? sermons.find((s) => s.id === preferredSermonId) : undefined
  const choices = file.candidates.length ? file.candidates : pref ? [pref] : []
  return (
    <div className="tpa-pending-row">
      <div className="tpa-pending-file"><b title={file.path}>{file.name}</b> <span className="tp-faint">{mb(file.bytes)}</span><button className="btn-quiet btn-sm" onClick={() => onSkip(file)} aria-label={`Skip ${file.name}`}><X width={12} height={12} aria-hidden="true" /></button></div>
      {choices.length > 0 && <div className="tpa-choices">{choices.map((c) => <button key={c.id} className="btn-secondary btn-sm" onClick={() => onResolve(file, c.id)}>{c.dateCode} · {c.title}</button>)}</div>}
      <input className="tp-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find the sermon: a title or a date code, e.g. 65-0418M" aria-label={`Find the sermon for ${file.name}`} />
      {found.length > 0 && <ul className="tpa-list" aria-label="Matching sermons">{found.map((s) => <li key={s.id}><button onClick={() => onResolve(file, s.id)}><b>{s.dateCode}</b> {s.title}</button></li>)}</ul>}
    </div>
  )
}

function DownloadPicker({ sermons, preferredSermonId, onDone }: { sermons: SermonRef[]; preferredSermonId: number | null; onDone: () => void }): JSX.Element {
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<SermonRef | null>(null)
  useEffect(() => { if (preferredSermonId != null && !chosen) { const s = sermons.find((x) => x.id === preferredSermonId); if (s) setChosen(s) } }, [preferredSermonId, sermons, chosen])
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    return sermons.filter((x) => x.title.toLowerCase().includes(s) || x.dateCode.toLowerCase().includes(s.replace(/\s+/g, ''))).slice(0, 6)
  }, [q, sermons])
  return (
    <div>
      <div className="tpa-pick">
        <input className="tp-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a title or a date code, e.g. 65-0418M" aria-label="Find the sermon to download" />
        {chosen && <span className="tp-chip tp-chip--ok"><Check width={12} height={12} aria-hidden="true" /> {chosen.dateCode} · {chosen.title}</span>}
      </div>
      {matches.length > 0 && <ul className="tpa-list" aria-label="Matching sermons">{matches.map((s) => <li key={s.id}><button onClick={() => { setChosen(s); setQ('') }}><b>{s.dateCode}</b> {s.title}</button></li>)}</ul>}
      <TapeDownload sermon={chosen} onDone={onDone} />
    </div>
  )
}
