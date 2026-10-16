import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image as ImageIcon,
  Star,
  FolderPlus,
  Folder,
  Upload,
  FolderOpen,
  Search,
  Link2,
  Unplug,
  AlertTriangle,
  Tag as TagIcon,
  Clock,
  Plus,
  Trash2,
  X,
  Film,
  Play,
  Layers,
  FileText,
  Globe
} from 'lucide-react'
import MediaBackgrounds, { useBackgroundTargets } from './MediaBackgrounds'
import DrillShell, { ViewToggle, useBrowseView, useBackslashToggle } from './DrillShell'
import VirtualList from './VirtualList'
import { driveRootOf, driveLabel } from '../../../shared/driveRoot'
import { formatClock } from '../../../shared/videoPlayback'
import { useContextMenu, type MenuItem } from './ContextMenu'
import type { ToastSpec } from './Toasts'
import { useAppActions } from '../AppActions'
import { startQueueDrag } from '../dragItem'
import type { MediaFolder, MediaImportResult, MediaRecord, MediaStatus } from '../../../shared/media'
import { MEDIA_LIMITS } from '../../../shared/media'
import { importPdf, PDF_MESSAGES } from '../pdfImport'
import './MediaPanel.css'

type Category =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'attention' }
  | { kind: 'videos' }
  | { kind: 'backgrounds' }
  | { kind: 'folder'; id: string }
  | { kind: 'tag'; tag: string }

const sameCat = (a: Category, b: Category): boolean =>
  a.kind === b.kind && (a as { id?: string }).id === (b as { id?: string }).id && (a as { tag?: string }).tag === (b as { tag?: string }).tag

export const mediaThumbUrl = (id: string, w: 320 | 960 = 320): string => `born-media://thumb/${id}/${w}`
export const mediaFileUrl = (id: string): string => `born-media://file/${id}`

function fmtBytes(n: number): string {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`
  if (n >= 1048576) return `${(n / 1048576).toFixed(n >= 10485760 ? 0 : 1)} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}
const fmtDate = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
/** Which drive a linked picture lives on, judged from how its path is written (works on any computer's paths). */
const rootOfLinked = (p: string | null): string | null => (p ? driveRootOf(p, 'win32') ?? driveRootOf(p, 'darwin') ?? driveRootOf(p, 'linux') : null)
const STATUS_TEXT: Record<Exclude<MediaStatus, 'ok'>, string> = {
  offline: 'Drive not connected',
  missing: 'File missing',
  changed: 'File changed',
  unreadable: "Can't read file"
}

interface Props {
  visible: boolean
  onAddToQueue: (items: MediaRecord[]) => void
  /** Open the "Add a YouTube video" dialog. */
  onAddYouTube?: () => void
  onAddSlideshow: (items: MediaRecord[]) => void
  pushToast: (t: ToastSpec) => void
  /** Open this item in the right pane (from the palette or the queue). */
  focusId?: string | null
  onFocused?: () => void
}

