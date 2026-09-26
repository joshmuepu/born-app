import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  TriangleAlert,
  RefreshCw,
  Eye,
  Play,
  Pencil,
  Check,
  X,
  Copy,
  HelpCircle
} from 'lucide-react'
import type { DisplayInfo, DisplayEntry } from '../types'

interface Props {
  displayInfo: DisplayInfo | null
  projectionOpen: boolean
  stageOpen: boolean
  fontSize: number
  onToggleProjection: () => void
  onToggleStage: () => void
  onSetProjectionDisplay: (id: number | null) => void
  onSetStageDisplay: (id: number | null) => void
  onFontSize: (delta: number) => void
  /** Re-scan connected screens without restarting the app — a manual escape
   *  hatch for the rare case a monitor was plugged in before this menu was
   *  ever opened, or a hotplug event didn't fire on some hardware. */
  onRefreshDisplays: () => void
  /** Pushes a fresh DisplayInfo (from rename) back up to App's state, the
   *  same way onSetProjectionDisplay's own return value does. */
  onDisplayInfoChange: (info: DisplayInfo) => void
}

/** "PA278QV (2) (2560×1440)" → "PA278QV (2)". */
function shortName(label: string): string {
  const m = /^(.*?)\s*\(\d{3,}[×x]\d{3,}/.exec(label)
  return (m ? m[1] : label).trim()
}

interface RoleProps {
  role: 'projection' | 'stage'
  title: string
  isOpen: boolean
  onToggle: () => void
  displays: DisplayEntry[]
  namedDisplays: { name: string; connected: boolean }[]
  targetId: number | null
  targetName: string | null
  isOverride: boolean
  missingOverrideName: string | null
  isWindowed?: boolean
  clash?: boolean
  onSelect: (id: number | null) => void
  renamingId: number | null
  onStartRename: (id: number) => void
  onCancelRename: () => void
  onSaveRename: (id: number, name: string) => void
  onIdentify: (id: number) => void
  onTestPattern: (id: number) => void
  busyAction: string | null
  missingStreak: Record<string, number>
  onOpenChecklist: (name: string) => void
}

function ScreenRoleGroup(p: RoleProps) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (p.renamingId != null) {
      const d = p.displays.find((x) => x.id === p.renamingId)
      setDraft(d?.name || shortName(d?.shortLabel ?? ''))
      requestAnimationFrame(() => inputRef.current?.select())
    }
  }, [p.renamingId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Named displays that aren't currently among the connected list — shown as
  // a distinct greyed row instead of just disappearing, so a screen that was
  // remembered but isn't here right now (unplugged, powered off, or hitting
  // a real hardware/driver ceiling) is still visible and explained.
  const connectedNames = new Set(p.displays.map((d) => d.name).filter(Boolean))
  const missingNamed = p.namedDisplays.filter((n) => !n.connected && !connectedNames.has(n.name))

  const autoLabel = p.isWindowed
    ? 'Automatic — floating window'
    : p.targetName || (p.targetId != null ? shortName(p.displays.find((d) => d.id === p.targetId)?.shortLabel ?? '') : '')

  return (
    <div className="screens-group">
      <div className="screens-group-head">
        <span className="screens-group-title">{p.title}</span>
        <button
          className={p.isOpen ? 'btn-quiet btn-sm' : roleButtonClass(p.role)}
          onClick={p.onToggle}
        >
          {p.isOpen ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      {(p.role === 'projection' || p.isOpen) && (p.displays.length > 1 || missingNamed.length > 0) && (
        <div className="display-rows">
          {p.displays.length > 1 && (
          <button
            className={`display-row${!p.isOverride ? ' is-selected' : ''}`}
            onClick={() => p.onSelect(null)}
          >
            <span className="display-row-main">
              <span className="display-row-name">Automatic</span>
              <span className="display-row-sub">{autoLabel ? `Currently: ${autoLabel}` : ''}</span>
            </span>
            {!p.isOverride && <Check width={15} height={15} strokeWidth={2.4} aria-hidden="true" />}
          </button>
          )}

          {p.displays.length > 1 && p.displays.map((d) => {
            const selected = p.isOverride && p.targetId === d.id
            const isRenaming = p.renamingId === d.id
            const label = d.name || shortName(d.shortLabel)
            return (
              <div key={d.id} className={`display-row${selected ? ' is-selected' : ''}${isRenaming ? ' is-renaming' : ''}`}>
                {isRenaming ? (
                  <>
                    <input
                      ref={inputRef}
                      className="display-rename-input"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') p.onSaveRename(d.id, draft)
                        if (e.key === 'Escape') p.onCancelRename()
                      }}
                      placeholder={shortName(d.shortLabel)}
                      maxLength={40}
                    />
                    <button
                      className="display-row-btn"
                      title="Save name"
                      aria-label="Save name"
                      onClick={() => p.onSaveRename(d.id, draft)}
                    >
                      <Check width={14} height={14} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                    <button className="display-row-btn" title="Cancel" aria-label="Cancel" onClick={p.onCancelRename}>
                      <X width={14} height={14} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <>
                    <button className="display-row-select" onClick={() => p.onSelect(d.id)}>
                      <span className="display-row-main">
                        <span className="display-row-name">{label}</span>
                        {d.name && <span className="display-row-sub">{shortName(d.shortLabel)}</span>}
                      </span>
                      {selected && <Check width={15} height={15} strokeWidth={2.4} aria-hidden="true" />}
                    </button>
                    <span className="display-row-actions">
                      <button
                        className="display-row-btn"
                        title="Flash this display so you can see which one it is"
                        aria-label={`Identify ${label}`}
                        disabled={p.busyAction != null}
                        onClick={() => p.onIdentify(d.id)}
                      >
                        <Eye width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                      </button>
                      <button
                        className="display-row-btn"
                        title="Show sample projected text on this display"
                        aria-label={`Test pattern on ${label}`}
                        disabled={p.busyAction != null}
                        onClick={() => p.onTestPattern(d.id)}
                      >
                        <Play width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                      </button>
                      <button
                        className="display-row-btn"
                        title="Name this display"
                        aria-label={`Rename ${label}`}
                        onClick={() => p.onStartRename(d.id)}
                      >
                        <Pencil width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                      </button>
                    </span>
                  </>
                )}
              </div>
            )
          })}

          {missingNamed.map((n) => {
            const isActiveMissing = p.missingOverrideName === n.name
            const streak = p.missingStreak[n.name] ?? 0
            return (
              <div key={n.name} className={`display-row display-row--missing${isActiveMissing ? ' is-warn' : ''}`}>
                <span className="display-row-main">
                  <span className="display-row-name">{n.name}</span>
                  <span className="display-row-sub">Not detected</span>
                </span>
                {isActiveMissing && streak >= 2 && (
                  <button
                    className="display-row-btn"
                    title="Not seeing a screen you expect?"
                    aria-label="Troubleshoot missing display"
                    onClick={() => p.onOpenChecklist(n.name)}
                  >
                    <HelpCircle width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {p.role === 'projection' && p.displays.length <= 1 && missingNamed.length === 0 && (
        <p className="screens-note">Only one screen connected — projection will use this one.</p>
      )}
      {p.role === 'stage' && p.isOpen && p.isWindowed && (
        <p className="screens-note">No spare screen — the stage monitor is a floating window you can move.</p>
      )}
      {p.role === 'stage' && p.isOpen && p.clash && (
        <p className="screens-note screens-note--warn">
          <TriangleAlert width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
          The stage monitor is on the same screen as the projection — pick a different one.
        </p>
      )}
      {p.role === 'stage' && !p.isOpen && (
        <p className="screens-note">A second screen for the platform: current slide, what’s next, and the time.</p>
      )}
    </div>
  )
}

function roleButtonClass(role: 'projection' | 'stage'): string {
  return role === 'projection' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'
}

const CHECKLIST_STEPS = [
  'Check the cable is in a native HDMI/DisplayPort port on the computer itself — not a USB-C hub or dock. Hubs are a common, silent point of failure for exactly this.',
  'On Windows: Win+P → make sure it’s set to "Extend", not "PC screen only" or disconnected. Settings → System → Display → click Detect if it’s not listed.',
  'On Mac: System Settings → Displays → click Detect Displays (hold Option while the menu is open on older macOS).',
  'If it still won’t show up, your computer may have hit its maximum number of simultaneous displays (common with a laptop’s built-in graphics). If you have a video switcher (e.g. an ATEM), try routing this screen through its output instead of plugging it directly into the computer.'
]

export default function ScreensMenu({
  displayInfo,
  projectionOpen,
  stageOpen,
  fontSize,
  onToggleProjection,
  onToggleStage,
  onSetProjectionDisplay,
  onSetStageDisplay,
  onFontSize,
  onRefreshDisplays,
  onDisplayInfoChange
}: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [checklistFor, setChecklistFor] = useState<string | null>(null)
  const [diagCopied, setDiagCopied] = useState(false)

  // How many consecutive display-info updates a given named display has been
  // missing — the checklist link only appears once this crosses 2, so a
  // screen that's simply still booting up doesn't immediately look broken.
  const missingStreakRef = useRef<Record<string, number>>({})
  const [missingStreak, setMissingStreak] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!displayInfo) return
    const next: Record<string, number> = {}
    for (const n of displayInfo.namedDisplays) {
      const prev = missingStreakRef.current[n.name] ?? 0
      next[n.name] = n.connected ? 0 : prev + 1
    }
    missingStreakRef.current = next
    setMissingStreak(next)
  }, [displayInfo])

  // Ambient signal: pulse the trigger briefly whenever the connected-screen
  // count changes, so a hotplug or a screen dropping mid-service registers
  // peripherally without needing this menu open to notice.
  const prevCountRef = useRef<number | null>(null)
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    const count = displayInfo?.displays.length ?? 0
    if (prevCountRef.current != null && prevCountRef.current !== count) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 1200)
      return () => clearTimeout(t)
    }
    prevCountRef.current = count
    return undefined
  }, [displayInfo?.displays.length])
  useEffect(() => {
    prevCountRef.current = displayInfo?.displays.length ?? null
  }, [displayInfo?.displays.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setRenamingId(null)
        setChecklistFor(null)
      }
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false)
        setRenamingId(null)
        setChecklistFor(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const displays = displayInfo?.displays ?? []
  const namedDisplays = displayInfo?.namedDisplays ?? []
  const clash = !!displayInfo?.stageClashesProjection
  const count = displays.length

  const handleIdentify = async (id: number): Promise<void> => {
    setBusyAction(`identify-${id}`)
    try {
      await window.electronAPI.identifyDisplay(id)
    } finally {
      setBusyAction(null)
    }
  }

  const handleTestPattern = async (id: number): Promise<void> => {
    setBusyAction(`test-${id}`)
    try {
      await window.electronAPI.testPatternDisplay(id)
    } finally {
      setBusyAction(null)
    }
  }

  const handleSaveRename = async (id: number, name: string): Promise<void> => {
    const trimmed = name.trim()
    setRenamingId(null)
    if (!trimmed) return
    const info = await window.electronAPI.renameDisplay(id, trimmed)
    onDisplayInfoChange(info)
  }

  const copyDiagnostics = async (): Promise<void> => {
    const text = await window.electronAPI.getDisplayDiagnostics()
    navigator.clipboard?.writeText(text)
    setDiagCopied(true)
    setTimeout(() => setDiagCopied(false), 1500)
  }

  return (
    <div className="screens-menu" ref={wrapRef}>
      <button
        className={`btn-secondary screens-trigger${open ? ' is-open' : ''}${pulse ? ' is-pulsing' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Choose which screens the congregation and the platform see"
      >
        <span className={`screens-dot${projectionOpen ? ' is-live' : ''}`} />
        Screens
        {count > 0 && <span className="screens-count">{count}</span>}
        <ChevronDown className="screens-caret" width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
      </button>

      {open && (
        <div className="screens-popover" role="dialog" aria-label="Screen setup">
          <div className="screens-popover-head">
            <span className="screens-popover-title">Screen setup</span>
            <button
              className="btn-icon screens-refresh"
              onClick={onRefreshDisplays}
              title="Re-scan connected screens — use this if one you just plugged in isn't showing up"
              aria-label="Refresh connected screens"
            >
              <RefreshCw width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>

          <ScreenRoleGroup
            role="projection"
            title="Congregation screen"
            isOpen={projectionOpen}
            onToggle={onToggleProjection}
            displays={displays}
            namedDisplays={namedDisplays}
            targetId={displayInfo?.targetId ?? null}
            targetName={displayInfo?.targetName ?? null}
            isOverride={!!displayInfo?.isOverride}
            missingOverrideName={displayInfo?.missingOverrideName ?? null}
            onSelect={onSetProjectionDisplay}
            renamingId={renamingId}
            onStartRename={setRenamingId}
            onCancelRename={() => setRenamingId(null)}
            onSaveRename={handleSaveRename}
            onIdentify={handleIdentify}
            onTestPattern={handleTestPattern}
            busyAction={busyAction}
            missingStreak={missingStreak}
            onOpenChecklist={setChecklistFor}
          />

          <ScreenRoleGroup
            role="stage"
            title="Stage monitor"
            isOpen={stageOpen}
            onToggle={onToggleStage}
            displays={displays}
            namedDisplays={namedDisplays}
            targetId={displayInfo?.stageTargetId ?? null}
            targetName={displayInfo?.stageTargetName ?? null}
            isOverride={!!displayInfo?.stageIsOverride}
            missingOverrideName={displayInfo?.stageMissingOverrideName ?? null}
            isWindowed={!!displayInfo?.stageIsWindowed}
            clash={clash}
            onSelect={onSetStageDisplay}
            renamingId={renamingId}
            onStartRename={setRenamingId}
            onCancelRename={() => setRenamingId(null)}
            onSaveRename={handleSaveRename}
            onIdentify={handleIdentify}
            onTestPattern={handleTestPattern}
            busyAction={busyAction}
            missingStreak={missingStreak}
            onOpenChecklist={setChecklistFor}
          />

          {checklistFor && (
            <div className="screens-group display-checklist">
              <div className="screens-group-head">
                <span className="screens-group-title">Not seeing “{checklistFor}”?</span>
                <button className="btn-icon btn-sm" onClick={() => setChecklistFor(null)} aria-label="Close">
                  <X width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
              <ol className="display-checklist-list">
                {CHECKLIST_STEPS.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <button className="btn-secondary btn-sm display-copy-btn" onClick={copyDiagnostics}>
                {diagCopied ? (
                  <>
                    <Check width={13} height={13} strokeWidth={2.4} aria-hidden="true" /> Copied
                  </>
                ) : (
                  <>
                    <Copy width={13} height={13} strokeWidth={2.2} aria-hidden="true" /> Copy diagnostic info
                  </>
                )}
              </button>
              <p className="screens-note">Paste this into a message to whoever handles tech support.</p>
            </div>
          )}

          {/* Text size */}
          <div className="screens-group">
            <div className="screens-group-head">
              <span className="screens-group-title">Projected text size</span>
              <div className="screens-textsize">
                <button className="btn-secondary btn-sm" onClick={() => onFontSize(-0.25)} disabled={fontSize <= 1.5} aria-label="Smaller">−</button>
                <span className="screens-textsize-val">{Math.round((fontSize / 4.5) * 100)}%</span>
                <button className="btn-secondary btn-sm" onClick={() => onFontSize(0.25)} disabled={fontSize >= 8} aria-label="Larger">+</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
