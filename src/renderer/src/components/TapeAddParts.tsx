import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Headphones, FolderOpen, Download, Upload, X, ChevronDown } from 'lucide-react'
import type { TapeAddOutcome, TapeFolderHit } from '../../../shared/tape'
import { ContextMenu } from './ContextMenu'
import TapeDownload from './TapeDownload'

export interface SermonRef { id: number; dateCode: string; title: string }
export type PendingFile = TapeAddOutcome['pending'][number]
export const mb = (n: number): string => (n >= 1073741824 ? `${(n / 1073741824).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1048576))} MB`)

/** A small dialog: role="dialog" (so Esc closes it and does not also blank the screens), closes on Esc and on the backdrop. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus() // not when a field inside already took focus (autoFocus runs first)
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape' && !e.shiftKey) { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="tp-sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tp-sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

/** The one place a recording is added from: the main part opens the file picker straight away; ▾ offers the other way in. */
export function AddButton({ busy, onChoose, onDownload }: { busy: boolean; onChoose: () => void; onDownload: () => void }): JSX.Element {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  return (
    <div className="tp-addsplit">
      <button className="btn-primary btn-sm" onClick={onChoose} disabled={busy} title="Choose a file (opens in your Tape audio folder)">{busy ? 'Adding…' : '＋ Add recording…'}</button>
      <button className="btn-primary btn-sm tp-addsplit-more" aria-label="More ways to add" aria-haspopup="menu" title="More ways to add" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom + 4 }) }}><ChevronDown width={13} height={13} aria-hidden="true" /></button>
      {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={[
        { id: 'choose', label: 'Choose a file…', hint: 'or drop one here', onSelect: onChoose },
        { id: 'download', label: 'Download…', onSelect: onDownload }
      ]} />}
    </div>
  )
}

/** New files in the Tape audio folder: offered, never added silently. Reads the folder when shown, when the window is focused again, and when the main process says it changed. */
export function useFolderHits(refreshKey: unknown): { folder: string | null; hits: TapeFolderHit[]; rescan: () => Promise<void> } {
  const [folder, setFolder] = useState<string | null>(null)
  const [hits, setHits] = useState<TapeFolderHit[]>([])
  const rescan = useCallback(async (): Promise<void> => {
    try {
      const info = await window.electronAPI.tapeInfo()
      setFolder(info.folder)
      setHits(info.folder ? ((await window.electronAPI.tapeScanFolder()) as TapeFolderHit[]) : [])
    } catch { /* the folder may be on a drive that is not connected: nothing to offer */ }
  }, [])
  useEffect(() => { void rescan() }, [rescan, refreshKey])
  useEffect(() => {
    const off = window.electronAPI.onTapeFolderChanged?.(() => void rescan())
    const focus = (): void => void rescan()
    window.addEventListener('focus', focus)
    return () => { off?.(); window.removeEventListener('focus', focus) }
  }, [rescan])
  return { folder, hits, rescan }
}

