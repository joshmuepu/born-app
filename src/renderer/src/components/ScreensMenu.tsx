/**
 * ScreensMenu.tsx — the Screens popover: QUICK, LIVE actions and at-a-glance
 * status only. Stays short no matter how many channels or outputs exist —
 * everything configured once (which display, add/remove channel or output,
 * translation/songbook/sync) lives behind "Manage…" in ScreensManager.tsx.
 *
 * No IPC/behavior change from the old single popover — every handler here is
 * the same prop the old all-in-one popover received; this file only changes
 * what's shown where.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, TriangleAlert, Eye, EyeOff, Play, Settings2 } from 'lucide-react'
import type {
  DisplayInfo,
  OutputInfo,
  ChannelInfo,
  ChannelSyncConfig,
  Songbook,
  PresentationProfileId,
  ObservabilityChannel
} from '../types'
import { shortName, summarizeSlide, GraphicsProfilePicker, profileLabel } from './screensShared'
import ScreensManager from './ScreensManager'

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

type ManagerTab = 'displays' | 'channels' | 'outputs' | 'status'

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
}: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const [managerTab, setManagerTab] = useState<ManagerTab>('displays')
  /** Which channel's live mini-detail is expanded, if any — collapsed rows
   *  are the default so the list stays short regardless of channel count. */
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null)

  const openManager = (tab: ManagerTab): void => {
    setManagerTab(tab)
    setManagerOpen(true)
    setOpen(false)
  }

  // Live status — fetched as soon as the popover opens, polled continuously
  // while the popover or Manage is open (not gated behind a nested toggle):
  // warnings now show inline on each row by default, so this has to be
  // fresh before the operator expands anything.
  const [obsChannels, setObsChannels] = useState<ObservabilityChannel[] | null>(null)
  useEffect(() => {
    if (!open && !managerOpen) return
    let cancelled = false
    const fetchObs = (): void => {
      window.electronAPI.getObservability().then((data) => {
        if (!cancelled) setObsChannels(data)
      })
    }
    fetchObs()
    const interval = setInterval(fetchObs, 1500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [open, managerOpen])

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
      }
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const count = displayInfo?.displays.length ?? 0

  // Setup-category issues — the ones Manage actually resolves (which
  // display, a stage/projection clash). Live content warnings (fallback,
  // dropped destination) already show inline on their own row, so they
  // don't also need to light up the Manage entry point.
  const setupNeedsAttention =
    !!displayInfo?.ambiguous ||
    !!displayInfo?.stageAmbiguous ||
    !!displayInfo?.missingOverrideName ||
    !!displayInfo?.stageMissingOverrideName ||
    (!!displayInfo?.stageClashesProjection && stageOpen)

  const warningCount = (obsChannels ?? []).flatMap((c) => c.destinations.filter((d) => d.warning)).length
  const statusPillLabel = obsChannels === null ? '…' : warningCount === 0 ? 'All connected' : `${warningCount} issue${warningCount === 1 ? '' : 's'}`
  const statusPillWarn = obsChannels !== null && warningCount > 0

  const mainOutput = outputs.find((o) => o.channelId === 'main')

  const congregationWarning = displayInfo?.missingOverrideName
    ? `“${displayInfo.missingOverrideName}” not detected — using ${displayInfo.targetName ?? 'a different screen'} instead.`
    : displayInfo?.ambiguous
      ? "Two identical displays connected — confirm this is the right one."
      : null

  const stageWarning = !stageOpen
    ? null
    : displayInfo?.stageMissingOverrideName
      ? `“${displayInfo.stageMissingOverrideName}” not detected${displayInfo.stageIsWindowed ? ' — using a floating window instead.' : '.'}`
      : displayInfo?.stageClashesProjection
        ? 'Same screen as the congregation display — pick a different one in Manage.'
        : displayInfo?.stageAmbiguous
          ? 'Two identical displays connected — confirm this is the right one.'
          : null

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
        <div className="screens-popover" role="dialog" aria-label="Screens">
          <div className="screens-popover-head">
            <span className="screens-popover-title">Screens</span>
            <div className="screens-popover-head-actions">
              <span className={`screens-status-pill ${statusPillWarn ? 'screens-status-pill--warn' : 'screens-status-pill--ok'}`}>
                {statusPillLabel}
              </span>
              <button className="btn-quiet btn-sm screens-manage-btn" onClick={() => openManager('displays')}>
                {setupNeedsAttention && <span className="screens-manage-warn" aria-hidden="true" />}
                <Settings2 width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                Manage…
              </button>
            </div>
          </div>

          <div className="screens-popover-body">
            {/* Congregation screen — quick on/off only; which display is SETUP. */}
            <div className="screens-group screens-live-row">
              <div className="screens-group-head">
                <span className="screens-group-title">Congregation</span>
                <button
                  className={projectionOpen ? 'btn-quiet btn-sm' : 'btn-primary btn-sm'}
                  onClick={onToggleProjection}
                >
                  {projectionOpen ? 'Turn off' : 'Turn on'}
                </button>
              </div>
              <p className="screens-note">
                {displayInfo?.targetName
                  ? shortName(displayInfo.targetName)
                  : displayInfo && displayInfo.displays.length > 0
                    ? 'Automatic'
                    : 'No screen detected'}
              </p>
              {congregationWarning && (
                <p className="screens-note screens-note--warn">
                  <TriangleAlert width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                  {congregationWarning}
                </p>
              )}
            </div>

            {/* Stage monitor — same shape. */}
            <div className="screens-group screens-live-row">
              <div className="screens-group-head">
                <span className="screens-group-title">Stage</span>
                <button className={stageOpen ? 'btn-quiet btn-sm' : 'btn-secondary btn-sm'} onClick={onToggleStage}>
                  {stageOpen ? 'Turn off' : 'Turn on'}
                </button>
              </div>
              {stageOpen && (
                <p className="screens-note">
                  {displayInfo?.stageIsWindowed
                    ? 'Floating window'
                    : displayInfo?.stageTargetName
                      ? shortName(displayInfo.stageTargetName)
                      : 'Automatic'}
                </p>
              )}
              {stageWarning && (
                <p className="screens-note screens-note--warn">
                  <TriangleAlert width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                  {stageWarning}
                </p>
              )}
            </div>

            {/* Main's Graphics output — suppress/show and profile are live;
                add/remove/URL/preview are SETUP, in Manage. */}
            <div className="screens-group screens-live-row">
              <div className="screens-group-head">
                <span className="screens-group-title">Graphics</span>
                {mainOutput ? (
                  <button
                    className="display-row-btn"
                    title={mainOutput.suppressed ? 'Show again' : 'Clear just this output'}
                    aria-label={mainOutput.suppressed ? 'Show Graphics output' : 'Clear Graphics output'}
                    onClick={() => onSetOutputSuppressed(mainOutput.id, !mainOutput.suppressed)}
                  >
                    {mainOutput.suppressed ? (
                      <EyeOff width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                    ) : (
                      <Eye width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  <button className="btn-quiet btn-sm" onClick={() => openManager('outputs')}>
                    Add in Manage…
                  </button>
                )}
              </div>
              {mainOutput && (
                <>
                  {mainOutput.suppressed && (
                    <p className="screens-note screens-note--warn">
                      <TriangleAlert width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                      Cleared — Main keeps playing, this output just isn't showing it.
                    </p>
                  )}
                  <GraphicsProfilePicker
                    out={mainOutput}
                    onSetOutputProfile={onSetOutputProfile}
                    onSetOutputAutoProfile={onSetOutputAutoProfile}
                  />
                </>
              )}
            </div>

            {/* Channels — one compact row each, nothing expanded by default.
                Scales to 5+ channels without growing the popover: the row
                itself never changes height, only the expand does. */}
            {channels.length > 0 && (
              <div className="screens-group">
                <div className="screens-group-head">
                  <span className="screens-group-title">Channels</span>
                </div>
                {channels.map((c) => {
                  const isExpanded = expandedChannelId === c.id
                  const obs = obsChannels?.find((o) => o.id === c.id) ?? null
                  const destWarnings = obs?.destinations.filter((d) => d.warning) ?? []
                  const hasFallback = !!obs?.current?.translationFallback
                  const hasWarning = destWarnings.length > 0 || hasFallback
                  const out = outputs.find((o) => o.channelId === c.id)
                  const dotClass = hasWarning ? 'is-warn' : obs?.current ? 'is-ok' : 'is-off'
                  return (
                    <div key={c.id} className="screens-channel-live">
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
                          <span className={`screens-status-dot screens-channel-dot ${dotClass}`} aria-hidden="true" />
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
                          {hasFallback && (
                            <span className="screens-chip screens-chip-warn">
                              <TriangleAlert width={11} height={11} strokeWidth={2.4} aria-hidden="true" />
                              Fallback: English
                            </span>
                          )}
                          {destWarnings.length > 0 && (
                            <span className="screens-chip screens-chip-warn">
                              <TriangleAlert width={11} height={11} strokeWidth={2.4} aria-hidden="true" />
                              {destWarnings[0].warning}
                            </span>
                          )}
                          {out && (
                            <span className="screens-chip screens-chip-indep">{profileLabel(out)}</span>
                          )}
                          {obs?.blanked && <span className="screens-chip screens-chip-off">Blanked</span>}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="screens-channel-detail">
                          <p className="screens-note">
                            {obs?.current ? summarizeSlide(obs.current) : 'Nothing live'}
                          </p>
                          {obs && obs.destinations.length > 0 && (
                            <div className="screens-status-destinations">
                              {obs.destinations.map((d) => (
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
                          {out ? (
                            <>
                              <div className="screens-compact-output-row">
                                <button
                                  className="display-row-btn"
                                  title={out.suppressed ? 'Show again' : 'Clear just this output'}
                                  aria-label={out.suppressed ? 'Show Graphics output' : 'Clear Graphics output'}
                                  onClick={() => onSetOutputSuppressed(out.id, !out.suppressed)}
                                >
                                  {out.suppressed ? (
                                    <EyeOff width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                                  ) : (
                                    <Eye width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                                  )}
                                </button>
                                <span className="screens-compact-output-url">
                                  {out.suppressed ? 'Cleared' : 'Graphics live'}
                                </span>
                              </div>
                              <GraphicsProfilePicker
                                out={out}
                                onSetOutputProfile={onSetOutputProfile}
                                onSetOutputAutoProfile={onSetOutputAutoProfile}
                              />
                            </>
                          ) : (
                            <button className="btn-quiet btn-sm" onClick={() => openManager('outputs')}>
                              No Graphics output — add one in Manage…
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Text size — the one remaining global, frequently-touched live
                control, unrelated to any single channel/output. */}
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
        </div>
      )}

      {managerOpen && (
        <ScreensManager
          displayInfo={displayInfo}
          projectionOpen={projectionOpen}
          stageOpen={stageOpen}
          onToggleProjection={onToggleProjection}
          onToggleStage={onToggleStage}
          onSetProjectionDisplay={onSetProjectionDisplay}
          onSetStageDisplay={onSetStageDisplay}
          onRefreshDisplays={onRefreshDisplays}
          onDisplayInfoChange={onDisplayInfoChange}
          outputs={outputs}
          onAddGraphicsOutput={onAddGraphicsOutput}
          onRemoveOutput={onRemoveOutput}
          onSetOutputProfile={onSetOutputProfile}
          onSetOutputAutoProfile={onSetOutputAutoProfile}
          onSetOutputSuppressed={onSetOutputSuppressed}
          channels={channels}
          availableTranslations={availableTranslations}
          songbooks={songbooks}
          onAddChannel={onAddChannel}
          onRemoveChannel={onRemoveChannel}
          onSetChannelTranslation={onSetChannelTranslation}
          onSetChannelSongbook={onSetChannelSongbook}
          onSetChannelSync={onSetChannelSync}
          onOpenChannel={onOpenChannel}
          obsChannels={obsChannels}
          initialTab={managerTab}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </div>
  )
}
