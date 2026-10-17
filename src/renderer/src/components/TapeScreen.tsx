import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { TapeScreenSpec } from '../../../shared/tapeScreen'
import { describeView, tapeScreenView } from '../../../shared/tapeScreen'
import { formatTapeTime } from '../../../shared/tape'
import { useTape } from '../useTape'
import { useAutoFitFontSize } from '../useAutoFitFontSize'
import './TapeScreen.css'

/**
 * What the congregation screen shows while a tape runs: the HIGHLIGHT view (a screenful of the sermon, the spoken paragraph bright with a big number,
 * the rest dimmed, gliding as the tape moves) or ONE AT A TIME (the paragraph fills the screen and changes as the tape moves, optionally a few seconds
 * early). It follows the same tape state the operator's player gets; it never moves the tape and never makes sound.
 */
export default function TapeScreen({ spec, baseRem }: { spec: TapeScreenSpec; baseRem: number }): JSX.Element {
  const { wire, pos } = useTape(100)
  const mine = !!wire && wire.recordingId === spec.recordingId
  // an unloaded or different tape: hold the first paragraph's position rather than showing a wrong one
  const view = useMemo(() => tapeScreenView(spec, mine ? pos : 0), [spec, mine, pos])
  // keep what is on screen while the tape is in a "no text here" stretch
  const held = useRef<number | null>(null)
  if (view.index !== null && !view.hold) held.current = view.index
  const index = view.hold ? held.current : view.index
  const palette = spec.palette ?? 'dark'

  return (
    <div className={`tapescreen tapescreen--${spec.mode} tapescreen--${palette}`} data-index={index ?? ''} role="presentation">
      <div className="tapescreen-live" aria-live="polite" aria-atomic="true">{describeView(view)}</div>
      {spec.mode === 'one' ? <One spec={spec} index={index} view={view} baseRem={baseRem} pos={pos} mine={mine} /> : <Highlight spec={spec} index={index} />}
      <div className="tapescreen-foot" aria-hidden="true">
        <span>{spec.title}</span>
        <span>{mine && wire ? `${formatTapeTime(pos)}${wire.status !== 'playing' ? ' · paused' : ''}` : 'tape not started'}</span>
      </div>
    </div>
  )
}

function Highlight({ spec, index }: { spec: TapeScreenSpec; index: number | null }): JSX.Element {
  const scroller = useRef<HTMLDivElement>(null)
  const rows = useRef<Map<number, HTMLElement>>(new Map())
  const [vh, setVh] = useState(() => window.innerHeight)
  const [y, setY] = useState(0)
  useLayoutEffect(() => {
    const onResize = (): void => setVh(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // the spoken page rests at about 21 % from the top of the frame
  useLayoutEffect(() => {
    const el = index === null ? null : rows.current.get(index)
    setY(el ? -(el.offsetTop - vh * 0.21) : 0)
  }, [index, vh, spec.items])
  const curN = index === null ? null : spec.items[index]?.n ?? null
  return (
    <div className="tapescreen-viewport">
      <div className="tapescreen-scroll" ref={scroller} style={{ transform: `translateY(${y}px)` }}>
        {spec.items.map((it, i) => {
          const cur = i === index
          const sameN = !cur && curN !== null && it.n === curN
          const startOfN = i === 0 || spec.items[i - 1].n !== it.n
          return (
            <div key={i} dir="auto" ref={(el) => { if (el) rows.current.set(i, el); else rows.current.delete(i) }} className={`tapescreen-para${cur ? ' is-cur' : sameN ? ' is-same' : ''}`} aria-current={cur ? 'true' : undefined}>
              <span className="tapescreen-no" aria-hidden="true">{startOfN ? it.n : ''}</span>
              <p className="tapescreen-tx" dir="auto">{it.text}</p>
            </div>
          )
        })}
      </div>
      <div className="tapescreen-fade tapescreen-fade--t" aria-hidden="true" />
      <div className="tapescreen-fade tapescreen-fade--b" aria-hidden="true" />
    </div>
  )
}

function One({ spec, index, view, baseRem, pos, mine }: { spec: TapeScreenSpec; index: number | null; view: ReturnType<typeof tapeScreenView>; baseRem: number; pos: number; mine: boolean }): JSX.Element {
  const it = index === null ? null : spec.items[index]
  const textRef = useRef<HTMLDivElement>(null)
  const fit = useAutoFitFontSize(textRef, it ? it.text + index : null, baseRem * 0.92, 0.9)
  const next = view.next
  // the bar fills across the paragraph being spoken; its label counts down to the next one
  const frac = view.progress ?? 0
  return (
    <>
      <div className="tapescreen-one" key={it ? it.n + ':' + view.page : 'none'}>
        {it ? (
          <>
            <span className="tapescreen-no tapescreen-no--big" aria-hidden="true">{it.n}</span>
            <div className="tapescreen-onetext" ref={textRef} style={{ fontSize: `${fit}rem` }}>
              <p className="tapescreen-tx" dir="auto">{it.text}</p>
            </div>
          </>
        ) : (
          <p className="tapescreen-wait">{mine ? '' : spec.title}</p>
        )}
      </div>
      {next && (
        <div className="tapescreen-next" aria-hidden="true">
          <span className="tapescreen-nextlabel">NEXT ¶{next.n}</span>
          <span className="tapescreen-bar"><i style={{ width: `${Math.round(frac * 100)}%` }} /></span>
          <span className="tapescreen-nexttime">{mine ? `in ${formatTapeTime(next.inSec)}` : ''}</span>
        </div>
      )}
      <span hidden>{pos}</span>
    </>
  )
}
