import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { X, Hand, Undo2, Save, Download, Upload, Play, Trash2, SkipForward, Flag, EyeOff, Clock, AlertTriangle, Check, Sparkles, ListChecks } from 'lucide-react'
import type { SyncMark, SyncRegion, TapeRecording } from '../../../shared/tape'
import { formatTapeTime } from '../../../shared/tape'
import { numberedParagraphs, type NumberedParagraph } from '../../../shared/tapeParagraphs'
import { editorReduce, emptyEditor, nextTarget, paragraphAt, tapTime, timedCount, validateMap, type MapIssue } from '../../../shared/tapeSync'
import { useTape } from '../useTape'
import TapeBar from './TapeBar'
import './TapeSyncEditor.css'

const REACTION_KEY = 'born.tape.reaction'
const readReaction = (): number => { try { const raw = localStorage.getItem(REACTION_KEY); if (raw === null) return 0.25; const v = Number(raw); return Number.isFinite(v) && v >= 0 && v <= 2 ? v : 0.25 } catch { return 0.25 } }
const t1 = (n: number): string => n.toFixed(1)

/**
 * Sync editor (tap to sync / correct) — mockup 07. Listen to the tape; press Space at the start of each numbered paragraph; BORN says which one to
 * listen for. Nudge by tenths, drag markers, undo, play from any marker, mark where the tape has no text or differs from it, save, share.
 * Times are keyed by NUMBERED paragraph, so a row like "41-47" is seven paragraphs here. Nothing is saved until Save is pressed.
 */
