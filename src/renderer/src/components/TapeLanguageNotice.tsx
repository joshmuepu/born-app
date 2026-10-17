import { useState } from 'react'
import { AlertTriangle, Link2, X } from 'lucide-react'
import { formatRanges, type Agreement, type MismatchDecision, type Override } from '../../../shared/tapeLanguage'
import './TapeLanguageNotice.css'

/**
 * Shown when a text's paragraph numbers do not match the tape's timing (a translation that merged or split a paragraph). It says WHERE they differ, lets the
 * operator choose what to do, and lines up differences with an override table ("this text's ¶113 is the tape's ¶115"). It never changes what is on a screen.
 */
export default function TapeLanguageNotice({ agreement, decision, overrides, textLabel, onChoose, onSaveOverrides }: {
  agreement: Agreement
  decision: MismatchDecision
  overrides: Override[]
  textLabel: string
  onChoose: (c: 'matching' | 'never' | null) => void
  onSaveOverrides: (rows: Override[]) => void | Promise<void>
}): JSX.Element | null {
  const [fixing, setFixing] = useState(false)
  const [textN, setTextN] = useState('')
  const [mapN, setMapN] = useState('')
  if (agreement.ok && overrides.length === 0) return null
  const add = (): void => {
    const t = Number(textN), m = Number(mapN)
    if (!Number.isInteger(t) || !Number.isInteger(m) || t < 1 || m < 1 || t === m) return
    void onSaveOverrides([...overrides.filter((o) => o.textN !== t), { textN: t, mapN: m }].sort((a, b) => a.textN - b.textN))
    setTextN(''); setMapN('')
  }
  return (
    <div className={`tln${decision === 'never' ? ' is-never' : ''}`} role="group" aria-label="Paragraph numbers differ">
      {!agreement.ok ? (
        <p className="tln-msg"><AlertTriangle width={14} height={14} aria-hidden="true" /> <span>{textLabel}: {agreement.message}</span></p>
      ) : (
        <p className="tln-msg tln-msg--ok"><Link2 width={14} height={14} aria-hidden="true" /> <span>{textLabel}: the numbers now line up ({overrides.length} adjusted).</span></p>
      )}
      <div className="tln-actions">
        {decision === 'never' ? (
          <><span className="tln-state">Not following this text.</span><button className="btn-secondary btn-sm" onClick={() => onChoose(null)}>Follow anyway</button></>
        ) : decision === 'matching' ? (
          <><span className="tln-state">Following the matching numbers only.</span><button className="btn-secondary btn-sm" onClick={() => onChoose('never')}>Don’t follow this text</button></>
        ) : (
          <>
            {!agreement.ok && <button className="btn-secondary btn-sm" onClick={() => onChoose('matching')}>Use matching numbers only</button>}
            {!agreement.ok && <button className="btn-secondary btn-sm" onClick={() => onChoose('never')}>Don’t follow this text</button>}
          </>
        )}
        <button className="btn-secondary btn-sm" aria-expanded={fixing} onClick={() => setFixing((v) => !v)}>{fixing ? 'Done' : 'Line up the differences…'}</button>
      </div>
      {fixing && (
        <div className="tln-fix">
          <p className="tln-hint">
            {agreement.textOnly.length > 0 && <>Only in the text: <b>{formatRanges(agreement.textOnly)}</b>. </>}
            {agreement.mapOnly.length > 0 && <>Only in the timing: <b>{formatRanges(agreement.mapOnly)}</b>. </>}
            Say which timing paragraph a text paragraph really is.
          </p>
          <div className="tln-row">
            <label>Text ¶ <input type="number" min={1} value={textN} onChange={(e) => setTextN(e.target.value)} aria-label="Text paragraph number" /></label>
            <span aria-hidden="true">is the timing’s ¶</span>
            <input type="number" min={1} value={mapN} onChange={(e) => setMapN(e.target.value)} aria-label="Timing paragraph number" />
            <button className="btn-primary btn-sm" onClick={add} disabled={!textN || !mapN}>Add</button>
          </div>
          {overrides.length > 0 && (
            <ul className="tln-list" aria-label="Adjustments">
              {overrides.map((o) => (
                <li key={o.textN}>Text ¶{o.textN} → timing ¶{o.mapN} <button className="btn-icon btn-sm" aria-label={`Remove the adjustment for text paragraph ${o.textN}`} onClick={() => void onSaveOverrides(overrides.filter((x) => x.textN !== o.textN))}><X width={11} height={11} aria-hidden="true" /></button></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
