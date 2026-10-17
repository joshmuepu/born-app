import { useEffect, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import type { Theme } from '../useTheme'
import type { UiScaleChoice } from '../uiScale'
import './AppearanceMenu.css'

/** The ⚙ menu (P-01 / P-11): everything you set once and rarely touch — theme, high contrast, interface size — and the way to Help and the keyboard shortcuts.
 *  The ON AIR controls stay in the header; these do not belong there. */
export const SCALE_OPTIONS: Array<[UiScaleChoice, string]> = [['auto', 'Automatic for this screen'], [1, '100 %'], [1.25, '125 %'], [1.5, '150 %'], [1.75, '175 %']]

export default function AppearanceMenu({
  theme,
  onTheme,
  contrast,
  onContrast,
  uiScale,
  onUiScale,
  clickShows,
  onClickShows,
  autoRun,
  onAutoRun,
  onShowSetup,
  onHelp,
  onShortcuts
}: {
  theme: Theme
  onTheme: (t: Theme) => void
  contrast: boolean
  onContrast: (on: boolean) => void
  uiScale: UiScaleChoice
  onUiScale: (c: UiScaleChoice) => void
  /** P-08: a single click shows a verse, slide or paragraph (how earlier versions worked). Off: a click selects; Enter or a double-click shows. */
  clickShows: boolean
  onClickShows: (on: boolean) => void
  /** bring back the first-run "Set up Sunday" checklist */
  onShowSetup: () => void
  /** P-06: switch to Run view when the screens open (and there is a queue) */
  autoRun: boolean
  onAutoRun: (on: boolean) => void
  onHelp: () => void
  onShortcuts: () => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const seg = (label: string, on: boolean, run: () => void): JSX.Element => (
    <button type="button" className={`am-seg${on ? ' is-on' : ''}`} aria-pressed={on} onClick={run}>{label}</button>
  )
  const act = (fn: () => void) => (): void => { setOpen(false); fn() }

  return (
    <div className="appearance-menu" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className={`btn-icon am-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Settings and help"
        title="Appearance, interface size, Help and keyboard shortcuts"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings width={16} height={16} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div className="am-pop" role="dialog" aria-label="Appearance and help">
          <div className="am-h">Appearance</div>
          <div className="am-row">
            <span className="am-label" id="am-theme">Theme</span>
            <div className="am-segs" role="group" aria-labelledby="am-theme">
              {seg('Dark', theme === 'dark', () => onTheme('dark'))}
              {seg('Light', theme === 'light', () => onTheme('light'))}
            </div>
          </div>
          <div className="am-row">
            <span className="am-label" id="am-contrast">Contrast</span>
            <div className="am-segs" role="group" aria-labelledby="am-contrast">
              {seg('Normal', !contrast, () => onContrast(false))}
              {seg('High', contrast, () => onContrast(true))}
            </div>
          </div>
          <div className="am-row">
            <label className="am-label" htmlFor="am-scale">Interface size</label>
            <select id="am-scale" className="am-select" value={String(uiScale)} onChange={(e) => onUiScale(e.target.value === 'auto' ? 'auto' : (Number(e.target.value) as UiScaleChoice))}>
              {SCALE_OPTIONS.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
            </select>
          </div>
          <div className="am-h am-h--help">Verses, slides and paragraphs</div>
          <label className="am-check">
            <input type="checkbox" checked={clickShows} onChange={(e) => onClickShows(e.target.checked)} />
            <span>A single click shows it<small>Off: a click selects; Enter or a double-click shows. The Show button always shows.</small></span>
          </label>
          <label className="am-check">
            <input type="checkbox" checked={autoRun} onChange={(e) => onAutoRun(e.target.checked)} />
            <span>Switch to Run view when the screens open<small>Run view is the queue and the live controls, large. Ctrl/⌘+Shift+U switches by hand.</small></span>
          </label>
          <div className="am-h am-h--help">Help</div>
          <button type="button" className="am-item" onClick={act(onHelp)}>Open the manual <kbd>F1</kbd></button>
          <button type="button" className="am-item" onClick={act(onShortcuts)}>Keyboard shortcuts <kbd>?</kbd></button>
          <button type="button" className="am-item" onClick={act(onShowSetup)}>Show the Set up Sunday checklist</button>
        </div>
      )}
    </div>
  )
}
