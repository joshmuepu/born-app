import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Headphones, Check, AlertTriangle, XCircle, Trash2, Hand } from 'lucide-react'
import type { SyncMap, TapeFileStatus, TapeRecording } from '../../../shared/tape'
import { formatTapeTime } from '../../../shared/tape'
import { flatIndexFor, screenItemsOf } from '../../../shared/tapeParagraphs'
import { libraryStatus, sortLibrary } from '../../../shared/tapeLibrary'
import type { Quote } from '../types'
import { emitTape, onTape, timingOf, useTimingState } from '../tapeBus'
import { useTape } from '../useTape'
import { useTapeFollow } from '../useTapeFollow'
import { AddButton, AddEmpty, DownloadDialog, FolderSetting, FolderStrip, PendingSheet, Sheet, mb, useFolderHits, type PendingFile, type SermonRef } from './TapeAddParts'
import { ContextMenu } from './ContextMenu'
import { addSummary } from '../../../shared/tapeAdd'
import type { TapeAddOutcome } from '../../../shared/tape'
import TapeFollowList from './TapeFollowList'
import TapeLanguageNotice from './TapeLanguageNotice'
import TapeScreenControls from './TapeScreenControls'
import { TapeSettingsForm } from './TapeSettingsPanel'
import TapeSyncEditor from './TapeSyncEditor'
import './TapePlace.css'

/** 'add' is a request (from a sermon: "Add a recording"), not a tab: it opens the Add dialog for that sermon */
export type TapeTab = 'follow' | 'timing' | 'options'
export interface TapePlaceTarget { recordingId?: string; sermonId?: number; tab?: TapeTab | 'add'; nonce: number }
type Entry = TapeRecording & { status: TapeFileStatus; sermonTitle: string; dateCode: string; timed: number }
type Toast = (t: { message: string; actionLabel?: string; onAction?: () => void; timeoutMs?: number }) => void

const LANG_KEY = (id: string): string => `born.tape.textLang.${id}`
const readLang = (id: string, fallback: string): string => { try { return localStorage.getItem(LANG_KEY(id)) || fallback } catch { return fallback } }
const TONE_ICON = { ok: Check, warn: AlertTriangle, bad: XCircle } as const

/**
 * The Tape place (mockups 13, 18, 19): every recording and whether it is ready, and — for the one chosen — the big follow-along view, the screens, its
 * timing, the options, and adding a recording. The player itself is the bar at the bottom of every section; nothing here sits next to Take or Project.
 */
