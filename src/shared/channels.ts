/**
 * channels.ts — the Channel / Destination / routing model.
 *
 * A Channel is "what's currently live, for one audience": a content/
 * navigation state, independent of how or where it's rendered. A Destination
 * is a place a channel's content can be sent (a window today; conceivably a
 * network endpoint later). Deliberately decoupled from any specific slide
 * shape (TSlide) — channels are content-agnostic plumbing, not aware of
 * SlidePayload.
 *
 * `profileId` on DestinationConfig is a reserved, currently-inert seam for a
 * future presentation/profile system (same channel, different visual
 * treatment per destination — e.g. large centered text on the congregation
 * screen vs. a lower-third on a stream). Nothing reads it yet; it exists so
 * adding that system later doesn't require reshaping this type.
 */

export type ChannelId = string

/** How a channel's navigation relates to another channel's. Every channel is
 *  'independent' until something explicitly links it — nothing here may
 *  assume channels always move together or always move apart. */
export type SyncMode = 'independent' | 'follow' | 'linked'

export interface ChannelSyncConfig {
  syncMode: SyncMode
  /** The channel this one tracks. Only meaningful when syncMode !== 'independent'. */
  linkedTo?: ChannelId
}

export interface ChannelState<TSlide> {
  id: ChannelId
  label: string
  current: TSlide | null
  next: TSlide | null
  blanked: boolean
  sync: ChannelSyncConfig
}

/** 'browser' is deliberately generic — a plain HTTP-servable page, not an
 *  "OBS" or "stream" output. OBS Browser Source, vMix, a second computer, a
 *  lobby display, etc. are all just consumers of the same generic kind;
 *  naming it after one of them would bake in a redesign later. Not used
 *  until the destination that needs it is actually built. */
export type DestinationKind = 'window' | 'browser'

export interface DestinationConfig {
  id: string
  channelId: ChannelId
  kind: DestinationKind
  /** Reserved for a future presentation/profile system. Unused today. */
  profileId?: string
  /** Stable display name (see displays.ts / NamedDisplay) — never a raw
   *  Electron display id, which doesn't survive a reboot or cable swap.
   *  Unused in Phase 1: the congregation/stage destinations still resolve
   *  their display through the existing projectionDisplayName/
   *  stageDisplayName settings, which already do this job correctly.
   *  Reserved for when destination display-targeting is unified into this
   *  model. */
  displayTargetName?: string | null
}

/** Persisted shape of a channel's existence (not its live content) — survives
 *  restart/crash. */
export interface ChannelDefinition {
  id: ChannelId
  label: string
}

/** Persisted shape of which destination routes to which channel — survives
 *  restart/crash, same as ChannelDefinition. Live content (current/next
 *  slide) is deliberately NOT part of either persisted shape; only "what
 *  exists and how it's wired" needs to survive a restart, not "what's on
 *  screen right now." */
export interface DestinationRoutingEntry {
  destinationId: string
  channelId: ChannelId
}

export function createChannel<TSlide>(id: ChannelId, label: string): ChannelState<TSlide> {
  return {
    id,
    label,
    current: null,
    next: null,
    blanked: false,
    sync: { syncMode: 'independent' }
  }
}

/** Pure update helper — returns a new ChannelState with `patch` applied,
 *  never mutates the input. */
export function patchChannel<TSlide>(
  channel: ChannelState<TSlide>,
  patch: Partial<Omit<ChannelState<TSlide>, 'id' | 'label'>>
): ChannelState<TSlide> {
  return { ...channel, ...patch }
}