export default function MediaPanel({ visible, onAddToQueue, onAddYouTube, onAddSlideshow, pushToast, focusId, onFocused }: Props): JSX.Element {
  const actions = useAppActions()
  const [view, setView] = useBrowseView()
  const [collapsed, setCollapsed] = useState(false)
  const [items, setItems] = useState<MediaRecord[]>([])
  const [folders, setFolders] = useState<MediaFolder[]>([])
  const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([])
  const [status, setStatus] = useState<Map<string, MediaStatus>>(new Map())
  const [cat, setCat] = useState<Category>({ kind: 'all' })
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sort, setSort] = useState<'added' | 'name' | 'recent'>('added')
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [available, setAvailable] = useState<{ ok: boolean; message?: string | null }>({ ok: true })
  const [linkInPlace, setLinkInPlace] = useState<boolean>(() => {
    try { return localStorage.getItem('born.media.link') === '1' } catch { return false }
  })
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [report, setReport] = useState<{ added: number; dup: number; failed: Array<{ name: string; message: string }>; warnings: string[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [folderEdit, setFolderEdit] = useState<{ id: string | null; name: string } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  /** Every picture seen so far, so ticked pictures stay usable after the search or view changes. */
  const seen = useRef<Map<string, MediaRecord>>(new Map())
  const [pdfJob, setPdfJob] = useState<{ name: string; page: number; total: number } | null>(null)
  const pdfAbort = useRef<AbortController | null>(null)
  const [cols, setCols] = useState(4)
  const menu = useContextMenu()
  const folderMenu = useContextMenu()
  useBackslashToggle(visible, () => setCollapsed((c) => !c))

  // ── data ──────────────────────────────────────────────────────────────────
  const seq = useRef(0)
  const refresh = useCallback(async () => {
    const mine = ++seq.current
    const api = window.electronAPI
    try {
      const info = await api.mediaInfo()
      if (mine !== seq.current) return
      setAvailable({ ok: info.available, message: info.message })
      if (!info.available) { setItems([]); setLoaded(true); return }
      const [list, fl, tg, att] = await Promise.all([
        api.mediaList({ search: debounced || undefined, sort: sort === 'recent' ? 'recent' : sort === 'name' ? 'name' : 'added', limit: 20000 }),
        api.mediaFolders(),
        api.mediaTags(),
        api.mediaCheckAll()
      ])
      if (mine !== seq.current) return
      list.forEach((r) => seen.current.set(r.id, r))
      setItems(list)
      setFolders(fl)
      setTags(tg)
      setStatus(new Map(att.map((a) => [a.id, a.status])))
      setLoaded(true)
    } catch {
      if (mine === seq.current) { setAvailable({ ok: false, message: "BORN's media library could not be opened." }); setLoaded(true) }
    }
  }, [debounced, sort])

  useEffect(() => { const t = window.setTimeout(() => setDebounced(search.trim()), 150); return () => window.clearTimeout(t) }, [search])
  useEffect(() => { if (visible) void refresh() }, [visible, refresh])
  useEffect(() => window.electronAPI.onMediaImportProgress((p) => setProgress({ done: p.done, total: p.total })), [])
  useEffect(() => { try { localStorage.setItem('born.media.link', linkInPlace ? '1' : '0') } catch { /* ignore */ } }, [linkInPlace])
  useEffect(() => {
    if (!focusId) return
    setCat({ kind: 'all' })
    setSearch('')
    setSelected(focusId)
    onFocused?.()
  }, [focusId, onFocused])

  // ── what is shown ─────────────────────────────────────────────────────────
  const shown = useMemo(() => {
    let l = items
    if (cat.kind === 'favorites') l = l.filter((i) => i.favorite)
    else if (cat.kind === 'recent') l = l.filter((i) => i.lastUsedAt).sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
    else if (cat.kind === 'attention') l = l.filter((i) => status.has(i.id))
    else if (cat.kind === 'videos') l = l.filter((i) => i.type === 'video')
    else if (cat.kind === 'folder') l = l.filter((i) => i.folderId === cat.id)
    else if (cat.kind === 'tag') l = l.filter((i) => i.tags.includes(cat.tag))
    return l
  }, [items, cat, status])

  const current = useMemo(() => items.find((i) => i.id === selected) ?? null, [items, selected])
  const attentionCount = status.size

  // grid columns follow the pane width
  useEffect(() => {
    const el = gridRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setCols(Math.max(1, Math.floor((el.clientWidth - 12) / 176))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [view, visible])

  // ── actions ───────────────────────────────────────────────────────────────
  const summarize = useCallback(
    (results: MediaImportResult[]) => {
      const okItems = results.filter((r): r is Extract<MediaImportResult, { ok: true }> => r.ok)
      const added = okItems.filter((r) => !r.duplicate || r.restored)
      const failed = results.filter((r): r is Extract<MediaImportResult, { ok: false }> => !r.ok).map((r) => ({ name: r.path.split(/[\\/]/).pop() ?? r.path, message: r.message }))
      const warnings = Array.from(new Set(okItems.flatMap((r) => r.warnings)))
      setReport({ added: added.length, dup: okItems.length - added.length, failed, warnings })
      if (added.length > 0) {
        const ids = added.map((r) => r.item.id)
        setSelected(ids[ids.length - 1])
        pushToast({
          message: `Added ${added.length} picture${added.length === 1 ? '' : 's'} to the library`,
          actionLabel: 'Undo',
          onAction: () => { void window.electronAPI.mediaRemove(ids).then(() => refresh()) }
        })
      }
      void refresh()
    },
    [pushToast, refresh]
  )

  const importPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return
      setProgress({ done: 0, total: paths.length })
      try {
        const r = await window.electronAPI.mediaImportPaths(paths, { linkInPlace, folderId: cat.kind === 'folder' ? cat.id : null })
        summarize(r.results)
      } finally {
        setProgress(null)
      }
    },
    [linkInPlace, cat, summarize]
  )

  const pick = useCallback(
    async (folders: boolean) => {
      setProgress({ done: 0, total: 1 })
      try {
        const r = await window.electronAPI.mediaPickAndImport({ linkInPlace, folderId: cat.kind === 'folder' ? cat.id : null, folders })
        if (!r.canceled) summarize(r.results)
      } finally {
        setProgress(null)
      }
    },
    [linkInPlace, cat, summarize]
  )

  const offlineItems = useMemo(() => items.filter((i) => status.get(i.id) === 'offline'), [items, status])
  const offlineCount = offlineItems.length
  const offlineDrives = useMemo(() => [...new Set(offlineItems.map((i) => rootOfLinked(i.linkPath)).filter((x): x is string => !!x))], [offlineItems])
  const reconnectAll = useCallback(async () => {
    const x = await window.electronAPI.mediaReconnectLinked()
    if (x.canceled) return
    pushToast({ message: x.relinked ? `Reconnected ${x.relinked} picture${x.relinked === 1 ? '' : 's'}${x.stillMissing ? `; ${x.stillMissing} still not found` : ''}.` : 'None of the missing pictures were in that folder.' })
    void refresh()
  }, [pushToast, refresh])

  const runPdf = useCallback(async (name: string, bytes: ArrayBuffer | undefined, error?: string) => {
    if (error === 'too-large' || !bytes) {
      setReport({ added: 0, dup: 0, failed: [{ name, message: error === 'too-large' ? PDF_MESSAGES['too-large'] : PDF_MESSAGES.io }], warnings: [] })
      return
    }
    const ac = new AbortController()
    pdfAbort.current = ac
    setPdfJob({ name, page: 0, total: 0 })
    try {
      const api = window.electronAPI
      const out = await importPdf(
        bytes,
        name,
        {
          importBuffer: (n, b, o) => api.mediaImportBuffer(n, b, o),
          remove: (ids) => api.mediaRemove(ids).then(() => api.mediaPurgeNow()),
          createFolder: (n) => api.mediaFolderCreate(n)
        },
        { signal: ac.signal, onProgress: (p) => setPdfJob({ name, page: p.page, total: p.total }) }
      )
      if (!out.ok) {
        setReport({ added: 0, dup: 0, failed: out.code === 'cancelled' ? [] : [{ name, message: out.message }], warnings: out.code === 'cancelled' ? [out.message] : [] })
      } else {
        const recs = (await Promise.all(out.mediaIds.map((id) => api.mediaGet(id)))).filter((r): r is MediaRecord => !!r)
        setReport({ added: out.added, dup: out.reused, failed: [], warnings: [`“${out.name}”: ${recs.length} page${recs.length === 1 ? '' : 's'} are now a slideshow in the queue.`, ...out.warnings] })
        onAddSlideshow(recs)
      }
    } catch {
      setReport({ added: 0, dup: 0, failed: [{ name, message: PDF_MESSAGES.io }], warnings: [] })
    } finally {
      pdfAbort.current = null
      setPdfJob(null)
      void refresh()
    }
  }, [onAddSlideshow, refresh])

  const importPdfFile = useCallback(async () => {
    if (pdfJob) return
    const picked = await window.electronAPI.mediaPickPdf()
    if (picked.canceled) return
    await runPdf(picked.name ?? 'PDF', picked.bytes, picked.error)
  }, [pdfJob, runPdf])

  const remove = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      await window.electronAPI.mediaRemove(ids)
      setChecked(new Set())
      if (selected && ids.includes(selected)) setSelected(null)
      void refresh()
      pushToast({
        message: ids.length === 1 ? 'Removed from the library' : `Removed ${ids.length} pictures from the library`,
        actionLabel: 'Undo',
        onAction: () => { void window.electronAPI.mediaRestore(ids).then(() => refresh()) }
      })
    },
    [selected, refresh, pushToast]
  )

  const toggleFav = useCallback(async (r: MediaRecord) => { await window.electronAPI.mediaFavorite(r.id, !r.favorite); void refresh() }, [refresh])
  const addToQueue = useCallback(
    (list: MediaRecord[]) => {
      const ok = list.filter((r) => !status.has(r.id))
      if (ok.length < list.length) actions.notify(list.length === 1 ? "That picture's file is missing — fix it first" : 'Some pictures are missing and were not added')
      if (ok.length > 0) onAddToQueue(ok)
    },
    [status, onAddToQueue, actions]
  )
  /** The ticked pictures in the order they were ticked (the order of a slideshow). */
  const orderedChecked = useCallback((): MediaRecord[] => [...checked].map((id) => seen.current.get(id) ?? items.find((i) => i.id === id)).filter((x): x is MediaRecord => !!x), [checked, items])
  const targets = useCallback((r: MediaRecord): MediaRecord[] => (checked.has(r.id) ? orderedChecked() : [r]), [checked, items])

  const itemMenu = (r: MediaRecord): MenuItem[] => {
    const t = targets(r)
    const st = status.get(r.id)
    return [
      { id: 'queue', label: t.length > 1 ? `Add ${t.length} to queue` : 'Add to queue', hint: 'Q', onSelect: () => addToQueue(t) },
      { id: 'fav', label: r.favorite ? 'Remove from favorites' : 'Add to favorites', separatorBefore: true, onSelect: () => void toggleFav(r) },
      { id: 'rename', label: 'Rename…', onSelect: () => { setSelected(r.id); setRenaming(r.id) } },
      { id: 'reveal', label: 'Show in folder', onSelect: () => void window.electronAPI.mediaReveal(r.id) },
      ...(st ? [{ id: 'relink', label: 'Find the file…', onSelect: () => void window.electronAPI.mediaRelinkPick(r.id).then((x) => { if (x.ok) { actions.notify('Picture relinked'); void refresh() } else if (!x.canceled) actions.notify(x.message ?? "Couldn't relink") }) }] : []),
      { id: 'remove', label: t.length > 1 ? `Remove ${t.length} from library` : 'Remove from library', danger: true, separatorBefore: true, onSelect: () => void remove(t.map((i) => i.id)) }
    ]
  }

  // keyboard on the list
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!current) return
    const t = e.target as HTMLElement
    if (/^(input|textarea|select)$/i.test(t.tagName)) return
    const idx = shown.findIndex((i) => i.id === current.id)
    const move = (to: number): void => { const n = shown[Math.max(0, Math.min(shown.length - 1, to))]; if (n) { setSelected(n.id); e.preventDefault() } }
    if (e.key === 'ArrowRight') move(idx + 1)
    else if (e.key === 'ArrowLeft') move(idx - 1)
    else if (e.key === 'ArrowDown') move(idx + (view === 'grid' ? cols : 1))
    else if (e.key === 'ArrowUp') move(idx - (view === 'grid' ? cols : 1))
    else if (e.key.toLowerCase() === 'q' && !e.ctrlKey && !e.metaKey) { addToQueue(targets(current)); e.preventDefault() }
    else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) { void toggleFav(current); e.preventDefault() }
    else if (e.key === 'Delete' || e.key === 'Backspace') { void remove(targets(current).map((i) => i.id)); e.preventDefault() }
  }

  // drop files / paste a picture
  const onDrop = (e: React.DragEvent): void => {
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    // A dropped PDF (e.g. a PowerPoint exported to PDF) becomes a slideshow, same as "Import PDF".
    const pdf = files.find((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
    const rest = files.filter((f) => f !== pdf)
    if (rest.length > 0) void importPaths(window.electronAPI.mediaPathsForFiles(rest))
    if (pdf && !pdfJob) {
      if (pdf.size > 200 * 1024 * 1024) void runPdf(pdf.name, undefined, 'too-large')
      else void pdf.arrayBuffer().then((b) => runPdf(pdf.name, b), () => runPdf(pdf.name, undefined, 'io'))
    }
  }
  useEffect(() => {
    if (!visible) return
    const onPaste = async (e: ClipboardEvent): Promise<void> => {
      const t = e.target as HTMLElement | null
      if (t && /^(input|textarea)$/i.test(t.tagName)) return
      const f = Array.from(e.clipboardData?.files ?? []).filter((x) => x.type.startsWith('image/'))
      if (f.length === 0) return
      e.preventDefault()
      setProgress({ done: 0, total: f.length })
      const results: MediaImportResult[] = []
      for (const file of f) results.push(await window.electronAPI.mediaImportBuffer(file.name || 'Pasted picture.png', await file.arrayBuffer(), { linkInPlace: false, folderId: cat.kind === 'folder' ? cat.id : null }))
      setProgress(null)
      summarize(results)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [visible, cat, summarize])

  // ── folders ───────────────────────────────────────────────────────────────
  const commitFolder = async (): Promise<void> => {
    if (!folderEdit) return
    const n = folderEdit.name.trim()
    if (n) {
      if (folderEdit.id) await window.electronAPI.mediaFolderRename(folderEdit.id, n)
      else {
        const f = await window.electronAPI.mediaFolderCreate(n)
        if (f) setCat({ kind: 'folder', id: f.id })
      }
    }
    setFolderEdit(null)
    void refresh()
  }
  const folderMenuItems = (f: MediaFolder): MenuItem[] => [
    { id: 'rename', label: 'Rename folder…', onSelect: () => setFolderEdit({ id: f.id, name: f.name }) },
    {
      id: 'delete',
      label: 'Delete folder (pictures are kept)',
      danger: true,
      separatorBefore: true,
      onSelect: async () => {
        await window.electronAPI.mediaFolderDelete(f.id)
        if (cat.kind === 'folder' && cat.id === f.id) setCat({ kind: 'all' })
        void refresh()
      }
    }
  ]
  const dropOnCategory = (e: React.DragEvent, folderId: string | null): void => {
    const id = e.dataTransfer.getData('application/x-born-media-id')
    if (!id) return
    e.preventDefault()
    void window.electronAPI.mediaMove([id], folderId).then(() => refresh())
  }

  // ── pieces ────────────────────────────────────────────────────────────────
  const catBtn = (c: Category, icon: JSX.Element, label: string, count?: number): JSX.Element => (
    <button
      key={label + ((c as { id?: string }).id ?? (c as { tag?: string }).tag ?? '')}
      className={`media-cat${sameCat(cat, c) ? ' active' : ''}`}
      onClick={() => setCat(c)}
      onDragOver={(e) => { if (c.kind === 'folder' || c.kind === 'all') e.preventDefault() }}
      onDrop={(e) => dropOnCategory(e, c.kind === 'folder' ? c.id : c.kind === 'all' ? null : (undefined as never))}
      aria-current={sameCat(cat, c) ? 'true' : undefined}
    >
      {icon}
      <span className="media-cat-label">{label}</span>
      {count !== undefined && <span className="media-cat-count">{count}</span>}
    </button>
  )

  const renderCard = (r: MediaRecord): JSX.Element => {
    const st = status.get(r.id)
    const isSel = selected === r.id
    const bind = menu.bind(() => itemMenu(r))
    return (
      <div
        key={r.id}
        data-media-id={r.id}
        className={`media-card${isSel ? ' selected' : ''}${checked.has(r.id) ? ' checked' : ''}${st ? ' has-problem' : ''}`}
        role="option"
        aria-selected={isSel}
        tabIndex={isSel ? 0 : -1}
        draggable
        onDragStart={(e) => { startQueueDrag(e, { type: 'media', mediaId: r.id }); e.dataTransfer.setData('application/x-born-media-id', r.id); e.dataTransfer.effectAllowed = 'copyMove' }}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey) setChecked((c) => { const n = new Set(c); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })
          else { setSelected(r.id); setChecked(new Set()) }
        }}
        onDoubleClick={() => addToQueue([r])}
        {...bind}
      >
        <div className="media-thumb">
          <img src={mediaThumbUrl(r.id)} alt="" loading="lazy" draggable={false} />
          {st && <span className="media-badge media-badge--warn" title={STATUS_TEXT[st as Exclude<MediaStatus, 'ok'>]}><AlertTriangle size={12} /> {STATUS_TEXT[st as Exclude<MediaStatus, 'ok'>]}</span>}
          {r.favorite && <span className="media-badge media-badge--fav" title="Favorite"><Star size={12} fill="currentColor" /></span>}
          {r.storage === 'linked' && <span className="media-badge media-badge--link" title="Linked: the original stays where it is"><Link2 size={12} /></span>}
          {r.animated && <span className="media-badge media-badge--anim" title="Animated"><Film size={12} /></span>}
          {r.type === 'video' && <span className="media-badge media-badge--video" title="Video"><Play size={11} fill="currentColor" /> {formatClock(r.durationSec)}</span>}
        </div>
        <div className="media-card-name" title={r.name}>{r.name}</div>
        <div className="media-card-meta">{r.width}×{r.height}{r.type === 'video' ? ` · ${formatClock(r.durationSec)}` : ''} · {fmtBytes(r.bytes)}</div>
      </div>
    )
  }

  const renderRow = (r: MediaRecord): JSX.Element => {
    const st = status.get(r.id)
    const isSel = selected === r.id
    const bind = menu.bind(() => itemMenu(r))
    return (
      <div
        key={r.id}
        data-media-id={r.id}
        className={`media-row${isSel ? ' selected' : ''}${st ? ' has-problem' : ''}`}
        role="option"
        aria-selected={isSel}
        tabIndex={isSel ? 0 : -1}
        draggable
        onDragStart={(e) => { startQueueDrag(e, { type: 'media', mediaId: r.id }); e.dataTransfer.setData('application/x-born-media-id', r.id) }}
        onClick={() => { setSelected(r.id); setChecked(new Set()) }}
        onDoubleClick={() => addToQueue([r])}
        {...bind}
      >
        <img src={mediaThumbUrl(r.id)} alt="" loading="lazy" draggable={false} />
        <span className="media-row-name">{r.name}{r.favorite && <Star size={12} fill="currentColor" className="media-row-fav" />}</span>
        <span className="media-row-dim">{r.width}×{r.height}{r.type === 'video' ? ` · ${formatClock(r.durationSec)}` : ''}</span>
        <span className="media-row-size">{fmtBytes(r.bytes)}</span>
        {st ? <span className="media-row-state warn"><AlertTriangle size={12} /> {STATUS_TEXT[st as Exclude<MediaStatus, 'ok'>]}</span> : <span className="media-row-state">{fmtDate(r.addedAt)}</span>}
      </div>
    )
  }

  // grid rows for the virtual list
  const gridRows = useMemo(() => {
    const rows: MediaRecord[][] = []
    for (let i = 0; i < shown.length; i += cols) rows.push(shown.slice(i, i + cols))
    return rows
  }, [shown, cols])

  const emptyState = (
    <div className="media-empty">
      <div className="media-empty-icon"><ImageIcon size={30} /></div>
      {items.length === 0 ? (
        <>
          <h3>No pictures yet</h3>
          <p>Drop pictures or videos here, paste a picture, or press <b>Add pictures</b>. BORN keeps its own copy, so a missing USB stick never breaks a service.</p>
          <div className="media-empty-actions">
            <button className="btn-primary" onClick={() => void pick(false)}><Upload size={15} /> Add pictures</button>
            <button className="btn-quiet" onClick={() => void pick(true)}><FolderOpen size={15} /> Add a folder</button>
          </div>
        </>
      ) : (
        <>
          <h3>Nothing here</h3>
          <p>{search ? `No pictures match “${search}”.` : cat.kind === 'attention' ? 'Every picture is in place.' : 'This view is empty.'}</p>
        </>
      )}
    </div>
  )

  const left = (
    <div className="media-left" onKeyDown={onKeyDown}>
      <div className="media-cats">
        <div className="media-cats-head">Library</div>
        {catBtn({ kind: 'all' }, <ImageIcon size={15} />, 'All media', items.length)}
        {catBtn({ kind: 'favorites' }, <Star size={15} />, 'Favorites')}
        {catBtn({ kind: 'recent' }, <Clock size={15} />, 'Recently used')}
        {catBtn({ kind: 'attention' }, <AlertTriangle size={15} />, 'Needs attention', attentionCount || undefined)}
        {catBtn({ kind: 'videos' }, <Film size={15} />, 'Videos', items.filter((i) => i.type === 'video').length || undefined)}
        {catBtn({ kind: 'backgrounds' }, <Layers size={15} />, 'Backgrounds')}
        <div className="media-cats-head">
          Folders
          <button className="media-mini" onClick={() => setFolderEdit({ id: null, name: '' })} title="New folder" aria-label="New folder"><FolderPlus size={14} /></button>
        </div>
        {folders.map((f) =>
          folderEdit?.id === f.id ? (
            <input key={f.id} className="media-folder-input" autoFocus value={folderEdit.name} onChange={(e) => setFolderEdit({ id: f.id, name: e.target.value })} onBlur={() => void commitFolder()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void commitFolder(); if (e.key === 'Escape') setFolderEdit(null) }} />
          ) : (
            <div key={f.id} {...folderMenu.bind(() => folderMenuItems(f))}>
              {catBtn({ kind: 'folder', id: f.id }, <Folder size={15} />, f.name, items.filter((i) => i.folderId === f.id).length)}
            </div>
          )
        )}
        {folderEdit && folderEdit.id === null && (
          <input className="media-folder-input" autoFocus placeholder="Folder name" value={folderEdit.name} onChange={(e) => setFolderEdit({ id: null, name: e.target.value })} onBlur={() => void commitFolder()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void commitFolder(); if (e.key === 'Escape') setFolderEdit(null) }} />
        )}
        {tags.length > 0 && <div className="media-cats-head">Tags</div>}
        {tags.map((t) => catBtn({ kind: 'tag', tag: t.tag }, <TagIcon size={15} />, t.tag, t.count))}
      </div>

      <div className="media-items-col">
        <div className="media-toolbar">
          <div className="media-search">
            <Search size={14} aria-hidden="true" />
            <input type="search" placeholder="Search pictures, tags…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()} aria-label="Search pictures" />
          </div>
          <select className="media-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort pictures">
            <option value="added">Newest</option>
            <option value="name">Name</option>
            <option value="recent">Recently used</option>
          </select>
          <ViewToggle view={view} onChange={setView} />
        </div>
        <div className="media-actions">
          <button className="btn-primary btn-sm" onClick={() => void pick(false)} disabled={!available.ok || !!progress}><Upload size={14} /> Add pictures</button>
          {onAddYouTube && <button className="btn-secondary btn-sm" onClick={onAddYouTube} title="Paste a YouTube link — plays online in YouTube's own player"><Globe size={14} /> YouTube</button>}
          <button className="btn-quiet btn-sm" onClick={() => void pick(true)} disabled={!available.ok || !!progress}><FolderOpen size={14} /> Add folder</button>
          <button className="btn-quiet btn-sm" onClick={() => void importPdfFile()} disabled={!available.ok || !!progress || !!pdfJob} title="Turn the pages of a PDF into a slideshow"><FileText size={14} /> Import PDF</button>
          <label className="media-link-toggle" title="Keep the original where it is instead of copying it into BORN's library. Use for very large files; the file must stay in place.">
            <input type="checkbox" checked={linkInPlace} onChange={(e) => setLinkInPlace(e.target.checked)} /> Don’t copy (link in place)
          </label>
          {checked.size > 1 && (
            <span className="media-multi">
              {checked.size} selected
              <button className="btn-quiet btn-sm" onClick={() => addToQueue(orderedChecked())}><Plus size={13} /> Each to queue</button>
              <button className="btn-quiet btn-sm" onClick={() => onAddSlideshow(orderedChecked().filter((i) => !status.has(i.id) && i.type !== 'video'))}><ImageIcon size={13} /> As one slideshow</button>
              <button className="btn-quiet btn-sm" onClick={() => void remove([...checked])}><Trash2 size={13} /> Remove</button>
            </span>
          )}
        </div>

        {pdfJob && (
          <div className="media-progress" role="status" aria-live="polite">
            <div className="media-progress-bar"><i style={{ width: `${pdfJob.total ? Math.round((pdfJob.page / pdfJob.total) * 100) : 0}%` }} /></div>
            <span>{pdfJob.total ? `Adding page ${pdfJob.page} of ${pdfJob.total} from “${pdfJob.name}”…` : `Reading “${pdfJob.name}”…`}</span>
            <button className="btn-quiet btn-sm" onClick={() => pdfAbort.current?.abort()}>Cancel</button>
          </div>
        )}
        {progress && (
          <div className="media-progress" role="status" aria-live="polite">
            <div className="media-progress-bar"><i style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} /></div>
            <span>Adding {Math.min(progress.done + 1, progress.total)} of {progress.total}…</span>
          </div>
        )}
        {report && (
          <div className={`media-report${report.failed.length ? ' has-fail' : ''}`} role="status">
            <button className="media-report-x" onClick={() => setReport(null)} aria-label="Dismiss"><X size={14} /></button>
            <div>
              {report.added > 0 && <b>Added {report.added}. </b>}
              {report.dup > 0 && <span>{report.dup} already in the library. </span>}
              {report.failed.length > 0 && <b className="warn">{report.failed.length} could not be added.</b>}
              {report.added === 0 && report.dup === 0 && report.failed.length === 0 && <span>Nothing to add.</span>}
            </div>
            {report.failed.length > 0 && (
              <ul>
                {report.failed.slice(0, 6).map((f, i) => <li key={i}><b>{f.name}</b> — {f.message}</li>)}
                {report.failed.length > 6 && <li>…and {report.failed.length - 6} more.</li>}
              </ul>
            )}
            {report.failed.some((f) => /Most Compatible/.test(f.message)) && (
              <button
                className="btn-quiet btn-sm"
                onClick={() => {
                  const text = 'To use an iPhone photo here: in Photos, choose Share, then Options, then Most Compatible (or use AirDrop with “Most Compatible”). That sends a JPEG. Add the JPEG to BORN.'
                  void navigator.clipboard?.writeText(text).then(() => pushToast({ message: 'Instructions copied.' }), () => undefined)
                }}
              >
                Copy instructions
              </button>
            )}
            {report.warnings.length > 0 && <ul className="note">{report.warnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}</ul>}
          </div>
        )}

        {offlineDrives.length > 0 && (
          <div className="media-banner" role="alert">
            <Unplug size={18} />
            <div>
              <b>{offlineCount} picture{offlineCount === 1 ? ' is' : 's are'} on {offlineDrives.map(driveLabel).join(' and ')}, which {offlineDrives.length === 1 ? 'is' : 'are'} not connected.</b>
              <div>They are linked, not copied, so they can’t show until the drive is back. Plug it in and choose Check again, or choose the folder if the drive has a new letter. “Is tonight ready?” flags them too.</div>
            </div>
            <div className="media-banner-actions">
              <button className="btn-quiet btn-sm" onClick={() => void refresh()}>Check again</button>
              <button className="btn-primary btn-sm" onClick={() => void reconnectAll()}>Find the folder…</button>
            </div>
          </div>
        )}

        {cat.kind === 'backgrounds' ? (
          <MediaBackgrounds items={items} />
        ) : !available.ok ? (
          <div className="media-empty"><AlertTriangle size={26} /><h3>The media library isn’t available</h3><p>{available.message}</p></div>
        ) : !loaded ? (
          <div className="media-empty"><p>Loading…</p></div>
        ) : shown.length === 0 ? (
          emptyState
        ) : view === 'grid' ? (
          <div className="media-grid-wrap" ref={gridRef} role="listbox" aria-label="Pictures" aria-multiselectable="true">
            <VirtualList
              items={gridRows}
              threshold={20}
              estimateSize={176}
              gap={10}
              className="media-grid-scroll"
              itemKey={(r) => r.map((x) => x.id).join(',')}
              renderItem={(row) => <div className="media-grid-row" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{row.map((r) => renderCard(r))}</div>}
              focusIndex={selected ? Math.floor(shown.findIndex((i) => i.id === selected) / cols) : null}
            />
          </div>
        ) : (
          <div className="media-list-wrap" role="listbox" aria-label="Pictures" aria-multiselectable="true">
            <VirtualList
              items={shown}
              threshold={150}
              estimateSize={52}
              className="media-list-scroll"
              itemKey={(r) => r.id}
              renderItem={(r) => renderRow(r)}
              focusIndex={selected ? shown.findIndex((i) => i.id === selected) : null}
            />
          </div>
        )}
      </div>
    </div>
  )

  const right = current ? (
    <Detail
      key={current.id}
      r={current}
      status={status.get(current.id)}
      folders={folders}
      tags={tags}
      renaming={renaming === current.id}
      onRenamed={() => { setRenaming(null); void refresh() }}
      onStartRename={() => setRenaming(current.id)}
      onAddToQueue={() => addToQueue([current])}
      onFavorite={() => void toggleFav(current)}
      onRemove={() => void remove([current.id])}
      onChanged={() => void refresh()}
      notify={actions.notify}
    />
  ) : (
    <div className="media-detail media-detail--empty">
      <ImageIcon size={34} />
      <p>Choose a picture to see it large, rename it, tag it, or add it to the queue.</p>
      <p className="hint">Tip: drop files anywhere here to add them. <kbd>Q</kbd> adds to the queue, <kbd>F</kbd> favorites, <kbd>\</kbd> hides the list.</p>
    </div>
  )

  return (
    <div
      className={`media-panel${dragOver ? ' drag-over' : ''}`}
      onDragEnter={(e) => { if (Array.from(e.dataTransfer.types).includes('Files')) setDragOver(true) }}
      onDragOver={(e) => { if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault() }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false) }}
      onDrop={onDrop}
    >
      {dragOver && <div className="media-drop-hint"><Upload size={26} /> Drop to add to the library</div>}
      <DrillShell left={left} right={right} open={!!current} collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} leftClassName="media-drill-left" rightClassName="media-drill-right" />
      {menu.element}
      {folderMenu.element}
    </div>
  )
}

