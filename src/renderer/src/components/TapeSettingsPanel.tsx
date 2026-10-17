import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { TapeSettings } from '../../../shared/tape'
import './TapeSettingsPanel.css'

type Opt<T extends string> = Array<[T, string]>

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Opt<T>; onChange: (v: T) => void }): JSX.Element {
  const id = `tsp-${label.replace(/\W+/g, '-')}`
  return (
    <div className="tsp-row">
      <span className="tsp-label" id={id}>{label}</span>
      <div className="tsp-seg" role="radiogroup" aria-labelledby={id}>
        {options.map(([v, text]) => (
          <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'is-on' : ''} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  )
}

/**
 * Settings → Tape service (docs/design/sermon-audio mockup 10). Defaults are the safe ones; every option applies to the NEXT tape, never to what is on
 * the screen now. Only options that really change behaviour are here.
 */
export default function TapeSettingsPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const [s, setS] = useState<TapeSettings | null>(null)
  useEffect(() => { void window.electronAPI.tapeSettingsGet?.()?.then((x) => setS(x as TapeSettings)) }, [])
  const set = <K extends keyof TapeSettings>(k: K, v: TapeSettings[K]): void => {
    setS((cur) => (cur ? { ...cur, [k]: v } : cur))
    void window.electronAPI.tapeSettingsSet?.({ [k]: v } as Partial<TapeSettings>)
  }
  return (
    <div className="tsp-backdrop" onClick={onClose}>
      <div className="tsp" role="dialog" aria-modal="true" aria-label="Tape options" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
        <header><h2>Tape options</h2><button className="btn-icon" onClick={onClose} aria-label="Close"><X width={14} height={14} aria-hidden="true" /></button></header>
        <p className="tsp-note">Defaults are the safe ones. Every option applies to the next tape, never to what is on the screen right now.</p>
        {!s ? <p>Loading…</p> : (
          <>
            <section>
              <h3>How the screens follow</h3>
              <Seg label="Projector view" value={s.view === 'single' ? 'single' : 'highlight'} options={[['highlight', 'Highlight'], ['single', 'One at a time']]} onChange={(v) => set('view', v)} />
              <div className="tsp-row">
                <span className="tsp-label">Show next paragraph early</span>
                <select value={s.leadSec} onChange={(e) => set('leadSec', Number(e.target.value))} aria-label="Show next paragraph early">
                  {[0, 2, 4, 6, 8, 10].map((n) => <option key={n} value={n}>{n === 0 ? 'off' : `${n} s`}</option>)}
                </select>
              </div>
            </section>
            <section>
              <h3>Sound</h3>
              <Seg label="Speed range" value={s.speedRange} options={[['wide', '0.8–1.25×'], ['narrow', '0.9–1.1×'], ['off', 'Off']]} onChange={(v) => set('speedRange', v)} />
              <Seg label="When a video plays" value={s.videoRule} options={[['pause', 'Tape pauses'], ['stop', 'Tape off']]} onChange={(v) => set('videoRule', v)} />
              <Seg label="If the sound device is lost" value={s.deviceLoss} options={[['pause', 'Pause the tape'], ['default', 'Switch to default']]} onChange={(v) => set('deviceLoss', v)} />
            </section>
            <section>
              <h3>Language</h3>
              <Seg label="If numbering differs" value={s.mismatchPolicy} options={[['ask', 'Ask me'], ['matching', 'Matching only'], ['never', 'Never use']]} onChange={(v) => set('mismatchPolicy', v)} />
            </section>
            <section>
              <h3>Safety</h3>
              <Seg label="Esc (blank the screens)" value={s.escRule} options={[['keep', 'Tape keeps playing'], ['pause', 'Also pauses']]} onChange={(v) => set('escRule', v)} />
              <p className="tsp-fixed">Phone: first Play is always the operator’s, and jumping to a paragraph always asks first. Shift+Esc blanks and pauses.</p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
