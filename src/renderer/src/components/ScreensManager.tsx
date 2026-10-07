/**
 * ScreensManager.tsx — "Outputs & Channels", the SETUP surface for screens.
 *
 * Everything configured once (or rarely) lives here, behind "Manage…" in the
 * Screens popover: which display each role uses, adding/removing channels
 * and Graphics outputs, translation/songbook/sync, and the full live Status
 * breakdown. The popover itself (ScreensMenu.tsx) stays short no matter how
 * many channels or outputs exist — this is where that length actually goes.
 *
 * No IPC/behavior change from the old single popover: every control here is
 * the same handler prop, just regrouped into sidebar sections instead of one
 * long scroll.
 */
import { useEffect, useRef, useState } from 'react'
import {
  X,
  TriangleAlert,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  Pencil,
  Play,
  Copy,
  HelpCircle,
  Plus,
  Trash2,
  Monitor,
  LayoutGrid,
  Radio,
  Cast,
  Activity
} from 'lucide-react'
import type {
  DisplayInfo,
  DisplayEntry,
  OutputInfo,
  ChannelInfo,
  ChannelSyncConfig,
  Songbook,
  PresentationProfileId,
  ObservabilityChannel
} from '../types'
import { shortName, summarizeSlide, CHECKLIST_STEPS, roleButtonClass, GraphicsProfilePicker } from './screensShared'

interface Props {
  displayInfo: DisplayInfo | null
  projectionOpen: boolean
  stageOpen: boolean
  onToggleProjection: () => void
  onToggleStage: () => void
  onSetProjectionDisplay: (id: number | null) => void
  onSetStageDisplay: (id: number | null) => void
  onRefreshDisplays: () => void
  onDisplayInfoChange: (info: DisplayInfo) => void
  outputs: OutputInfo[]
  onAddGraphicsOutput: (channelId: string) => void
  onRemoveOutput: (id: string) => void
  onSetOutputProfile: (id: string, profileId: PresentationProfileId) => void
  onSetOutputAutoProfile: (id: string, autoProfile: boolean) => void
  onSetOutputSuppressed: (id: string, suppressed: boolean) => void
  channels: ChannelInfo[]
  availableTranslations: { code: string; name: string }[]
  songbooks: Songbook[]
  onAddChannel: (label: string) => void
  onRemoveChannel: (id: string) => void
  onSetChannelTranslation: (id: string, translation: string) => void
  onSetChannelSongbook: (id: string, songbookId: string) => void
  onSetChannelSync: (id: string, sync: ChannelSyncConfig) => void
  onOpenChannel: (id: string) => void
  obsChannels: ObservabilityChannel[] | null
  initialTab?: Tab
  onClose: () => void
}

type Tab = 'displays' | 'channels' | 'outputs' | 'status'

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