// ── right pane ──────────────────────────────────────────────────────────────

function Detail({
  r, status, folders, tags, renaming, onRenamed, onStartRename, onAddToQueue, onFavorite, onRemove, onChanged, notify
}: {
  r: MediaRecord
  status: MediaStatus | undefined
  folders: MediaFolder[]
  tags: Array<{ tag: string; count: number }>
  renaming: boolean
  onRenamed: () => void
  onStartRename: () => void
  onAddToQueue: () => void
  onFavorite: () => void
  onRemove: () => void
  onChanged: () => void
  notify: (m: string) => void
}): JSX.Element {
  const [name, setName] = useState(r.name)
  const [tagText, setTagText] = useState('')
  const [imgOk, setImgOk] = useState(true)
  const problem = status && status !== 'ok'
  const commitName = async (): Promise<void> => {
    const n = name.trim()
    if (n && n !== r.name) await window.electronAPI.mediaRename(r.id, n)
    onRenamed()
  }
  const setTags = async (next: string[]): Promise<void> => { await window.electronAPI.mediaSetTags(r.id, next); onChanged() }
  const addTag = (): void => {
    const t = tagText.trim().toLowerCase()
    if (t && !r.tags.includes(t)) void setTags([...r.tags, t])
    setTagText('')
  }
  const relink = async (): Promise<void> => {
    const x = await window.electronAPI.mediaRelinkPick(r.id)
    if (x.ok) { notify('Picture relinked'); onChanged() } else if (!x.canceled) notify(x.message ?? "Couldn't relink")
  }
  const reconnect = async (): Promise<void> => {
    const x = await window.electronAPI.mediaReconnectLinked()
    if (x.canceled) return
    notify(x.relinked ? `Reconnected ${x.relinked} picture${x.relinked === 1 ? '' : 's'}${x.stillMissing ? `; ${x.stillMissing} still not found` : ''}.` : "None of the missing pictures were in that folder.")
    onChanged()
  }
  const copyIn = async (): Promise<void> => {
    const x = await window.electronAPI.mediaCopyIntoLibrary([r.id])
    notify(x.copied ? 'Copied into the library — it no longer depends on its drive.' : x.message ?? "Couldn't copy it.")
    onChanged()
  }
  const big = r.width * r.height >= MEDIA_LIMITS.warnPixels
  return (
    <div className="media-detail">
      <div className="media-detail-preview">
        {imgOk ? <img src={mediaThumbUrl(r.id, 960)} alt={r.name} onError={() => setImgOk(false)} /> : <div className="media-detail-noimg"><AlertTriangle size={28} /> Can’t show this picture</div>}
      </div>
      {problem && (
        <div className="media-banner" role="alert">
          <AlertTriangle size={18} />
          <div>
            <b>{status === 'offline' ? `${(() => { const l = driveLabel(rootOfLinked(r.linkPath) ?? ''); return l.charAt(0).toUpperCase() + l.slice(1) })()} is not connected.` : status === 'missing' ? 'The file is missing.' : status === 'changed' ? 'The file was changed.' : "BORN can't read the file."}</b>
            <div>
              {status === 'offline'
                ? `This picture is linked from ${r.linkPath}. Plug the drive in and choose Check again — or, if the drive has a different letter now, choose Find the folder. Nothing is lost.`
                : r.storage === 'linked'
                ? `It was linked at ${r.linkPath}. A linked picture must stay where it was.`
                : "BORN's own copy is gone or damaged. Re-add the picture from the original to repair it."}
            </div>
          </div>
          <div className="media-banner-actions">
            {status === 'offline' && <button className="btn-quiet btn-sm" onClick={onChanged}>Check again</button>}
            {r.storage === 'linked' && <button className="btn-quiet btn-sm" onClick={() => void reconnect()}>{status === 'offline' ? 'Find the folder…' : 'Find the folders…'}</button>}
            {r.storage === 'linked' && status !== 'offline' && <button className="btn-quiet btn-sm" onClick={() => void relink()}>Find the file…</button>}
            <button className="btn-quiet btn-sm" onClick={onRemove}>Remove</button>
          </div>
        </div>
      )}
      <div className="media-detail-head">
        {renaming ? (
          <input className="media-name-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => void commitName()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void commitName(); if (e.key === 'Escape') { setName(r.name); onRenamed() } }} />
        ) : (
          <h3 className="media-name" onDoubleClick={onStartRename} title="Double-click to rename">{r.name}</h3>
        )}
        <div className="media-detail-buttons">
          <button className="btn-quiet btn-sm" onClick={onFavorite} aria-pressed={r.favorite} title="Favorite (F)"><Star size={14} fill={r.favorite ? 'currentColor' : 'none'} /> {r.favorite ? 'Favorite' : 'Favorite'}</button>
          <button className="btn-primary" onClick={onAddToQueue} disabled={!!problem} title="Add to the service queue (Q)"><Plus size={15} /> Add to queue</button>
        </div>
      </div>
      <dl className="media-facts">
        <div><dt>Size</dt><dd>{r.width} × {r.height}{big && r.type !== 'video' ? ' — very large; it will be reduced for the screen' : ''}</dd></div>
        {r.type === 'video' && (
          <>
            <div><dt>Video</dt><dd>{formatClock(r.durationSec)} long · H.264{r.fps ? ` · ${Math.round(r.fps)} fps` : ''}{r.bitrate ? ` · ${(r.bitrate / 1e6).toFixed(1)} Mbit/s` : ''}</dd></div>
            <div><dt>Sound</dt><dd>{r.audioCodec ? 'Has sound (AAC)' : 'No sound'}</dd></div>
          </>
        )}
        <div><dt>File</dt><dd>{r.ext.toUpperCase()} · {fmtBytes(r.bytes)}{r.animated ? ' · animated' : ''}{r.hasAlpha ? ' · transparent' : ''}</dd></div>
        <div><dt>Stored</dt><dd>{r.storage === 'linked' ? `Linked in place — ${r.linkPath}` : "Copied into BORN's library"}{r.convertedFrom ? ` · converted from ${r.convertedFrom.toUpperCase()}` : ''}</dd></div>
        <div><dt>Original name</dt><dd>{r.origFilename}</dd></div>
        <div><dt>Added</dt><dd>{fmtDate(r.addedAt)}{r.lastUsedAt ? ` · last used ${fmtDate(r.lastUsedAt)}` : ''}</dd></div>
      </dl>
      <div className="media-tags">
        <label>Tags</label>
        <div className="media-tag-list">
          {r.tags.map((t) => (
            <span key={t} className="media-tag">{t}<button onClick={() => void setTags(r.tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}><X size={11} /></button></span>
          ))}
          <input className="media-tag-input" placeholder="Add a tag…" list="media-known-tags" value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }} onBlur={addTag} />
          <datalist id="media-known-tags">{tags.map((t) => <option key={t.tag} value={t.tag} />)}</datalist>
        </div>
      </div>
      <UseAsBackground r={r} problem={!!problem} notify={notify} />
      <LogoRow r={r} problem={!!problem} notify={notify} />
      <div className="media-folder-row">
        <label htmlFor="media-folder-select">Folder</label>
        <select id="media-folder-select" value={r.folderId ?? ''} onChange={(e) => void window.electronAPI.mediaMove([r.id], e.target.value || null).then(onChanged)}>
          <option value="">(no folder)</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <span className="spacer" />
        {r.storage === 'linked' && !problem && <button className="btn-quiet btn-sm" onClick={() => void copyIn()} title="Copy this picture into BORN's library so it no longer needs its drive">Copy into library</button>}
        <button className="btn-quiet btn-sm" onClick={() => void window.electronAPI.mediaReveal(r.id)}><FolderOpen size={13} /> Show file</button>
        <button className="btn-quiet btn-sm" onClick={onRemove}><Trash2 size={13} /> Remove</button>
      </div>
    </div>
  )
}