export default function TapeSyncEditor({
  recording,
  sermonId,
  sermonTitle,
  dateCode,
  language = 'en',
  onClose,
  onSaved
}: {
  recording: TapeRecording
  sermonId: number
  sermonTitle: string
  dateCode: string
  language?: string
  onClose: () => void
  onSaved?: () => void
}): JSX.Element {
  const { wire, pos, command, load } = useTape()
  const mine = !!wire && wire.recordingId === recording.id
  const dur = recording.file.durationSec
  const [paras, setParas] = useState<NumberedParagraph[]>([])
  const [st, dispatch] = useReducer(editorReduce, undefined, () => emptyEditor())
  const [loaded, setLoaded] = useState(false)
  const [activity, setActivity] = useState<number[] | null>(null)
  const [reaction, setReaction] = useState(readReaction)
  const [target, setTarget] = useState<number | null>(null)
  const [regionStart, setRegionStart] = useState<{ kind: SyncRegion['kind']; t: number } | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn' | 'bad'; text: string } | null>(null)
  const [issues, setIssues] = useState<MapIssue[]>([])
  const [zoom, setZoom] = useState<'tape' | 'near'>('tape')
  const [confirmClose, setConfirmClose] = useState(false)
  const [drag, setDrag] = useState<{ n: number; t: number } | null>(null)
  const [aligning, setAligning] = useState<{ phase: 'prepare' | 'listen' | 'match'; pct: number } | null>(null)
  const reviewIdx = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map())

  const starts = useMemo(() => st.marks.filter((m) => m.kind === 'start' && m.t !== null).map((m) => m.t as number), [st.marks])
  const numbers = useMemo(() => paras.map((p) => p.n), [paras])
  const byN = useMemo(() => new Map(paras.map((p) => [p.n, p])), [paras])

  // the sermon text (the same numbered split the reader and projector use) and any saved map
  useEffect(() => {
    let alive = true
    void window.electronAPI.getSermonParagraphs(sermonId, language).then((rows) => { if (alive) setParas(numberedParagraphs(rows)) })
    void window.electronAPI.tapeMapGet(recording.id, null).then((m) => { if (alive) { dispatch({ type: 'replace', marks: m?.marks ?? [], regions: m?.regions ?? [] }); dispatch({ type: 'saved' }); setLoaded(true) } })
    void window.electronAPI.tapeActivity(recording.id, 900).then((a) => { if (alive) setActivity(a ? a.values : null) })
    // the tape waits (paused) at the editor's start; nothing plays
    if (!mine) void load(recording.id)
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording.id, sermonId, language])

  useEffect(() => {
    if (!loaded) return
    setTarget((cur) => (cur !== null && !st.marks.some((m) => m.n === cur) ? cur : nextTarget(st.marks, numbers)))
  }, [st.marks, numbers, loaded])
  useEffect(() => { try { localStorage.setItem(REACTION_KEY, String(reaction)) } catch { /* not remembered */ } }, [reaction])
  useEffect(() => { rootRef.current?.focus() }, [])

  const position = mine ? pos : 0
  const playing = mine && wire!.status === 'playing'
  const here = paragraphAt(st.marks, st.regions, position)

  const tap = useCallback(() => {
    if (target === null) return
    dispatch({ type: 'tap', n: target, t: tapTime(position, reaction) })
    setMessage(null)
  }, [target, position, reaction])
  const playFrom = (t: number): void => {
    if (mine) command({ type: 'seek', to: Math.max(0, t - 1) })
    else void load(recording.id, { position: Math.max(0, t - 1), play: true })
    if (mine && !playing) command({ type: 'play' })
  }
  const toggleRegion = (kind: SyncRegion['kind']): void => {
    if (regionStart && regionStart.kind === kind) {
      const a = Math.min(regionStart.t, position), b = Math.max(regionStart.t, position)
      if (b - a >= 1) dispatch({ type: 'region-add', region: { kind, start: a, end: b } })
      setRegionStart(null)
    } else setRegionStart({ kind, t: position })
  }

  const save = async (): Promise<void> => {
    const iss = validateMap(st.marks, st.regions, dur, numbers)
    setIssues(iss)
    if (iss.some((i) => i.level === 'error')) { setMessage({ kind: 'bad', text: 'This cannot be saved yet — see the problems below.' }); return }
    const r = await window.electronAPI.tapeMapSave(recording.id, null, st.marks.some((m) => m.confidence !== null && m.confidence !== undefined) ? 'auto' : 'tap', st.marks, st.regions)
    if (r.ok) { dispatch({ type: 'saved' }); setMessage({ kind: 'ok', text: `Saved — ${timedCount(r.map.marks)} paragraphs are timed.` }); onSaved?.() }
    else { setIssues(r.issues); setMessage({ kind: 'bad', text: r.issues[0]?.message ?? 'It could not be saved.' }) }
  }
  const exportMap = async (): Promise<void> => {
    if (st.dirty) { setMessage({ kind: 'warn', text: 'Save first — the file holds what is saved.' }); return }
    const r = await window.electronAPI.tapeMapExport(recording.id, null)
    if (r.ok) setMessage({ kind: 'ok', text: 'The timing file was saved. It holds times only — no text and no audio.' })
    else if (!r.canceled) setMessage({ kind: 'bad', text: r.message ?? 'It could not be saved.' })
  }
  const importMap = async (): Promise<void> => {
    const r = await window.electronAPI.tapeMapImport(recording.id)
    if (!r.ok) { if (!r.canceled) setMessage({ kind: 'bad', text: r.message }); return }
    dispatch({ type: 'replace', marks: r.marks, regions: r.regions })
    setMessage({ kind: r.warnings.length ? 'warn' : 'ok', text: `Timing loaded — ${r.marks.length} paragraphs. Check it, then Save.${r.warnings.length ? ' ' + r.warnings.join(' ') : ''}` })
  }
  /** Ask the built-in recogniser for a PROPOSAL. It is loaded into the editor like an import: nothing is saved or used until the operator saves it. */
  const suggest = async (): Promise<void> => {
    if (aligning) { await window.electronAPI.tapeAlignCancel(); return }
    if (st.marks.length > 0 && !window.confirm('This replaces the timing on screen with a suggestion (Undo brings it back). Continue?')) return
    setMessage(null)
    setAligning({ phase: 'prepare', pct: 0 })
    const off = window.electronAPI.onTapeAlignProgress((p) => setAligning(p))
    try {
      const r = await window.electronAPI.tapeAlignRun(recording.id, paras.map((p) => ({ n: p.n, text: p.text })))
      if (!r.ok) { if (!r.canceled) setMessage({ kind: 'bad', text: r.message }); return }
      dispatch({ type: 'replace', marks: r.result.marks, regions: r.result.regions })
      reviewIdx.current = 0
      const { located, paragraphs, lowConfidence } = r.result.stats
      setMessage({ kind: lowConfidence ? 'warn' : 'ok', text: `Suggestion ready in ${Math.round(r.seconds)} s — ${located} of ${paragraphs} paragraphs found with confidence; ${lowConfidence} to check.${r.refined && r.refined.moved > 0 ? ` ${r.refined.moved} start${r.refined.moved === 1 ? ' was' : 's were'} moved to where the speech begins.` : ''} Nothing is saved yet.` })
    } finally { off(); setAligning(null) }
  }
  /** Step through the suggested times, least sure first: jump the tape and the list to each. */
  const reviewNext = (): void => {
    const order = st.marks.filter((m) => m.kind === 'start' && m.confidence !== null && m.confidence !== undefined).sort((a, b) => (a.confidence as number) - (b.confidence as number))
    if (!order.length) return
    const m = order[reviewIdx.current % order.length]
    reviewIdx.current++
    rowRefs.current.get(m.n)?.scrollIntoView?.({ block: 'center' })
    if (m.t !== null) { if (mine) command({ type: 'seek', to: Math.max(0, m.t - 1) }); else void load(recording.id, { position: Math.max(0, m.t - 1) }) }
  }
  const tryClose = (): void => { if (st.dirty) setConfirmClose(true); else onClose() }

  // keys: Space = tap, P = play/pause, U or ⌘/Ctrl+Z = undo, ←/→ ±5 s (arrows are handled by the seek bar when focused)
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const tgt = e.target as HTMLElement
    if (tgt.closest('input, select, textarea')) return
    if (e.key === 'Escape') { e.stopPropagation(); tryClose(); return }
    if (e.key === ' ' && !tgt.closest('button, [role=slider]')) { e.preventDefault(); tap(); return }
    if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); dispatch({ type: 'undo' }); return }
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); if (mine) command({ type: 'toggle' }); else void load(recording.id, { play: true }) }
      else if (e.key === 'u' || e.key === 'U') { e.preventDefault(); dispatch({ type: 'undo' }) }
    }
  }

  // the timeline: whole tape, or ±3 minutes around the playhead
  const w0 = zoom === 'tape' ? 0 : Math.max(0, Math.min(dur - 360, position - 180))
  const w1 = zoom === 'tape' ? dur : Math.min(dur, w0 + 360)
  const xOf = (t: number): number => ((t - w0) / (w1 - w0)) * 100
  const tOf = (clientX: number): number => { const r = timelineRef.current!.getBoundingClientRect(); return w0 + Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (w1 - w0) }
  const bars = useMemo(() => {
    if (!activity) return null
    const n = activity.length
    const a = Math.floor((w0 / dur) * n), b = Math.max(a + 1, Math.ceil((w1 / dur) * n))
    return activity.slice(a, b)
  }, [activity, w0, w1, dur])

  const marksShown = st.marks.filter((m) => m.kind === 'start' && m.t !== null && (m.t as number) >= w0 && (m.t as number) <= w1)
  const timed = timedCount(st.marks)
  const lowConf = st.marks.filter((m) => m.kind === 'start' && m.confidence !== null && m.confidence !== undefined && m.confidence < 0.7)

  const row = (p: NumberedParagraph): JSX.Element => {
    const mk = st.marks.find((m) => m.n === p.n)
    const isTarget = target === p.n
    const isNow = here.n === p.n
    return (
      <div
        key={p.n}
        ref={(el) => { if (el) rowRefs.current.set(p.n, el); else rowRefs.current.delete(p.n) }}
        className={`tse-row${isTarget ? ' is-target' : ''}${isNow ? ' is-now' : ''}${!mk ? ' is-untimed' : ''}`}
        onClick={() => setTarget(p.n)}
        role="row"
        aria-label={`Paragraph ${p.n}`}
      >
        <b className="tse-n">{p.n}</b>
        <span className="tse-time">{mk && mk.kind === 'start' && mk.t !== null ? formatTapeTime(mk.t) : mk?.kind === 'skip' ? 'not on tape' : '—'}</span>
        <span className="tse-text" title={p.text}>{p.text.slice(0, 120)}{p.text.length > 120 ? '…' : ''}</span>
        <span className="tse-status">
          {mk?.kind === 'skip' ? <span className="tse-chip">Skipped</span> : mk && mk.confidence !== null && mk.confidence !== undefined ? <span className={`tse-chip${mk.confidence < 0.7 ? ' tse-chip--warn' : ''}`}>auto · {Math.round(mk.confidence * 100)}%</span> : isTarget ? <span className="tse-chip tse-chip--on">next to tap</span> : null}
        </span>
        <span className="tse-adjust" onClick={(e) => e.stopPropagation()}>
          <button className="btn-icon btn-sm" disabled={!mk || mk.t === null} onClick={() => dispatch({ type: 'nudge', n: p.n, by: -0.1 })} aria-label={`Paragraph ${p.n}: 0.1 seconds earlier`} title="0.1 s earlier">−</button>
          <button className="btn-icon btn-sm" disabled={!mk || mk.t === null} onClick={() => dispatch({ type: 'nudge', n: p.n, by: 0.1 })} aria-label={`Paragraph ${p.n}: 0.1 seconds later`} title="0.1 s later">+</button>
          <button className="btn-icon btn-sm" onClick={() => dispatch({ type: 'set', n: p.n, t: tapTime(position, reaction) })} aria-label={`Paragraph ${p.n}: start here`} title="Start here (the tape's position now)"><Clock width={12} height={12} aria-hidden="true" /></button>
          <button className="btn-icon btn-sm" disabled={!mk || mk.t === null} onClick={() => playFrom(mk!.t as number)} aria-label={`Paragraph ${p.n}: play from here`} title="Play from here"><Play width={12} height={12} aria-hidden="true" /></button>
          <button className="btn-icon btn-sm" onClick={() => dispatch({ type: 'skip', n: p.n })} aria-label={`Paragraph ${p.n}: not on this tape`} title="Not on this tape"><SkipForward width={12} height={12} aria-hidden="true" /></button>
          <button className="btn-icon btn-sm" disabled={!mk} onClick={() => dispatch({ type: 'clear', n: p.n })} aria-label={`Paragraph ${p.n}: remove its time`} title="Remove its time"><Trash2 width={12} height={12} aria-hidden="true" /></button>
        </span>
      </div>
    )
  }

  const targetPara = target !== null ? byN.get(target) : null
  return (
    <div className="tse-overlay" onClick={tryClose}>
      <div ref={rootRef} className="tse" role="dialog" aria-modal="true" aria-label="Sync the text to the tape" tabIndex={-1} onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="tse-head">
          <div>
            <div className="tse-caps">Sync · {dateCode} · {sermonTitle}</div>
            <h3>Make the text follow the tape</h3>
          </div>
          <span className="tse-chip tse-chip--on">{timed} of {paras.length} paragraphs timed</span>
          <span style={{ flex: 1 }} />
          <button className="btn-quiet btn-sm" onClick={() => void importMap()}><Upload width={13} height={13} aria-hidden="true" /> Open timing…</button>
          <button className="btn-quiet btn-sm" onClick={() => void exportMap()} disabled={timed === 0}><Download width={13} height={13} aria-hidden="true" /> Share timing…</button>
          <button className="btn-primary btn-sm" onClick={() => void save()} disabled={!st.dirty}><Save width={13} height={13} aria-hidden="true" /> Save</button>
          <button className="btn-icon btn-sm" onClick={tryClose} aria-label="Close"><X width={15} height={15} strokeWidth={2.2} /></button>
        </div>

        {confirmClose && (
          <div className="tse-confirm" role="alert">
            <AlertTriangle width={15} height={15} aria-hidden="true" /> You have changes that are not saved.
            <button className="btn-primary btn-sm" onClick={async () => { await save(); setConfirmClose(false) }}>Save</button>
            <button className="btn-secondary btn-sm" onClick={onClose}>Close without saving</button>
            <button className="btn-quiet btn-sm" onClick={() => setConfirmClose(false)}>Keep editing</button>
          </div>
        )}

        <div className="tse-guide" aria-live="polite">
          {targetPara ? (<><span className="tse-guide-label">Listen for the start of ¶ {targetPara.n}:</span><span className="tse-guide-text">“{targetPara.text.slice(0, 140)}{targetPara.text.length > 140 ? '…' : ''}”</span></>) : <span className="tse-guide-label">{paras.length && timed >= paras.length ? 'Every paragraph has a time. Check it, then Save.' : 'Loading the sermon…'}</span>}
        </div>

        <div className="tse-timeline-wrap">
          <div className="tse-timeline-bar">
            <b>{zoom === 'tape' ? 'Whole tape' : `${formatTapeTime(w0)} – ${formatTapeTime(w1)}`}</b>
            <span className="tse-faint">{activity ? 'Grey bars: where the sound was busy (approximate)' : 'No loudness picture for this file'}</span>
            <span style={{ flex: 1 }} />
            <div className="tse-seg" role="group" aria-label="Zoom">
              <button className={zoom === 'tape' ? 'on' : ''} onClick={() => setZoom('tape')}>Whole tape</button>
              <button className={zoom === 'near' ? 'on' : ''} onClick={() => setZoom('near')}>Around now (6 min)</button>
            </div>
          </div>
          <div
            ref={timelineRef}
            className="tse-timeline"
            onClick={(e) => { const t = tOf(e.clientX); if (mine) command({ type: 'seek', to: t }); else void load(recording.id, { position: t }) }}
            onPointerMove={(e) => { if (drag) setDrag({ ...drag, t: tOf(e.clientX) }) }}
            onPointerUp={() => { if (drag) { dispatch({ type: 'set', n: drag.n, t: drag.t }); setDrag(null) } }}
            role="presentation"
          >
            {bars && <div className="tse-bars" aria-hidden="true">{bars.map((v, i) => <i key={i} style={{ height: `${6 + v * 90}%` }} />)}</div>}
            {st.regions.filter((r) => r.end >= w0 && r.start <= w1).map((r, i) => <div key={i} className={`tse-region tse-region--${r.kind}`} style={{ left: `${Math.max(0, xOf(r.start))}%`, width: `${Math.min(100, xOf(r.end)) - Math.max(0, xOf(r.start))}%` }} title={r.kind === 'gap' ? 'No text here' : 'Tape differs'} />)}
            {regionStart && <div className="tse-region tse-region--open" style={{ left: `${Math.max(0, xOf(regionStart.t))}%`, width: `${Math.max(0.3, xOf(position) - xOf(regionStart.t))}%` }} />}
            {marksShown.map((m) => {
              const t = drag && drag.n === m.n ? drag.t : (m.t as number)
              return (
                <div key={m.n} className={`tse-marker${here.n === m.n ? ' is-now' : ''}${m.confidence !== null && m.confidence !== undefined ? ' is-auto' : ''}`} style={{ left: `${xOf(t)}%` }} onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDrag({ n: m.n, t }) }} onClick={(e) => e.stopPropagation()} title={`¶ ${m.n} · ${formatTapeTime(t)} — drag to move`}>
                  <span>{m.n}</span>
                </div>
              )
            })}
            <div className="tse-playhead" style={{ left: `${xOf(position)}%` }} />
          </div>
        </div>

        <TapeBar recording={recording} paragraphStarts={starts} />

        <div className="tse-actions">
          <button className="btn-primary tse-tap" onClick={tap} disabled={target === null} aria-keyshortcuts="Space"><Hand width={16} height={16} aria-hidden="true" /> Tap = start of ¶ {target ?? '—'} <kbd>Space</kbd></button>
          <button className="btn-secondary btn-sm" onClick={() => dispatch({ type: 'undo' })} disabled={st.past.length === 0}><Undo2 width={13} height={13} aria-hidden="true" /> Undo <kbd>U</kbd></button>
          <button className={`btn-secondary btn-sm${regionStart?.kind === 'gap' ? ' is-on' : ''}`} onClick={() => toggleRegion('gap')}><EyeOff width={13} height={13} aria-hidden="true" /> {regionStart?.kind === 'gap' ? `End “no text” (from ${formatTapeTime(regionStart.t)})` : 'No text here'}</button>
          <button className={`btn-secondary btn-sm${regionStart?.kind === 'differs' ? ' is-on' : ''}`} onClick={() => toggleRegion('differs')}><Flag width={13} height={13} aria-hidden="true" /> {regionStart?.kind === 'differs' ? `End “differs” (from ${formatTapeTime(regionStart.t)})` : 'Tape differs here'}</button>
          <button className="btn-secondary btn-sm" onClick={() => void suggest()} aria-busy={!!aligning}><Sparkles width={13} height={13} aria-hidden="true" /> {aligning ? `Stop (${aligning.phase === 'listen' ? aligning.pct + '%' : aligning.phase === 'prepare' ? 'preparing' : 'matching'})` : 'Suggest timing'}</button>
          <button className="btn-secondary btn-sm" onClick={reviewNext} disabled={!st.marks.some((m) => m.confidence !== null && m.confidence !== undefined)}><ListChecks width={13} height={13} aria-hidden="true" /> Next least sure</button>
          <label className="tse-react" title="People press a little after the word is spoken. This much is taken off each tap.">Reaction <input type="number" min={0} max={2} step={0.05} value={reaction} onChange={(e) => setReaction(Math.max(0, Math.min(2, Number(e.target.value) || 0)))} aria-label="Reaction time in seconds" /> s</label>
          <span className="tse-faint"><kbd>P</kbd> play/pause · <kbd>⌘Z</kbd> undo</span>
        </div>

        {message && <div className={`tse-msg tse-msg--${message.kind}`} role="status">{message.kind === 'ok' ? <Check width={14} height={14} aria-hidden="true" /> : <AlertTriangle width={14} height={14} aria-hidden="true" />} {message.text}</div>}
        {issues.length > 0 && <ul className="tse-issues">{issues.map((i, k) => <li key={k} className={`tse-issue tse-issue--${i.level}`}>{i.message}</li>)}</ul>}

        {st.regions.length > 0 && (
          <div className="tse-regions">
            {st.regions.map((r, i) => (
              <span key={i} className={`tse-chip tse-chip--${r.kind}`}>{r.kind === 'gap' ? 'No text' : 'Differs'} {formatTapeTime(r.start)}–{formatTapeTime(r.end)}
                <button className="btn-icon btn-sm" onClick={() => dispatch({ type: 'region-remove', index: i })} aria-label={`Remove this ${r.kind === 'gap' ? 'no-text' : 'differs'} region`}><X width={11} height={11} aria-hidden="true" /></button>
              </span>
            ))}
          </div>
        )}
        {lowConf.length > 0 && <div className="tse-msg tse-msg--warn"><AlertTriangle width={14} height={14} aria-hidden="true" /> {lowConf.length} proposed time{lowConf.length === 1 ? ' is' : 's are'} low-confidence — check them first.</div>}

        <div className="tse-table" role="table" aria-label="Paragraphs and their start times">
          <div className="tse-row tse-row--head" role="row"><span>¶</span><span>Start</span><span>Text</span><span>Status</span><span>Adjust</span></div>
          <div className="tse-rows" role="rowgroup">{paras.map(row)}</div>
        </div>
      </div>
    </div>
  )
}
