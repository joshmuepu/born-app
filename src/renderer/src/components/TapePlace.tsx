import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Headphones, Check, AlertTriangle, XCircle, Trash2, Hand } from 'lucide-react'
import type { SyncMap, TapeFileStatus, TapeRecording } from '../../../shared/tape'
import { formatTapeTime } from '../../../shared/tape'
import { flatIndexFor, screenItemsOf } from '../../../shared/tapeParagraphs'
import { libraryStatus, sortLibrary } from '../../../shared/tapeLibrary'
import type { Quote } from '../types'
import { emitTape, onTape } from '../tapeBus'
import { useTape } from '../useTape'
import { useTapeHint } from '../tapeHint'
import { useTapeFollow } from '../useTapeFollow'
import TapeAddPanel, { type PendingFile } from './TapeAddPanel'
import { addSummary } from '../../../shared/tapeAdd'
import type { TapeAddOutcome } from '../../../shared/tape'
import TapeFollowList from './TapeFollowList'
import TapeLanguageNotice from './TapeLanguageNotice'
import TapeScreenControls from './TapeScreenControls'
import { TapeSettingsForm } from './TapeSettingsPanel'
import TapeSyncEditor from './TapeSyncEditor'
import './TapePlace.css'

export type TapeTab = 'follow' | 'timing' | 'options' | 'add'
export interface TapePlaceTarget { recordingId?: string; sermonId?: number; tab?: TapeTab; nonce: number }
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
  const hint = useTapeHint('place')
  const picked = useRef(false) // the operator chose a recording themself: do not move the selection under their hand
  // adding: the picker opens in the Tape audio folder, a file named with its date code goes to its sermon at once, and the place lands on what was added
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<string | null>(null)
  const [addProblems, setAddProblems] = useState<string[]>([])
  const [pending, setPending] = useState<PendingFile[]>([])
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
      setTab(target.tab ?? (hit ? 'follow' : 'add'))
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

  useEffect(() => { void Promise.resolve(window.electronAPI.tapeSermonList?.()).then((l) => { titles.current = new Map((l ?? []).map((s) => [s.id, `${s.dateCode} · ${s.title}`])) }) }, [])
  const land = useCallback(async (o: TapeAddOutcome): Promise<void> => {
    const s = addSummary(o, (id) => titles.current.get(id) ?? 'the sermon')
    setAddMsg(s.message)
    setAddProblems(s.problems)
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
        setTab(o.pending.length ? 'add' : e && e.timed === 0 ? 'timing' : 'follow')
        if (!o.pending.length && s.message) pushToast({ message: s.message + (e && e.timed === 0 ? ' It has no timing yet.' : ''), timeoutMs: 6000 })
      }
    } else if (o.pending.length || s.problems.length) setTab('add')
  }, [reload, pushToast])
  const startAdd = useCallback(async (): Promise<void> => {
    setAdding(true); setAddMsg(null); setAddProblems([])
    try { const o = await window.electronAPI.tapeAddFiles(); if (!o.canceled) await land(o) } finally { setAdding(false) }
  }, [land])
  const addPaths = useCallback(async (paths: string[]): Promise<void> => {
    setAdding(true); setAddMsg(null); setAddProblems([])
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
  const showAdd = tab === 'add' || (loaded && entries.length === 0)

  return (
    <section className="tp" aria-label="Tape" onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }} onDrop={(e) => { const paths = window.electronAPI.tapePathsForFiles(Array.from(e.dataTransfer.files)); if (paths.length) { e.preventDefault(); void addPaths(paths) } }}>
      <header className="tp-head">
        <div>
          <div className="tp-caps">Tape</div>
          <h2 className="tp-title"><Headphones width={18} height={18} aria-hidden="true" /> Recordings</h2>
        </div>
      </header>
      {hint.show && (
        <div className="tp-hint" role="note">
          <span><b>Welcome to the Tape place.</b> Recordings live here: add one, time it once, and the text follows it. The player is the bar at the bottom of every section; <b>Show on the screens</b> shows the text to the congregation. Nothing plays until you press Play.</span>
          <button className="btn-quiet btn-sm" onClick={hint.dismiss}>Got it</button>
        </div>
      )}
      {loaded && entries.length === 0 ? (
        <div className="tp-empty">
          <div className="tp-empty-ico"><Headphones width={28} height={28} aria-hidden="true" /></div>
          <h3>No recordings yet</h3>
          <p>Add a recorded sermon and BORN will play it and keep the text in step — on your screen, the congregation screen, the stage monitor and the phone. Everything stays on this computer.</p>
          <TapeAddPanel busy={adding} message={addMsg} problems={addProblems} pending={pending} onAdd={() => void startAdd()} onDropPaths={(p) => void addPaths(p)} onResolve={(f, id) => void resolve(f, id)} onSkip={(f) => setPending((c) => c.filter((x) => x.path !== f.path))} onChanged={() => void reload()} />
        </div>
      ) : (
        <div className="tp-body">
          <ul className="tp-lib" aria-label="Recordings">
            {entries.map((e) => {
              const st = libraryStatus(e)
              const Icon = TONE_ICON[st.tone]
              return (
                <li key={e.id}>
                  <button className={`tp-rec${e.id === selId ? ' is-sel' : ''}`} onClick={() => { picked.current = true; setSelId(e.id); if (tab === 'add') setTab('follow') }} aria-current={e.id === selId ? 'true' : undefined}>
                    <span className="tp-rec-top"><b>{e.sermonTitle}</b><span className={`tp-chip tp-chip--${st.tone}`}><Icon width={12} height={12} aria-hidden="true" /> {st.label}</span></span>
                    <span className="tp-faint">{e.dateCode} · {formatTapeTime(e.file.durationSec)} · {e.file.ext.toUpperCase()}{wire?.recordingId === e.id ? ' · in the player' : ''}</span>
                  </button>
                </li>
              )
            })}
            <li><button className="btn-secondary btn-sm tp-addbtn" onClick={() => void startAdd()} disabled={adding}>{adding ? 'Adding…' : 'Add a recording…'}</button></li>
          </ul>
          <div className="tp-detail">
            <div className="tp-tabs" role="tablist" aria-label="Recording">
              {(['follow', 'timing', 'options', 'add'] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>{{ follow: 'Follow', timing: 'Timing', options: 'Options', add: 'Add' }[t]}</button>
              ))}
            </div>
            <div className="tp-pane" role="tabpanel">
              {tab === 'follow' && (sel ? <FollowTab key={sel.id} entry={sel} pushToast={pushToast} /> : <p className="tp-faint tp-pad">Choose a recording on the left.</p>)}
              {tab === 'timing' && (sel ? <TimingTab key={sel.id} entry={sel} onChanged={() => { emitTape('map-changed'); void reload() }} onRemoved={() => { setSelId(null); emitTape('recordings-changed'); void reload() }} /> : <p className="tp-faint tp-pad">Choose a recording on the left.</p>)}
              {tab === 'options' && <div className="tp-pad tp-options"><TapeSettingsForm /></div>}
              {showAdd && tab === 'add' && <div className="tp-pad"><TapeAddPanel busy={adding} message={addMsg} problems={addProblems} pending={pending} onAdd={() => void startAdd()} onDropPaths={(p) => void addPaths(p)} onResolve={(f, id) => void resolve(f, id)} onSkip={(f) => setPending((c) => c.filter((x) => x.path !== f.path))} preferredSermonId={sel?.sermonId ?? null} onChanged={() => void reload()} /></div>}
            </div>
          </div>
        </div>
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
      {tf.map === null && <div className="tp-banner tp-banner--warn" role="status"><Hand width={14} height={14} aria-hidden="true" /> <span>No timing yet — the text cannot follow this recording. Use the Timing tab.</span></div>}
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

function TimingTab({ entry, onChanged, onRemoved }: { entry: Entry; onChanged: () => void; onRemoved: () => void }): JSX.Element {
  const [map, setMap] = useState<SyncMap | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { let a = true; void Promise.resolve(window.electronAPI.tapeMapGet?.(entry.id, null)).then((m) => { if (a) setMap((m as SyncMap | null) ?? null) }); return () => { a = false } }, [entry.id, entry.timed])
  const src = map ? ({ tap: 'made by tapping along', auto: 'proposed by speech recognition and checked', imported: 'loaded from a timing file' } as Record<string, string>)[map.source] ?? map.source : null
  const st = libraryStatus(entry)
  return (
    <div className="tp-pad tp-timing">
      <div className="tp-card">
        <h4>Timing for “{entry.sermonTitle}”</h4>
        <p><span className={`tp-chip tp-chip--${st.tone}`}>{st.label}</span> {st.detail}{src ? ` It was ${src}.` : ''}</p>
        <div className="tpa-actions">
          <button className="btn-primary btn-sm" onClick={() => setEditing(true)} disabled={entry.status !== 'ok'}>{entry.timed > 0 ? 'Edit timing…' : 'Tap to sync…'}</button>
        </div>
        <p className="tp-faint">In the editor you can tap along as you listen, <b>Suggest timing</b> with speech recognition you installed yourself (it only proposes — you review the least sure paragraphs first), share a times-only timing file, and mark “no text here” stretches.</p>
        {entry.status !== 'ok' && <p className="tp-faint">The recording file has a problem ({st.label.toLowerCase()}), so it cannot be timed until that is fixed.</p>}
      </div>
      <div className="tp-card">
        <h4>Remove this recording</h4>
        <p className="tp-faint">This takes the recording off the sermon and forgets its timing. The sermon text and the original audio file are never deleted.</p>
        {confirm ? (
          <div className="tpa-actions"><button className="btn-danger btn-sm" onClick={async () => { await window.electronAPI.tapeRemove(entry.id); onRemoved() }}><Trash2 width={13} height={13} aria-hidden="true" /> Remove it</button><button className="btn-quiet btn-sm" onClick={() => setConfirm(false)}>Keep it</button></div>
        ) : <button className="btn-secondary btn-sm" onClick={() => setConfirm(true)}>Remove this recording…</button>}
      </div>
      {editing && <TapeSyncEditor recording={entry} sermonId={entry.sermonId} sermonTitle={entry.sermonTitle} dateCode={entry.dateCode} onClose={() => { setEditing(false); onChanged() }} onSaved={onChanged} />}
    </div>
  )
}