export function FolderStrip({ hits, busy, onAdd }: { hits: TapeFolderHit[]; busy: boolean; onAdd: (paths: string[]) => void }): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const ready = useMemo(() => hits.filter((h) => !h.imported), [hits])
  const exact = ready.filter((h) => h.match && h.confidence === 'exact')
  if (ready.length === 0) return null
  return (
    <div className="tp-strip" role="status">
      <div className="tp-strip-row">
        <FolderOpen width={15} height={15} aria-hidden="true" />
        <span className="tp-strip-text"><b>{ready.length === 1 ? '1 new recording' : `${ready.length} new recordings`} in your Tape audio folder.</b> <span className="tp-faint">Nothing is added until you say.</span></span>
        {exact.length > 0 && <button className="btn-primary btn-sm" disabled={busy} onClick={() => onAdd(exact.map((h) => h.path))}>{exact.length === 1 ? 'Add 1 recognised' : `Add ${exact.length} recognised`}</button>}
        {(ready.length > exact.length || exact.length === 0 || ready.length > 1) && <button className="btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : ready.length === 1 ? 'See it' : 'See them'}</button>}
      </div>
      {open && (
        <ul className="tp-strip-list" aria-label="New files">
          {ready.map((h) => (
            <li key={h.path}>
              <span className="tp-strip-name" title={h.path}>{h.name} <span className="tp-faint">{mb(h.bytes)}</span></span>
              <span className={h.match && h.confidence === 'exact' ? 'tp-ok' : h.match ? 'tp-warn' : 'tp-faint'}>{h.match ? `${h.match.dateCode} ${h.match.title}${h.confidence === 'exact' ? '' : ' (please check)'}` : 'sermon unknown'}</span>
              <button className="btn-secondary btn-sm" disabled={busy} onClick={() => onAdd([h.path])}>{h.match ? 'Add' : 'Choose sermon…'}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The empty library: one drop zone with the two ways in. */
export function AddEmpty({ busy, folder, onChoose, onDownload }: { busy: boolean; folder: string | null; onChoose: () => void; onDownload: () => void }): JSX.Element {
  return (
    <div className="tp-empty">
      <div className="tp-empty-ico"><Headphones width={28} height={28} aria-hidden="true" /></div>
      <h3>Add your first recording</h3>
      <p>Drop a recording here, or choose a file. A file named with its date code (like <b>65-0418M</b>) goes to the right sermon by itself. BORN keeps its own copy and never changes your file.</p>
      <div className="tp-empty-actions">
        <button className="btn-primary" onClick={onChoose} disabled={busy}><Upload width={14} height={14} aria-hidden="true" /> {busy ? 'Adding…' : 'Choose a file…'}</button>
        <button className="btn-secondary" onClick={onDownload}><Download width={14} height={14} aria-hidden="true" /> Download…</button>
      </div>
      <p className="tp-faint">Or put files in {folder ? <b>{folder}</b> : 'your Downloads folder'} and BORN will offer them here.</p>
    </div>
  )
}

/** Files BORN could not place: one question each, their likeliest sermons as buttons. */
export function PendingSheet({ pending, sermons, preferredSermonId, onResolve, onSkip, onClose }: { pending: PendingFile[]; sermons: SermonRef[]; preferredSermonId: number | null; onResolve: (f: PendingFile, id: number) => void; onSkip: (f: PendingFile) => void; onClose: () => void }): JSX.Element {
  return (
    <Sheet title={pending.length === 1 ? 'Which sermon is this file for?' : 'Which sermon are these files for?'} onClose={onClose}>
      {pending.map((f) => <PendingRow key={f.path} file={f} sermons={sermons} preferredSermonId={preferredSermonId} onResolve={onResolve} onSkip={onSkip} />)}
      <div className="tp-sheet-actions"><button className="btn-quiet" onClick={onClose}>Not now</button></div>
    </Sheet>
  )
}

function useSermonSearch(sermons: SermonRef[], q: string): SermonRef[] {
  return useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 1) return []
    return sermons.filter((x) => x.title.toLowerCase().includes(s) || x.dateCode.toLowerCase().includes(s.replace(/\s+/g, ''))).slice(0, 8)
  }, [q, sermons])
}

function PendingRow({ file, sermons, preferredSermonId, onResolve, onSkip }: { file: PendingFile; sermons: SermonRef[]; preferredSermonId: number | null; onResolve: (f: PendingFile, id: number) => void; onSkip: (f: PendingFile) => void }): JSX.Element {
  const [q, setQ] = useState('')
  const found = useSermonSearch(sermons, q)
  const pref = preferredSermonId != null ? sermons.find((s) => s.id === preferredSermonId) : undefined
  const choices = file.candidates.length ? file.candidates : pref ? [pref] : []
  return (
    <div className="tpa-pending-row">
      <div className="tpa-pending-file"><b title={file.path}>{file.name}</b> <span className="tp-faint">{mb(file.bytes)}</span><button className="btn-quiet btn-sm" onClick={() => onSkip(file)} aria-label={`Skip ${file.name}`}><X width={12} height={12} aria-hidden="true" /></button></div>
      {choices.length > 0 && <div className="tpa-choices">{choices.map((c) => <button key={c.id} className="btn-secondary btn-sm" onClick={() => onResolve(file, c.id)}>{c.dateCode} · {c.title}</button>)}</div>}
      <input className="tp-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Or type a title or a date code, e.g. 65-0418M" aria-label={`Find the sermon for ${file.name}`} />
      {found.length > 0 && <ul className="tpa-list" aria-label="Matching sermons">{found.map((s) => <li key={s.id}><button onClick={() => onResolve(file, s.id)}><b>{s.dateCode}</b> {s.title}</button></li>)}</ul>}
    </div>
  )
}

/** Download from the publisher: one field, one button (the download itself is unchanged: on the click, one file, English). */
export function DownloadDialog({ sermons, preferredSermonId, onClose, onDone }: { sermons: SermonRef[]; preferredSermonId: number | null; onClose: () => void; onDone: Parameters<typeof TapeDownload>[0]['onDone'] }): JSX.Element {
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<SermonRef | null>(null)
  useEffect(() => { if (preferredSermonId != null && !chosen) { const s = sermons.find((x) => x.id === preferredSermonId); if (s) setChosen(s) } }, [preferredSermonId, sermons, chosen])
  const matches = useSermonSearch(sermons, q)
  return (
    <Sheet title="Download" onClose={onClose}>
      <div className="tpa-pick">
        <input className="tp-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); setChosen(matches[0]); setQ('') } }} placeholder="Type a title or a date code, e.g. 65-0418M" aria-label="Find the sermon to download" />
        {chosen && <span className="tp-chip tp-chip--ok">{chosen.dateCode} · {chosen.title}</span>}
      </div>
      {matches.length > 0 && <ul className="tpa-list" aria-label="Matching sermons">{matches.map((s) => <li key={s.id}><button onClick={() => { setChosen(s); setQ('') }}><b>{s.dateCode}</b> {s.title}</button></li>)}</ul>}
      {q.trim() && matches.length === 0 && <p className="tp-faint" role="status">No sermon matches “{q.trim()}”. Try part of the title, or the date code like 65-0418M.</p>}
      {!q.trim() && !chosen && <p className="tp-faint">Start typing — matching sermons appear here. Press Enter to choose the first one.</p>}
      <TapeDownload sermon={chosen} onDone={onDone} />
      <div className="tp-sheet-actions"><button className="btn-quiet" onClick={onClose}>Close</button></div>
    </Sheet>
  )
}

/** The Tape audio folder, as a setting (Options). */
export function FolderSetting(): JSX.Element {
  const [folder, setFolder] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => { void Promise.resolve(window.electronAPI.tapeInfo?.()).then((i) => setFolder(i?.folder ?? null)) }, [])
  const change = async (): Promise<void> => {
    const f = await window.electronAPI.tapePickFolder()
    if (f) { setFolder(f); setNote(`Your “Tape audio” folder is now ${f}.`) }
  }
  return (
    <section className="tp-folder-setting">
      <h3>Tape audio folder</h3>
      <div className="tsp-row">
        <span className="tsp-label tpa-folder" title={folder ?? undefined}>{folder ?? 'Using your Downloads folder until you choose another'} <span className="tp-faint">· BORN looks here by itself and offers new recordings; it never adds one without you.</span></span>
        <span className="tpa-actions">
          <button className="btn-secondary btn-sm" onClick={() => void change()}>{folder ? 'Change…' : 'Choose a folder…'}</button>
          {folder && <button className="btn-quiet btn-sm" onClick={() => void window.electronAPI.tapeOpenFolder?.()}>Open folder</button>}
        </span>
      </div>
      {note && <p className="tp-faint" role="status">{note}</p>}
    </section>
  )
}