export default function TapePlace({ visible, target, pushToast }: { visible: boolean; target: TapePlaceTarget | null; pushToast: Toast }): JSX.Element {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selId, setSelId] = useState<string | null>(null)
  const [tab, setTab] = useState<TapeTab>('follow')
  const { wire } = useTape(1000)
  const timing = useTimingState()
  const picked = useRef(false) // the operator chose a recording themself: do not move the selection under their hand
  // adding: the picker opens in the Tape audio folder, a file named with its date code goes to its sermon at once, and the place lands on what was added
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState<PendingFile[]>([])
  const [sermons, setSermons] = useState<SermonRef[]>([])
  const [dlOpen, setDlOpen] = useState(false)
  const [addFor, setAddFor] = useState<number | null>(null) // asked from a sermon: choose or download for THAT sermon
  const [dl, setDl] = useState<{ received: number; total: number | null } | null>(null)
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const folder = useFolderHits(entries.length)
  const titles = useRef(new Map<number, string>())

  const reload = useCallback(async () => {
    const l = (await window.electronAPI.tapeLibrary?.()) ?? []
    setEntries(sortLibrary(l) as Entry[])
    setLoaded(true)
  }, [])
  useEffect(() => { if (visible) void reload() }, [visible, reload])
  useEffect(() => onTape((e) => { if (e === 'recordings-changed' || e === 'map-changed') void reload() }), [reload])

  // where to land: what was asked for (a click on the bar, a sermon chip), else the recording in the player, else the first one
  useEffect(() => {
    if (!visible || !loaded) return
    if (target) {
      const byRec = target.recordingId ? entries.find((e) => e.id === target.recordingId) : undefined
      const bySermon = target.sermonId != null ? entries.find((e) => e.sermonId === target.sermonId) : undefined
      const hit = byRec ?? bySermon
      if (hit) setSelId(hit.id)
      if (target.tab === 'add') { setTab('follow'); setAddFor(target.sermonId ?? 0) } else setTab(target.tab ?? 'follow')
      return
    }
    setSelId((cur) => (cur && entries.some((e) => e.id === cur) ? cur : (wire && entries.some((e) => e.id === wire.recordingId) ? wire.recordingId : entries[0]?.id ?? null)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, loaded, entries.length, target?.nonce])
  // the recording in the player arrives (or changes) after the list: follow it, unless the operator already picked one
  useEffect(() => {
    if (!visible || target || picked.current || !wire) return
    if (entries.some((e) => e.id === wire.recordingId)) setSelId(wire.recordingId)
  }, [visible, target, wire?.recordingId, entries]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void Promise.resolve(window.electronAPI.tapeSermonList?.()).then((l) => { titles.current = new Map((l ?? []).map((s) => [s.id, `${s.dateCode} · ${s.title}`])); setSermons(l ?? []) }) }, [])
  useEffect(() => window.electronAPI.onTapeDownloadProgress?.((p) => setDl({ received: p.received, total: p.total })), [])
  const land = useCallback(async (o: TapeAddOutcome): Promise<void> => {
    const s = addSummary(o, (id) => titles.current.get(id) ?? 'the sermon')
    setPending((cur) => [...cur.filter((c) => !o.pending.some((p) => p.path === c.path)), ...o.pending])
    if (o.added.some((r) => r.ok)) {
      emitTape('recordings-changed')
      await reload()
      if (s.recordingId) {
        picked.current = true
        setSelId(s.recordingId)
        // landed: the text follows it once it is timed; if it is not, Timing is the next step
        const lib = (await window.electronAPI.tapeLibrary?.()) ?? []
        const e = (lib as Entry[]).find((x) => x.id === s.recordingId)
        const auto = ((await window.electronAPI.tapeTimingState?.()) as { available?: boolean } | undefined)?.available
        setTab(e && e.timed === 0 && !auto ? 'timing' : 'follow')
        if (!o.pending.length && s.message) pushToast({ message: s.message + (e && e.timed === 0 ? (auto ? ' It plays now; the text follows once BORN has timed it.' : ' It has no timing yet.') : ''), timeoutMs: 7000 })
      }
    } else if (s.problems.length) pushToast({ message: s.problems[0], timeoutMs: 9000 })
  }, [reload, pushToast])
  const startAdd = useCallback(async (): Promise<void> => {
    setAdding(true)
    try { const o = await window.electronAPI.tapeAddFiles(); if (!o.canceled) await land(o) } finally { setAdding(false) }
  }, [land])
  const addPaths = useCallback(async (paths: string[]): Promise<void> => {
    setAdding(true)
    try { await land(await window.electronAPI.tapeAddPaths(paths)) } finally { setAdding(false) }
  }, [land])
  const resolve = useCallback(async (f: PendingFile, sermonId: number): Promise<void> => {
    setAdding(true)
    try {
      const r = (await window.electronAPI.tapeImportConfirmed([{ path: f.path, sermonId }])) as TapeAddOutcome['added']
      setPending((cur) => cur.filter((c) => c.path !== f.path))
      await land({ canceled: false, added: r, pending: [] })
    } finally { setAdding(false) }
  }, [land])
  const sel = entries.find((e) => e.id === selId) ?? null
  const removing = entries.find((e) => e.id === removeId) ?? null
  const afterDownload = useCallback((results: Array<{ ok: boolean }>): void => {
    setDl(null)
    if (results.some((r) => r.ok)) { emitTape('recordings-changed'); void reload() }
  }, [reload])
  const choose = (): void => { setAddFor(null); void startAdd() }

  return (
    <section className="tp" aria-label="Tape" onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }} onDrop={(e) => { const paths = window.electronAPI.tapePathsForFiles(Array.from(e.dataTransfer.files)); if (paths.length) { e.preventDefault(); void addPaths(paths) } }}>
      <header className="tp-head">
        <div>
          <div className="tp-caps">Tape</div>
          <h2 className="tp-title"><Headphones width={18} height={18} aria-hidden="true" /> Recordings</h2>
        </div>
      </header>
      <FolderStrip hits={folder.hits} busy={adding} onAdd={(p) => void addPaths(p)} />
      {dl && !dlOpen && (
        <div className="tp-dlrow" role="status" aria-live="polite">
          <span>Downloading… {dl.total ? `${mb(dl.received)} of ${mb(dl.total)}` : 'starting'}</span>
          <span className="tape-dl-bar" aria-hidden="true"><i style={{ width: `${dl.total ? Math.min(100, Math.round((dl.received / dl.total) * 100)) : 5}%` }} /></span>
          <button className="btn-quiet btn-sm" onClick={() => void window.electronAPI.tapeDownloadCancel()}>Cancel</button>
        </div>
      )}
      {loaded && entries.length === 0 ? (
        <AddEmpty busy={adding} folder={folder.folder} onChoose={() => void startAdd()} onDownload={() => setDlOpen(true)} />
      ) : (
        <div className="tp-body">
          <ul className="tp-lib" aria-label="Recordings">
            <li className="tp-lib-head" role="none"><AddButton busy={adding} onChoose={() => void startAdd()} onDownload={() => setDlOpen(true)} /></li>
            {entries.map((e) => {
              const st = libraryStatus(e, timingOf(timing, e.id))
              const Icon = TONE_ICON[st.tone]
              return (
                <li key={e.id} className="tp-lib-item">
                  <button className={`tp-rec${e.id === selId ? ' is-sel' : ''}`} onClick={() => { picked.current = true; setSelId(e.id) }} aria-current={e.id === selId ? 'true' : undefined}>
                    <span className="tp-rec-top"><b>{e.sermonTitle}</b><span className={`tp-chip tp-chip--${st.tone}`}><Icon width={12} height={12} aria-hidden="true" /> {st.label}</span></span>
                    <span className="tp-faint">{e.dateCode} · {formatTapeTime(e.file.durationSec)} · {e.file.ext.toUpperCase()}{wire?.recordingId === e.id ? ' · in the player' : ''}</span>
                  </button>
                  <button className="tp-rec-more btn-quiet btn-sm" aria-label={`More for ${e.sermonTitle}`} aria-haspopup="menu" onClick={(ev) => { const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(); setRowMenu({ id: e.id, x: r.left, y: r.bottom + 4 }) }}>⋯</button>
                </li>
              )
            })}
          </ul>
          <div className="tp-detail">
            <div className="tp-tabs" role="tablist" aria-label="Recording">
              {(['follow', 'timing', 'options'] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>{{ follow: 'Follow', timing: 'Timing', options: 'Options' }[t]}</button>
              ))}
            </div>
            <div className="tp-pane" role="tabpanel">
              {tab === 'follow' && (sel ? <FollowTab key={sel.id} entry={sel} pushToast={pushToast} /> : <p className="tp-faint tp-pad">Choose a recording on the left.</p>)}
              {tab === 'timing' && (sel ? <TimingTab key={sel.id} entry={sel} onChanged={() => { emitTape('map-changed'); void reload() }} /> : <p className="tp-faint tp-pad">Choose a recording on the left.</p>)}
              {tab === 'options' && <div className="tp-pad tp-options"><TapeSettingsForm /><FolderSetting /></div>}
            </div>
          </div>
        </div>
      )}
      {rowMenu && <ContextMenu x={rowMenu.x} y={rowMenu.y} onClose={() => setRowMenu(null)} items={[{ id: 'remove', label: 'Remove this recording…', danger: true, onSelect: () => setRemoveId(rowMenu.id) }]} />}
      {removing && (
        <Sheet title={`Remove “${removing.sermonTitle}”?`} onClose={() => setRemoveId(null)}>
          <p>This takes the recording off the sermon and forgets its timing. The sermon text and the original audio file are never deleted.</p>
          <div className="tp-sheet-actions">
            <button className="btn-danger" onClick={async () => { await window.electronAPI.tapeRemove(removing.id); setRemoveId(null); if (selId === removing.id) setSelId(null); emitTape('recordings-changed'); void reload() }}><Trash2 width={13} height={13} aria-hidden="true" /> Remove it</button>
            <button className="btn-quiet" onClick={() => setRemoveId(null)}>Keep it</button>
          </div>
        </Sheet>
      )}
      {pending.length > 0 && <PendingSheet pending={pending} sermons={sermons} preferredSermonId={sel?.sermonId ?? null} onResolve={(f, id) => void resolve(f, id)} onSkip={(f) => setPending((c) => c.filter((x) => x.path !== f.path))} onClose={() => setPending([])} />}
      {dlOpen && <DownloadDialog sermons={sermons} preferredSermonId={sel?.sermonId ?? null} onClose={() => setDlOpen(false)} onDone={afterDownload} />}
      {addFor !== null && (
        <Sheet title={`Add a recording${addFor && titles.current.get(addFor) ? ` for ${titles.current.get(addFor)}` : ''}`} onClose={() => setAddFor(null)}>
          <p>Choose the file you have, or download it. BORN keeps its own copy and never changes your file.</p>
          <div className="tp-sheet-actions">
            <button className="btn-primary" onClick={choose}>Choose a file…</button>
            <button className="btn-secondary" onClick={() => { setAddFor(null); setDlOpen(true) }}>Download…</button>
            <button className="btn-quiet" onClick={() => setAddFor(null)}>Not now</button>
          </div>
        </Sheet>
      )}
    </section>
  )
}

