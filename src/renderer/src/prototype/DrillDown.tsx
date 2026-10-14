/**
 * Born Again — Sermons drill-down PROTOTYPE (design Phase 1).
 *
 * Isolated: reachable only at `?proto=drilldown` (or Ctrl+Alt+Shift+D) and not
 * imported by the real app shell. Uses real data via window.electronAPI
 * (getBrowseDateTree → getSermonsByIds → getSermonParagraphs), read-only.
 * "Project" / "Queue" are stubbed to a toast so it can't affect a live service.
 *
 * Columns:  Year → Month → Sermon   →  Reading pane (right, large).
 * Each finished column collapses into a slim rail showing its selection; the
 * whole column grid can slide away ( \ or the handle ) to give the reading pane
 * the full width, and back.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DateTree, SermonIndexItem, Quote } from '../types'
import './DrillDown.css'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
type Level = 0 | 1 | 2 | 3 // 0 pick year, 1 pick month, 2 pick sermon, 3 reading (sermon list stays as the active column)

export default function DrillDown(): JSX.Element {
  const [tree, setTree] = useState<DateTree | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const [sermons, setSermons] = useState<SermonIndexItem[]>([])
  const [sermon, setSermon] = useState<SermonIndexItem | null>(null)
  const [paras, setParas] = useState<Quote[] | null>(null)
  const [hidden, setHidden] = useState(false) // grid slid away
  const [cursor, setCursor] = useState(0)
  const [toast, setToast] = useState('')
  const [narrow, setNarrow] = useState(window.innerWidth < 900)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI.getBrowseDateTree().then((t) => setTree(t as DateTree))
    const onR = (): void => setNarrow(window.innerWidth < 900)
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [])

  const level: Level = sermon ? 3 : month != null ? 2 : year != null ? 1 : 0
  const yearNode = useMemo(() => tree?.years.find((y) => y.year === year) ?? null, [tree, year])
  const monthNode = useMemo(() => yearNode?.months.find((m) => m.month === month) ?? null, [yearNode, month])

  useEffect(() => {
    if (!monthNode) { setSermons([]); return }
    const ids = [...monthNode.days.flatMap((d) => d.ids), ...monthNode.unknownDayIds]
    let live = true
    window.electronAPI.getSermonsByIds(ids).then((s) => live && setSermons(s))
    return () => { live = false }
  }, [monthNode])

  useEffect(() => {
    if (!sermon) { setParas(null); return }
    let live = true
    setParas(null)
    window.electronAPI.getSermonParagraphs(sermon.id, 'en').then((p) => live && setParas(p))
    return () => { live = false }
  }, [sermon])

  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(''), 1800) }, [])

  const back = useCallback(() => {
    setHidden(false)
    if (sermon) setSermon(null)
    else if (month != null) setMonth(null)
    else if (year != null) setYear(null)
    setCursor(0)
  }, [sermon, month, year])

  const items: Array<{ key: string; label: string; sub: string; pick: () => void }> = useMemo(() => {
    if (!tree) return []
    if (level === 0) return tree.years.map((y) => ({ key: 'y' + y.year, label: String(y.year), sub: `${y.count}`, pick: () => { setYear(y.year); setCursor(0) } }))
    if (level === 1 && yearNode) return yearNode.months.map((m) => ({ key: 'm' + m.month, label: MONTHS[m.month - 1] ?? `Month ${m.month}`, sub: `${m.count}`, pick: () => { setMonth(m.month); setCursor(0) } }))
    return sermons.map((s) => ({ key: 's' + s.id, label: s.title, sub: `${s.date_code} · ${s.para_count}¶`, pick: () => { setSermon(s) } }))
  }, [tree, level, yearNode, sermons])

  // Keyboard model: ↑/↓ move, →/Enter go deeper, ←/Backspace/Esc back, \ toggle grid, / search (stub)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement
      if (t && /input|textarea|select/i.test(t.tagName)) return
      if (e.key === 'ArrowDown') { setCursor((c) => Math.min(c + 1, items.length - 1)); e.preventDefault() }
      else if (e.key === 'ArrowUp') { setCursor((c) => Math.max(c - 1, 0)); e.preventDefault() }
      else if ((e.key === 'Enter' || e.key === 'ArrowRight') && level < 3) { items[cursor]?.pick(); e.preventDefault() }
      else if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'ArrowLeft') { back(); e.preventDefault() }
      else if (e.key === '\\') { setHidden((h) => !h); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, cursor, level, back])

  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('.dd-item[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, level])

  // Which levels render as slim rails (completed) vs the active column.
  const rails: Array<{ lvl: Level; text: string }> = []
  if (year != null && level >= 1) rails.push({ lvl: 0, text: String(year) })
  if (month != null && level >= 2) rails.push({ lvl: 1, text: MONTHS[month - 1].slice(0, 3) })
  const goTo = (lvl: Level): void => {
    setHidden(false)
    if (lvl === 0) { setYear(null); setMonth(null); setSermon(null) }
    if (lvl === 1) { setMonth(null); setSermon(null) }
    setCursor(0)
  }
  const title = level === 0 ? 'Year' : level === 1 ? `Months of ${year}` : `${MONTHS[(month ?? 1) - 1]} ${year}`

  const activeList = (
    <div className="dd-col dd-col--active" role="listbox" aria-label={title}>
      <div className="dd-col-head">{title}</div>
      {!tree && Array.from({ length: 8 }, (_, i) => <div key={i} className="dd-skel" />)}
      {items.map((it, i) => (
        <button key={it.key} className="dd-item" data-open={sermon != null && it.key === 's' + sermon.id} data-cursor={i === cursor} role="option" aria-selected={i === cursor}
          onMouseEnter={() => setCursor(i)} onClick={it.pick}>
          <span className="dd-item-label">{it.label}</span>
          <span className="dd-item-sub">{it.sub}</span>
        </button>
      ))}
      {tree && items.length === 0 && <div className="dd-empty">Nothing here yet.</div>}
    </div>
  )

  const showReading = level === 3
  // Narrow windows: single column stack — either the list or the reading pane.
  const stack = narrow
  return (
    <div className="dd-root" ref={rootRef} data-hidden={hidden} data-stack={stack}>
      <header className="dd-top">
        <span className="dd-crumbs" aria-label="Breadcrumb">
          <button className="dd-crumb" onClick={() => { setYear(null); setMonth(null); setSermon(null) }}>Sermons</button>
          {year != null && <><span>›</span><button className="dd-crumb" onClick={() => goTo(0)}>{year}</button></>}
          {month != null && <><span>›</span><button className="dd-crumb" onClick={() => goTo(1)}>{MONTHS[month - 1]}</button></>}
          {sermon && <><span>›</span><span className="dd-crumb dd-crumb--cur">{sermon.title}</span></>}
        </span>
        <span className="dd-hint">↑↓ move · → open · ← back · \ grid</span>
      </header>
      <div className="dd-body">
        {!(stack && showReading) && (
          <div className="dd-grid">
            {!stack && rails.map((r) => (
              <button key={r.lvl} className="dd-rail" onClick={() => goTo(r.lvl)} title="Back to this level">
                <span className="dd-rail-text">{r.text}</span>
              </button>
            ))}
            {activeList}
          </div>
        )}
        {showReading && (
          <>
            <section className="dd-read dd-read--rel" aria-label="Sermon text">
              {!stack && (
              <button className="dd-handle" onClick={() => setHidden((h) => !h)} aria-label={hidden ? 'Show browse columns' : 'Hide browse columns'} title="Toggle columns ( \ )">
                {hidden ? '›' : '‹'}
              </button>
              )}
              <div className="dd-read-head">
                {stack && <button className="dd-btn" onClick={back}>‹ Back</button>}
                <div>
                  <div className="dd-read-title">{sermon?.title}</div>
                  <div className="dd-read-meta">{sermon?.date_code} · {sermon?.para_count} paragraphs · {sermon?.duration_min} min</div>
                </div>
              </div>
              <div className="dd-read-scroll">
                {paras === null && Array.from({ length: 6 }, (_, i) => <div key={i} className="dd-skel dd-skel--p" />)}
                {paras?.map((p) => (
                  <article key={p.paragraphRef} className="dd-para">
                    <span className="dd-para-ref">{p.paragraphRef.split(':').pop()}</span>
                    <p>{p.text}</p>
                    <span className="dd-para-actions">
                      <button className="dd-btn" onClick={() => flash(`Queued ¶${p.paragraphRef} (prototype — nothing was added)`)}>Queue</button>
                      <button className="dd-btn dd-btn--primary" onClick={() => flash(`Would project ¶${p.paragraphRef} (prototype — nothing projected)`)}>Project</button>
                    </span>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
        {!showReading && !stack && (
          <section className="dd-read dd-read--idle">
            <div className="dd-idle">Choose a sermon — it opens here, large.</div>
          </section>
        )}
      </div>
      <div className="dd-toast" data-on={!!toast} role="status">{toast}</div>
    </div>
  )
}