function UseAsBackground({ r, problem, notify }: { r: MediaRecord; problem: boolean; notify: (m: string) => void }): JSX.Element {
  const { targets, settings, reload } = useBackgroundTargets()
  const [target, setTarget] = useState('')
  useEffect(() => { if (!target && targets[0]) setTarget(`${targets[0].scope}:${targets[0].id}`) }, [targets, target])
  const using = targets.filter((t) => (t.scope === 'destination' ? settings.destinations[t.id] : settings.channels[t.id])?.mediaId === r.id)
  const apply = async (): Promise<void> => {
    const t = targets.find((x) => `${x.scope}:${x.id}` === target)
    if (!t) return
    const cur = t.scope === 'destination' ? settings.destinations[t.id] : settings.channels[t.id]
    await window.electronAPI.mediaBackgroundSet(t.scope, t.id, { mediaId: r.id, dim: cur?.dim })
    notify(`Background set for ${t.label}`)
    void reload()
  }
  return (
    <div className="media-usebg">
      <label htmlFor="media-usebg-target">Use as a background</label>
      <div className="media-usebg-row">
        <select id="media-usebg-target" value={target} onChange={(e) => setTarget(e.target.value)}>
          {targets.map((t) => <option key={`${t.scope}:${t.id}`} value={`${t.scope}:${t.id}`}>{t.label}</option>)}
        </select>
        <button className="btn-quiet btn-sm" onClick={() => void apply()} disabled={problem || !target}>Set background</button>
      </div>
      {using.length > 0 && <div className="media-usebg-now">Currently the background of: {using.map((t) => t.label).join(', ')}</div>}
    </div>
  )
}

function LogoRow({ r, problem, notify }: { r: MediaRecord; problem: boolean; notify: (m: string) => void }): JSX.Element {
  const [logoId, setLogoId] = useState<string | null>(null)
  useEffect(() => { void window.electronAPI.mediaLogoGet().then(setLogoId) }, [r.id])
  const isLogo = logoId === r.id
  return (
    <div className="media-usebg">
      <label>Church logo</label>
      <div className="media-usebg-row">
        <button
          className="btn-quiet btn-sm"
          disabled={problem}
          onClick={async () => {
            await window.electronAPI.mediaLogoSet(isLogo ? null : r.id)
            setLogoId(isLogo ? null : r.id)
            notify(isLogo ? 'Logo cleared' : 'This picture is now the church logo (Ctrl/Cmd+Shift+L)')
          }}
        >
          {isLogo ? 'This is the logo — clear' : 'Use as the church logo'}
        </button>
        {isLogo && <span className="media-usebg-now">Shown by Ctrl/Cmd+Shift+L</span>}
      </div>
    </div>
  )
}