function FollowTab({ entry, pushToast }: { entry: Entry; pushToast: Toast }): JSX.Element {
  const [lang, setLangState] = useState(() => readLang(entry.id, entry.language || 'en'))
  const setLang = (l: string): void => { setLangState(l); try { localStorage.setItem(LANG_KEY(entry.id), l) } catch { /* a convenience only */ } }
  const [languages, setLanguages] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  useEffect(() => { void window.electronAPI.getLanguages?.()?.then((l) => setLanguages(l ?? {})).catch(() => {}) }, [])
  useEffect(() => onTape((e) => { if (e === 'map-changed') setVersion((v) => v + 1) }), [])
  useEffect(() => {
    let alive = true
    setLoading(true)
    void window.electronAPI.getSermonParagraphs(entry.sermonId, lang).then((r) => { if (alive) { setRows(r as Quote[]); setLoading(false) } })
    return () => { alive = false }
  }, [entry.sermonId, lang])
  const items = useMemo(() => screenItemsOf(rows as never), [rows])
  const textNumbers = useMemo(() => [...new Set(items.map((i) => i.n))], [items])
  const tf = useTapeFollow(entry, lang, version, textNumbers)
  const timingState = useTimingState()
  const tm = timingOf(timingState, entry.id)
  const active = tf.mine && !!tf.map && !!tf.here && tf.here.n !== null
  const currentIndex = useMemo(() => (active ? flatIndexFor(items.map((i) => i.marker), tf.here!.n, tf.here!.progress) : -1), [active, items, tf.here])
  const jump = (n: number): void => {
    if (tf.jumpToParagraph(n)) { tf.setFollow(true); pushToast({ message: `Moved the tape to ¶${n}`, actionLabel: 'Undo', onAction: tf.undoJump, timeoutMs: 9000 }) }
    else pushToast({ message: `¶${n} has no time on this tape yet.`, timeoutMs: 5000 })
  }

  return (
    <div className="tp-follow">
      {!tf.mine && (
        <div className="tp-banner" role="status">
          <span>This recording is not in the player yet. Loading it does not play it.</span>
          <button className="btn-primary btn-sm" onClick={() => void window.electronAPI.tapeLoad(entry.id)}>Load it into the player</button>
        </div>
      )}
      {tf.map === null && (tm
        ? <div className="tp-banner" role="status"><span>{tm === 'queued' ? 'This recording plays now. BORN will time it next, so the text can follow it.' : `This recording plays now. BORN is timing it in the background (${tm.pct}%); the text will follow it when that finishes.`}</span></div>
        : <div className="tp-banner tp-banner--warn" role="status"><Hand width={14} height={14} aria-hidden="true" /> <span>No timing yet — the text cannot follow this recording.</span> {timingState.available && entry.language === 'en' ? <button className="btn-primary btn-sm" onClick={() => void window.electronAPI.tapeTimingStart(entry.id)}>Time it now</button> : <span>Use the Timing tab.</span>}</div>)}
      <div className="tp-follow-head">
        <label className="tp-lang" title="The language of the text on screen. The recording keeps its own language.">
          Text <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Text language">
            {(Object.keys(languages).length ? Object.entries(languages) : [[lang, lang.toUpperCase()]] as Array<[string, string]>).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
          <span className="tp-faint"> · Tape {entry.language.toUpperCase()}</span>
        </label>
        <TapeScreenControls recording={entry} sermonId={entry.sermonId} title={entry.sermonTitle} items={items} rows={rows as never} map={tf.map} textLanguage={lang} position={tf.mine ? tf.pos : 0} />
      </div>
      {tf.agreement && tf.foreign && <TapeLanguageNotice agreement={tf.agreement} decision={tf.decision} overrides={tf.overrides} textLabel={languages[lang] ?? lang.toUpperCase()} onChoose={tf.choose} onSaveOverrides={tf.saveOverrides} />}
      <div className="tp-follow-bar">
        <button className={`tape-toggle${tf.follow ? ' on' : ''}`} role="switch" aria-checked={tf.follow} onClick={() => tf.setFollow(!tf.follow)} title="The text scrolls to keep the paragraph being spoken in view (F)">
          <i aria-hidden="true" /> Text follows the tape
        </button>
        {active && !tf.follow && <button className="btn-secondary btn-sm" onClick={() => tf.setFollow(true)}>Back to the tape</button>}
      </div>
      {loading ? <div className="tp-faint tp-pad">Loading the sermon…</div> : (
        <TapeFollowList items={items} currentN={active ? tf.here!.n : null} currentIndex={currentIndex >= 0 ? currentIndex : null} follow={tf.follow} canJump={tf.mine && !!tf.map} onJump={jump} onUserScroll={() => { if (active) tf.setFollow(false) }} />
      )}
    </div>
  )
}

function TimingTab({ entry, onChanged }: { entry: Entry; onChanged: () => void }): JSX.Element {
  const [map, setMap] = useState<SyncMap | null>(null)
  const [editing, setEditing] = useState(false)
  useEffect(() => { let a = true; void Promise.resolve(window.electronAPI.tapeMapGet?.(entry.id, null)).then((m) => { if (a) setMap((m as SyncMap | null) ?? null) }); return () => { a = false } }, [entry.id, entry.timed])
  const src = map ? ({ tap: 'made by tapping along', auto: 'timed automatically by BORN', imported: 'loaded from a timing file' } as Record<string, string>)[map.source] ?? map.source : null
  const timingState = useTimingState()
  const tm = timingOf(timingState, entry.id)
  const st = libraryStatus(entry, tm)
  const canAuto = timingState.available && entry.language === 'en' && entry.status === 'ok'
  const retime = async (): Promise<void> => { if (map?.source === 'auto') await window.electronAPI.tapeMapDelete(entry.id, null); emitTape('map-changed'); await window.electronAPI.tapeTimingStart(entry.id) }
  return (
    <div className="tp-pad tp-timing">
      <div className="tp-card">
        <h4>Timing for “{entry.sermonTitle}”</h4>
        <p><span className={`tp-chip tp-chip--${st.tone}`}>{st.label}</span> {st.detail}{src ? ` It was ${src}.` : ''}</p>
        <div className="tpa-actions">
          {tm ? <button className="btn-secondary btn-sm" onClick={() => void window.electronAPI.tapeTimingCancel(entry.id)}>Stop timing</button>
            : canAuto && (entry.timed === 0 || map?.source === 'auto') ? <button className={entry.timed === 0 ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => void retime()}>{entry.timed === 0 ? 'Time it now' : 'Time it again'}</button> : null}
          <button className="btn-secondary btn-sm" onClick={() => setEditing(true)} disabled={entry.status !== 'ok'}>{entry.timed > 0 ? 'Edit timing…' : 'Tap to sync by hand…'}</button>
        </div>
        <p className="tp-faint">BORN times every English recording by itself, in the background, as soon as it is added — nothing to set up and no need to wait: the tape plays at once and the text follows when it finishes. Editing by hand is only for fixing something.</p>
        {entry.status !== 'ok' && <p className="tp-faint">The recording file has a problem ({st.label.toLowerCase()}), so it cannot be timed until that is fixed.</p>}
      </div>
      {editing && <TapeSyncEditor recording={entry} sermonId={entry.sermonId} sermonTitle={entry.sermonTitle} dateCode={entry.dateCode} onClose={() => { setEditing(false); onChanged() }} onSaved={onChanged} />}
    </div>
  )
}
