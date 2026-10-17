import { useMemo } from 'react'
import { MonitorPlay, MonitorOff, AlertTriangle } from 'lucide-react'
import { missingScripts } from '../tapeFonts'
import type { SyncMap, TapeRecording } from '../../../shared/tape'
import type { TapePalette, TapeScreenItem, TapeScreenMode } from '../../../shared/tapeScreen'
import { useTapeScreen } from '../useTapeScreen'
import './TapeScreenControls.css'

type Mode = Extract<TapeScreenMode, 'highlight' | 'one'>
const MODE_LABEL: Record<Mode, string> = { highlight: 'Highlight', one: 'One at a time' }

/**
 * Put the sermon on the congregation screen as a TAPE screen (the paragraph being spoken follows the tape), choose how it looks, and decide whether the
 * screens follow the tape. Nothing here starts sound or moves the tape. Taking is an explicit button — nothing changes what is live by itself.
 */
export default function TapeScreenControls({ recording, sermonId, title, items, map, position, onTaken, textLanguage }: {
  recording: TapeRecording
  sermonId: number
  title: string
  items?: TapeScreenItem[]
  map: SyncMap | null
  /** the tape's position right now (to say what is on the screen when it is taken) */
  position?: number
  /** told when the operator puts the tape on the screens, with the page showing (for "Recently played") */
  onTaken?: (item: TapeScreenItem | null) => void
  textLanguage?: string
}): JSX.Element | null {
  const t = useTapeScreen({ recording, sermonId, title, map, items, position, onTaken, textLanguage })
  // a script this computer has no font for would show boxes on the screens: say so before Take, never after
  const noFont = useMemo(() => missingScripts(t.items.map((i) => i.text).join(' ').slice(0, 4000)), [t.items])
  if (!map) return null
  return (
    <div className="tape-screen-row" role="group" aria-label="Tape on the screens">
      <div className="tse-seg" role="radiogroup" aria-label="How the screens show the tape">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <button key={m} role="radio" aria-checked={t.mode === m} className={t.mode === m ? 'is-on' : ''} onClick={() => t.chooseMode(m)}>{MODE_LABEL[m]}</button>
        ))}
      </div>
      {t.mode === 'one' && (
        <label className="tape-screen-lead" title="Show the next paragraph this long before the speaker reaches it">
          Next early <select value={t.lead} onChange={(e) => t.chooseLead(Number(e.target.value))} aria-label="Show the next paragraph early, seconds">
            {[0, 2, 4, 6, 8, 10].map((n) => <option key={n} value={n}>{n === 0 ? 'off' : `${n} s`}</option>)}
          </select>
        </label>
      )}
      <label className="tape-screen-lead">
        Colours <select value={t.palette} onChange={(e) => t.setPalette(e.target.value as TapePalette)} aria-label="Screen colours">
          <option value="dark">Dark</option><option value="light">Light</option><option value="contrast">High contrast</option>
        </select>
      </label>
      {t.onScreens ? (
        <>
          <button className={`tape-toggle${t.follows ? ' on' : ''}`} role="switch" aria-checked={t.follows} onClick={t.toggleFollow} title="When off, the screens stay on this paragraph while the tape and the reader move on">
            <i aria-hidden="true" /> Screens follow the tape
          </button>
          {t.changed && <button className="btn-primary btn-sm" onClick={t.apply}>Apply to the screens</button>}
          <button className="btn-secondary btn-sm" onClick={t.takeOff}><MonitorOff width={13} height={13} aria-hidden="true" /> Take off the screens</button>
        </>
      ) : (
        <button className="btn-primary btn-sm" onClick={t.take} disabled={!t.ready}><MonitorPlay width={13} height={13} aria-hidden="true" /> Put on the screens</button>
      )}
      {noFont.length > 0 && (
        <p className="tape-screen-warn" role="alert"><AlertTriangle width={13} height={13} aria-hidden="true" /> This text uses {noFont.join(', ')} script, and this computer has no font for it — the screens would show empty boxes. Install a font for it first.</p>
      )}
    </div>
  )
}

/** The reader's flat list as screen items (numbered paragraphs only). */
export function screenItems(flat: Array<{ marker: string; text: string }>, baseNumber: (m: string) => number | null): TapeScreenItem[] {
  const out: TapeScreenItem[] = []
  for (const f of flat) {
    const n = baseNumber(f.marker)
    if (n !== null && f.text.trim()) out.push({ n, marker: f.marker, text: f.text })
  }
  return out
}
export const useScreenItems = (flat: Array<{ marker: string; text: string }>, baseNumber: (m: string) => number | null): TapeScreenItem[] => useMemo(() => screenItems(flat, baseNumber), [flat, baseNumber])