function ScreenRoleGroup(p: RoleProps): JSX.Element {
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

export default function ScreensManager({
  displayInfo,
  projectionOpen,
  stageOpen,
  onToggleProjection,
  onToggleStage,
  onSetProjectionDisplay,
  onSetStageDisplay,
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
  onOpenChannel,
  obsChannels,
  initialTab,
  onClose
}: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'displays')
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [checklistFor, setChecklistFor] = useState<string | null>(null)
  const [diagCopied, setDiagCopied] = useState(false)
  const [urlCopiedId, setUrlCopiedId] = useState<string | null>(null)
  const [addingChannel, setAddingChannel] = useState(false)
  const [channelDraft, setChannelDraft] = useState('')
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Esc closes this modal — same pattern the popover itself already uses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const submitAddChannel = (): void => {
    const label = channelDraft.trim()
    if (label) onAddChannel(label)
    setAddingChannel(false)
    setChannelDraft('')
  }

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

  const copyOutputUrl = (id: string, url: string): void => {
    navigator.clipboard?.writeText(url)
    setUrlCopiedId(id)
    setTimeout(() => setUrlCopiedId((cur) => (cur === id ? null : cur)), 1500)
  }

  const displays = displayInfo?.displays ?? []
  const namedDisplays = displayInfo?.namedDisplays ?? []
  const clash = !!displayInfo?.stageClashesProjection

  const renderPreview = (out: OutputInfo): JSX.Element | null => {
    if (previewId !== out.id || !out.url) return null
    return (
      <div className="screens-preview">
        <iframe src={out.url} title="Graphics output preview" />
      </div>
    )
  }

  /** One channel's full Graphics output block — add/remove, URL + copy,
   *  preview, suppress, and the profile picker. `label` is shown as a small
   *  heading so multiple channels' outputs read clearly stacked in one tab
   *  (see renderOutputsTab) — "group by channel" even inside Outputs. */
  const renderOutputBlock = (channelId: string, label: string): JSX.Element => {
    const out = outputs.find((o) => o.channelId === channelId)
    return (
      <div className="screens-group" key={channelId}>
        <div className="screens-group-head">
          <span className="screens-group-title">{label}</span>
          {!out && (
            <button className="btn-quiet btn-sm" onClick={() => onAddGraphicsOutput(channelId)}>
              <Plus width={13} height={13} strokeWidth={2.4} aria-hidden="true" />
              Add Graphics
            </button>
          )}
        </div>
        {!out ? (
          <p className="screens-note">
            A browser-reachable feed of what's live — for OBS, a lobby display, or a second computer.
          </p>
        ) : (
          <div className="display-rows">
            <div>
              <div className="display-row">
                <span className="display-row-main">
                  <span className="display-row-name">Graphics</span>
                  <span className="display-row-sub">{out.url ?? 'Remote unavailable right now'}</span>
                </span>
                <span className="display-row-actions">
                  {out.url && (
                    <button
                      className="display-row-btn"
                      title="Copy URL"
                      aria-label="Copy Graphics output URL"
                      onClick={() => copyOutputUrl(out.id, out.url!)}
                    >
                      {urlCopiedId === out.id ? (
                        <Check width={14} height={14} strokeWidth={2.4} aria-hidden="true" />
                      ) : (
                        <Copy width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
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
                      <Monitor width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    className="display-row-btn"
                    title={
                      out.suppressed
                        ? 'Show again — independent of what Main is doing'
                        : "Clear just this output — Main keeps showing what it has, this just stops reflecting it"
                    }
                    aria-label={out.suppressed ? 'Show Graphics output' : 'Clear Graphics output'}
                    onClick={() => onSetOutputSuppressed(out.id, !out.suppressed)}
                  >
                    {out.suppressed ? (
                      <EyeOff width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                    ) : (
                      <Eye width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    className="display-row-btn"
                    title="Remove this output"
                    aria-label="Remove Graphics output"
                    onClick={() => onRemoveOutput(out.id)}
                  >
                    <Trash2 width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                </span>
              </div>
              {out.suppressed && (
                <p className="screens-note screens-note--warn">
                  <TriangleAlert width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                  Cleared — Main keeps playing, this output just isn't showing it right now.
                </p>
              )}
              {renderPreview(out)}
              <GraphicsProfilePicker
                out={out}
                onSetOutputProfile={onSetOutputProfile}
                onSetOutputAutoProfile={onSetOutputAutoProfile}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  const openGenericChecklist = (): void => setChecklistFor('')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal screens-manager-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Outputs & Channels">
        <div className="modal-title-row">
          <h3 className="modal-title">Outputs &amp; Channels</h3>
          <button className="btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <X width={15} height={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <div className="screens-manager-body">
          <nav className="screens-manager-sidebar" aria-label="Setup sections">
            <button className={tab === 'displays' ? 'is-active' : ''} onClick={() => setTab('displays')}>
              <Cast width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
              Displays
            </button>
            <button className={tab === 'channels' ? 'is-active' : ''} onClick={() => setTab('channels')}>
              <Radio width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
              Channels
            </button>
            <button className={tab === 'outputs' ? 'is-active' : ''} onClick={() => setTab('outputs')}>
              <LayoutGrid width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
              Outputs
            </button>
            <button className={tab === 'status' ? 'is-active' : ''} onClick={() => setTab('status')}>
              <Activity width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
              Status
            </button>
          </nav>

          <div className="screens-manager-content">
            {tab === 'displays' && (
              <>
                <div className="screens-manager-pane-head">
                  <span>Which screen each role uses</span>
                  <button className="btn-icon btn-sm" onClick={onRefreshDisplays} title="Re-scan connected screens" aria-label="Refresh connected screens">
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
                {checklistFor !== null && (
                  <div className="screens-group display-checklist">
                    <div className="screens-group-head">
                      <span className="screens-group-title">
                        {checklistFor ? `Not seeing “${checklistFor}”?` : 'Not seeing a screen?'}
                      </span>
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
              </>
            )}

            {tab === 'channels' && (
              <>
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
                            </div>
                            <span className="screens-chips">
                              <span className="screens-chip screens-chip-lang">{c.translation}</span>
                              <span className={`screens-chip ${isFollowing ? 'screens-chip-follow' : 'screens-chip-indep'}`}>
                                <span className="screens-chip-dot" aria-hidden="true" />
                                {isFollowing ? 'Following' : 'Independent'}
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
                                    A sermon quote not yet translated shows in English instead. Songs never follow —
                                    drive this channel's own Songs panel directly for those.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}

            {tab === 'outputs' && (
              <>
                {renderOutputBlock('main', 'Main')}
                {channels.map((c) => renderOutputBlock(c.id, c.label))}
              </>
            )}

            {tab === 'status' &&
              (() => {
                const warnings = (obsChannels ?? []).flatMap((c) => c.destinations.filter((d) => d.warning))
                const pillLabel =
                  obsChannels === null ? '…' : warnings.length === 0 ? 'All connected' : `${warnings.length} issue${warnings.length === 1 ? '' : 's'}`
                const pillClass = obsChannels !== null && warnings.length > 0 ? 'screens-status-pill--warn' : 'screens-status-pill--ok'
                return (
                  <>
                    <div className="screens-group">
                      <div className="screens-group-head">
                        <span className="screens-group-title">Status</span>
                        <span className={`screens-status-pill ${pillClass}`}>{pillLabel}</span>
                      </div>
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
                    </div>
                    <div className="screens-group">
                      <button className="btn-quiet btn-sm" onClick={openGenericChecklist}>
                        <HelpCircle width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                        Not seeing a screen? Troubleshooting steps
                      </button>
                      {checklistFor !== null && (
                        <div className="display-checklist">
                          <div className="screens-group-head">
                            <span className="screens-group-title">
                              {checklistFor ? `Not seeing “${checklistFor}”?` : 'Not seeing a screen?'}
                            </span>
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
                    </div>
                  </>
                )
              })()}
          </div>
        </div>
      </div>
    </div>
  )
}
