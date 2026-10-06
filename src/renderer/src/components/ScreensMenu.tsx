import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  TriangleAlert,
  RefreshCw,
  Eye,
  EyeOff,
  Play,
  Pencil,
  Check,
  X,
  Copy,
  HelpCircle,
  Plus,
  Trash2,
  Monitor
} from 'lucide-react'
import type {
  DisplayInfo,
  DisplayEntry,
  OutputInfo,
  ChannelInfo,
  ChannelSyncConfig,
  Songbook,
  PresentationProfileId,
  ObservabilityChannel,
  SlidePayload
} from '../types'

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
  /** Destinations beyond the built-in congregation/stage pair — today, a
   *  Graphics output, at most one per channel. Empty for every user who
   *  hasn't asked for one. Covers every channel's outputs, not just Main's —
   *  this component filters by channelId itself. */
  outputs: OutputInfo[]
  onAddGraphicsOutput: (channelId: string) => void
  onRemoveOutput: (id: string) => void
  onSetOutputProfile: (id: string, profileId: PresentationProfileId) => void
  /** Auto picks Full-screen/Lower third per live content kind instead of a
   *  fixed choice — see shared/presentationProfiles.ts's DEFAULT_CONTENT_PROFILES. */
  onSetOutputAutoProfile: (id: string, autoProfile: boolean) => void
  /** Independent of what Main is actually showing — clearing Graphics here
   *  doesn't touch the congregation screen, the stage monitor, or Main's own
   *  navigation position, and vice versa. */
  onSetOutputSuppressed: (id: string, suppressed: boolean) => void
  /** Every channel beyond the built-in 'main' — empty for every user who
   *  hasn't added one. Label is operator-chosen; nothing here assumes what a
   *  second channel is "for". */
  channels: ChannelInfo[]
  availableTranslations: { code: string; name: string }[]
  songbooks: Songbook[]
  onAddChannel: (label: string) => void
  onRemoveChannel: (id: string) => void
  onSetChannelTranslation: (id: string, translation: string) => void
  onSetChannelSongbook: (id: string, songbookId: string) => void
  onSetChannelSync: (id: string, sync: ChannelSyncConfig) => void
  /** Opens the scaled-down operator view for driving this channel's content. */
  onOpenChannel: (id: string) => void
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
  ambiguous?: boolean
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
      {p.isOverride && p.ambiguous && (
        <p className="screens-note screens-note--warn">
          <TriangleAlert width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
          Two identical displays are connected — can't tell them apart with certainty, so this
          might be the wrong one. Confirm it's showing on the right screen.
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

/** One short line for "what's live" on the Status section — a reference/
 *  label when the content has one (every Bible verse and sermon quote does),
 *  falling back to the raw text for a song slide, which has neither. */
function summarizeSlide(slide: SlidePayload): string {
  return slide.reference ?? slide.label ?? slide.text.slice(0, 60)
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
  onDisplayInfoChange,
  outputs,
  onAddGraphicsOutput,
  onRemoveOutput,
  onSetOutputProfile,
  onSetOutputAutoProfile,
  onSetOutputSuppressed,
  channels,
  availableTranslations,
  songbooks,
  onAddChannel,
  onRemoveChannel,
  onSetChannelTranslation,
  onSetChannelSongbook,
  onSetChannelSync,
  onOpenChannel
}: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [checklistFor, setChecklistFor] = useState<string | null>(null)
  const [diagCopied, setDiagCopied] = useState(false)
  const [urlCopiedId, setUrlCopiedId] = useState<string | null>(null)
  const [addingChannel, setAddingChannel] = useState(false)
  const [channelDraft, setChannelDraft] = useState('')
  /** Which channel's detail panel is open, if any — collapsed rows are the
   *  default so a multi-channel setup still reads as a short list, same as
   *  the Displays section above it. Only one open at a time: there's rarely
   *  a reason to compare two channels' settings side by side, and keeping
   *  it singular keeps the popover from growing unboundedly tall again. */
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null)

  /** Status section — collapsed by default (progressive disclosure, same as
   *  Outputs/Channels above). A single fetch on menu-open keeps the collapsed
   *  pill honest without polling for a panel nobody's looking at; polling
   *  only kicks in once the section itself is actually expanded, since this
   *  is a live monitor meant to be glanced at, not a push-subscribed view. */
  const [statusOpen, setStatusOpen] = useState(false)
  const [obsChannels, setObsChannels] = useState<ObservabilityChannel[] | null>(null)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const fetchObs = (): void => {
      window.electronAPI.getObservability().then((data) => {
        if (!cancelled) setObsChannels(data)
      })
    }
    fetchObs()
    const interval = statusOpen ? setInterval(fetchObs, 1500) : null
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [open, statusOpen])

  /** At most one Graphics output's preview open at a time — same reasoning
   *  as expandedChannelId: nothing needs two side by side, and keeping it
   *  singular keeps the popover from growing tall for no reason. */
  const [previewId, setPreviewId] = useState<string | null>(null)

  const submitAddChannel = (): void => {
    const label = channelDraft.trim()
    if (label) onAddChannel(label)
    setAddingChannel(false)
    setChannelDraft('')
  }

  /** Auto/Full-screen/Lower third — picking a fixed option also turns Auto
   *  off, since choosing one by hand is explicitly opting out of "picks it
   *  automatically." Shared between Main's own Outputs row and a channel's
   *  compact one so the two never drift apart. */
  const renderProfilePicker = (out: OutputInfo): JSX.Element => (
    <div className="screens-seg" role="group" aria-label="Graphics look">
      <button
        className={out.autoProfile ? 'on' : ''}
        title="Picks Full-screen or Lower third automatically from what's live — song, Bible verse, or sermon quote"
        onClick={() => onSetOutputAutoProfile(out.id, true)}
      >
        Auto
      </button>
      <button
        className={!out.autoProfile && out.profileId !== 'lower-third' ? 'on' : ''}
        title="Replace the whole frame — a lobby TV or a dedicated slide"
        onClick={() => {
          onSetOutputAutoProfile(out.id, false)
          onSetOutputProfile(out.id, 'fullscreen')
        }}
      >
        Full-screen
      </button>
      <button
        className={!out.autoProfile && out.profileId === 'lower-third' ? 'on' : ''}
        title="A small overlay band near the bottom, transparent otherwise — for OBS over camera video"
        onClick={() => {
          onSetOutputAutoProfile(out.id, false)
          onSetOutputProfile(out.id, 'lower-third')
        }}
      >
        Lower third
      </button>
    </div>
  )

  /** Reuses the exact URL/page a real OBS Browser Source would load — an
   *  operator sees precisely what it looks like, not a React approximation
   *  of it that could quietly drift from the real renderer. */
  const renderPreview = (out: OutputInfo): JSX.Element | null => {
    if (previewId !== out.id || !out.url) return null
    return (
      <div className="screens-preview">
        <iframe src={out.url} title="Graphics output preview" />
      </div>
    )
  }

  /** Same Graphics add/remove/profile/suppress controls Main's own Outputs
   *  section uses below, scoped to one channel — kept as one function instead
   *  of a second component so both call sites share copyOutputUrl/
   *  urlCopiedId without threading them through props. */
  const renderOutputsFor = (channelId: string): JSX.Element => {
    const channelOutputs = outputs.filter((o) => o.channelId === channelId)
    return (
      <div className="screens-group">
        <div className="screens-group-head">
          <span className="screens-group-title">Outputs</span>
          {channelOutputs.length === 0 && (
            <button className="btn-quiet btn-sm" onClick={() => onAddGraphicsOutput(channelId)}>
              <Plus width={13} height={13} strokeWidth={2.4} aria-hidden="true" />
              Add Graphics
            </button>
          )}
        </div>
        {channelOutputs.length === 0 ? (
          <p className="screens-note">
            A browser-reachable feed of what's live — for OBS, a lobby display, or a second computer.
          </p>
        ) : (
          <div className="display-rows">
            {channelOutputs.map((o) => (
              <div key={o.id}>
                <div className="display-row">
                  <span className="display-row-main">
                    <span className="display-row-name">Graphics</span>
                    <span className="display-row-sub">{o.url ?? 'Remote unavailable right now'}</span>
                  </span>
                  <span className="display-row-actions">
                    {o.url && (
                      <button
                        className="display-row-btn"
                        title="Copy URL"
                        aria-label="Copy Graphics output URL"
                        onClick={() => copyOutputUrl(o.id, o.url!)}
                      >
                        {urlCopiedId === o.id ? (
                          <Check width={14} height={14} strokeWidth={2.4} aria-hidden="true" />
                        ) : (
                          <Copy width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                        )}
                      </button>
                    )}
                    {o.url && (
                      <button
                        className={`display-row-btn${previewId === o.id ? ' is-active' : ''}`}
                        title="Preview what this output actually looks like"
                        aria-label="Preview Graphics output"
                        onClick={() => setPreviewId((cur) => (cur === o.id ? null : o.id))}
                      >
                        <Monitor width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      className="display-row-btn"
                      title={
                        o.suppressed
                          ? 'Show again — independent of what Main is doing'
                          : 'Clear just this output — Main keeps showing what it has, this just stops reflecting it'
                      }
                      aria-label={o.suppressed ? 'Show Graphics output' : 'Clear Graphics output'}
                      onClick={() => onSetOutputSuppressed(o.id, !o.suppressed)}
                    >
                      {o.suppressed ? (
                        <EyeOff width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                      ) : (
                        <Eye width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                      )}
                    </button>
                    <button
                      className="display-row-btn"
                      title="Remove this output"
                      aria-label="Remove Graphics output"
                      onClick={() => onRemoveOutput(o.id)}
                    >
                      <Trash2 width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  </span>
                </div>
                {o.suppressed && (
                  <p className="screens-note screens-note--warn">
                    <TriangleAlert width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                    Cleared — Main keeps playing, this output just isn't showing it right now.
                  </p>
                )}
                {renderPreview(o)}
                {renderProfilePicker(o)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  /** A channel's Output, inside its expanded detail panel — one compact row
   *  plus an inline profile switch, not a repeated copy of Main's whole
   *  Outputs section (own header, own help sentence). The concept is
   *  explained once, for Main, above; a channel just needs the controls. */
  const renderCompactOutputFor = (channelId: string): JSX.Element => {
    const out = outputs.find((o) => o.channelId === channelId)
    if (!out) {
      return (
        <button className="btn-quiet btn-sm" onClick={() => onAddGraphicsOutput(channelId)}>
          <Plus width={13} height={13} strokeWidth={2.4} aria-hidden="true" />
          Add Graphics output
        </button>
      )
    }
    return (
      <>
        <div className="screens-compact-output-row">
          <span className="screens-compact-output-url">{out.url ?? 'Remote unavailable right now'}</span>
          {out.url && (
            <button
              className="display-row-btn"
              title="Copy URL"
              aria-label="Copy Graphics output URL"
              onClick={() => copyOutputUrl(out.id, out.url!)}
            >
              {urlCopiedId === out.id ? (
                <Check width={13} height={13} strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <Copy width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
              )}
            </button>
          )}
          {out.url && (
            <button
              className={`display-row-btn${previewId === out.id ? ' is-active' : ''}`}
              title="Preview what this output actually looks like"
              aria-label="Preview Graphics output"
              onClick={() => setPreviewId((cur) => (cur === out.id ? null : out.id))}
            >
              <Monitor width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
          <button
            className="display-row-btn"
            title={
              out.suppressed
                ? 'Show again — independent of what Main is doing'
                : 'Clear just this output — Main keeps showing what it has, this just stops reflecting it'
            }
            aria-label={out.suppressed ? 'Show Graphics output' : 'Clear Graphics output'}
            onClick={() => onSetOutputSuppressed(out.id, !out.suppressed)}
          >
            {out.suppressed ? (
              <EyeOff width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <Eye width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
            )}
          </button>
          <button
            className="display-row-btn"
            title="Remove this output"
            aria-label="Remove Graphics output"
            onClick={() => onRemoveOutput(out.id)}
          >
            <Trash2 width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        {out.suppressed && (
          <p className="screens-note screens-note--warn">
            <TriangleAlert width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
            Cleared — Main keeps playing, this output just isn't showing it right now.
          </p>
        )}
        {renderPreview(out)}
        {renderProfilePicker(out)}
      </>
    )
  }

  const copyOutputUrl = (id: string, url: string): void => {
    navigator.clipboard?.writeText(url)
    setUrlCopiedId(id)
    setTimeout(() => setUrlCopiedId((cur) => (cur === id ? null : cur)), 1500)
  }

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
            ambiguous={!!displayInfo?.ambiguous}
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
            ambiguous={!!displayInfo?.stageAmbiguous}
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

          {/* Outputs — same progressive-disclosure shape as the two groups
              above: nothing here for the typical single-screen user beyond
              one quiet entry point, until they actually add something. */}
          {renderOutputsFor('main')}

          {/* Channels — a second (or third, etc.) independent content/
              navigation feed, each operator-labelled, each with its own
              translation and its own Outputs. Always-visible "+ Add channel"
              since, unlike Graphics, there's no cap on how many. */}
          <div className="screens-group">
            <div className="screens-group-head">
              <span className="screens-group-title">Channels</span>
              {!addingChannel && (
                <button className="btn-quiet btn-sm" onClick={() => setAddingChannel(true)}>
                  <Plus width={13} height={13} strokeWidth={2.4} aria-hidden="true" />
                  Add channel
                </button>
              )}
            </div>
            {addingChannel && (
              <div className="display-row is-renaming">
                <input
                  className="display-rename-input"
                  value={channelDraft}
                  onChange={(e) => setChannelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitAddChannel()
                    if (e.key === 'Escape') {
                      setAddingChannel(false)
                      setChannelDraft('')
                    }
                  }}
                  placeholder="Channel name (e.g. Spanish)"
                  maxLength={40}
                  autoFocus
                />
                <button className="display-row-btn" title="Add channel" aria-label="Add channel" onClick={submitAddChannel}>
                  <Check width={14} height={14} strokeWidth={2.4} aria-hidden="true" />
                </button>
                <button
                  className="display-row-btn"
                  title="Cancel"
                  aria-label="Cancel"
                  onClick={() => {
                    setAddingChannel(false)
                    setChannelDraft('')
                  }}
                >
                  <X width={14} height={14} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
            )}
            {channels.length === 0 && !addingChannel ? (
              <p className="screens-note">
                An independent content feed for another audience or language — its own navigation, its own
                translation, its own outputs.
              </p>
            ) : (
              channels.map((c) => {
                const isExpanded = expandedChannelId === c.id
                const hasOutput = outputs.some((o) => o.channelId === c.id)
                const isFollowing = c.sync.syncMode === 'follow'
                return (
                  <div key={c.id}>
                    <div
                      className="screens-channel-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedChannelId(isExpanded ? null : c.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setExpandedChannelId(isExpanded ? null : c.id)
                        }
                      }}
                    >
                      <div className="screens-channel-top">
                        <span className="screens-channel-name">{c.label}</span>
                        <button
                          className="display-row-btn"
                          title={`Open ${c.label}`}
                          aria-label={`Open ${c.label}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenChannel(c.id)
                          }}
                        >
                          <Play width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                        <button
                          className="display-row-btn"
                          title="Remove this channel"
                          aria-label={`Remove ${c.label}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveChannel(c.id)
                          }}
                        >
                          <Trash2 width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                        <ChevronDown
                          className="screens-channel-chevron"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : undefined }}
                          width={14}
                          height={14}
                          strokeWidth={2.2}
                          aria-hidden="true"
                        />
                      </div>
                      <span className="screens-chips">
                        <span className="screens-chip screens-chip-lang">{c.translation}</span>
                        <span className={`screens-chip ${isFollowing ? 'screens-chip-follow' : 'screens-chip-indep'}`}>
                          <span className="screens-chip-dot" aria-hidden="true" />
                          {isFollowing ? 'Following' : 'Independent'}
                        </span>
                        <span className={`screens-chip ${hasOutput ? 'screens-chip-live' : 'screens-chip-off'}`}>
                          <span className="screens-chip-dot" aria-hidden="true" />
                          {hasOutput ? 'Graphics' : 'Off'}
                        </span>
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="screens-channel-detail">
                        <div className="screens-detail-cols">
                          <div className="screens-field">
                            <span className="screens-field-label">Translation</span>
                            <select
                              className="screens-select"
                              value={c.translation}
                              onChange={(e) => onSetChannelTranslation(c.id, e.target.value)}
                            >
                              {availableTranslations.map((t) => (
                                <option key={t.code} value={t.code}>
                                  {t.code}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="screens-field">
                            <span className="screens-field-label">Songbook</span>
                            <select
                              className="screens-select"
                              value={c.songbookId}
                              onChange={(e) => onSetChannelSongbook(c.id, e.target.value)}
                            >
                              {songbooks.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="screens-field">
                          <span className="screens-field-label">Sync</span>
                          <div className="screens-seg" role="group" aria-label={`${c.label} sync`}>
                            <button
                              className={!isFollowing ? 'on' : ''}
                              title="Driven on its own, by whoever opens it"
                              onClick={() => onSetChannelSync(c.id, { syncMode: 'independent' })}
                            >
                              Independent
                            </button>
                            <button
                              className={isFollowing ? 'on' : ''}
                              title="Automatically shows whatever Main shows — the same Bible verse or sermon quote, re-resolved in this channel's own translation/language"
                              onClick={() => onSetChannelSync(c.id, { syncMode: 'follow', linkedTo: 'main' })}
                            >
                              Follow Main
                            </button>
                          </div>
                          {isFollowing && (
                            <p className="screens-note">
                              A sermon quote not yet translated shows in English instead. Songs never follow — drive
                              this channel's own Songs panel directly for those.
                            </p>
                          )}
                        </div>
                        <div className="screens-field">
                          <span className="screens-field-label">Output</span>
                          {renderCompactOutputFor(c.id)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Status — what's live and whether it's actually reaching anyone,
              for every channel. Collapsed by default: the pill alone answers
              "is everything fine?" for the common case, same progressive-
              disclosure shape as Outputs/Channels above it. */}
          {(() => {
            const warnings = (obsChannels ?? []).flatMap((c) => c.destinations.filter((d) => d.warning))
            const pillLabel =
              obsChannels === null ? '…' : warnings.length === 0 ? 'All connected' : `${warnings.length} issue${warnings.length === 1 ? '' : 's'}`
            const pillClass = obsChannels !== null && warnings.length > 0 ? 'screens-status-pill--warn' : 'screens-status-pill--ok'
            return (
              <div className="screens-group">
                <div
                  className="screens-status-head"
                  role="button"
                  tabIndex={0}
                  onClick={() => setStatusOpen((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setStatusOpen((v) => !v)
                    }
                  }}
                >
                  <span className="screens-group-title">Status</span>
                  <span className={`screens-status-pill ${pillClass}`}>{pillLabel}</span>
                  <ChevronDown
                    className="screens-channel-chevron"
                    style={{ transform: statusOpen ? 'rotate(180deg)' : undefined }}
                    width={13}
                    height={13}
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                </div>
                {statusOpen && (
                  <div className="screens-status-list">
                    {(obsChannels ?? []).map((c) => (
                      <div key={c.id} className="screens-status-channel">
                        <div className="screens-status-channel-head">
                          <span className="screens-status-channel-name">{c.label}</span>
                          {c.current ? (
                            <span className="screens-status-current">{summarizeSlide(c.current)}</span>
                          ) : (
                            <span className="screens-status-current screens-status-current--idle">Nothing live</span>
                          )}
                          {c.current?.translationFallback && (
                            <span
                              className="screens-chip screens-chip-warn"
                              title="This channel's own translation has no version of this content — showing English instead"
                            >
                              Fallback: English
                            </span>
                          )}
                          {c.blanked && <span className="screens-chip screens-chip-off">Blanked</span>}
                        </div>
                        {c.destinations.length === 0 ? (
                          <p className="screens-note">No destinations routed to this channel.</p>
                        ) : (
                          <div className="screens-status-destinations">
                            {c.destinations.map((d) => (
                              <div
                                key={d.id}
                                className={`screens-status-dest${d.warning ? ' is-warn' : d.connected ? ' is-ok' : ' is-off'}`}
                              >
                                <span className="screens-status-dot" aria-hidden="true" />
                                <span className="screens-status-dest-label">{d.label}</span>
                                <span className="screens-status-dest-state">{d.warning ?? (d.connected ? '' : 'Off')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

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
