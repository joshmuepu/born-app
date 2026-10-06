/**
 * observability.ts — the "is this destination actually reaching anyone"
 * decision for the Screens Setup Status section. Pure data in, pure data
 * out: main/index.ts gathers the real facts (window ready state, stage
 * display targeting, Graphics SSE client count) and hands them to
 * describeDestinationStatus below, which has no Electron/IPC dependency of
 * its own and so can be unit-tested directly.
 */

export interface ObservabilityDestination {
  id: string
  kind: 'window' | 'browser'
  label: string
  connected: boolean
  warning: string | null
}

export interface ObservabilityChannel {
  id: string
  label: string
  current: {
    kind: 'quote' | 'bible' | 'song'
    text: string
    label?: string
    reference?: string
    /** This channel follows another, had no translation for this content,
     *  and fell back to English — see main/index.ts's deriveFollowSlide. */
    translationFallback?: boolean
  } | null
  blanked: boolean
  destinations: ObservabilityDestination[]
}

export type DestinationStatusInput =
  | { role: 'unknown' }
  | { role: 'congregation'; ready: boolean }
  // `windowed` only matters once the monitor is actually on — a platform
  // crew that hasn't turned it on yet isn't a misconfiguration to flag.
  | { role: 'stage'; ready: boolean; windowed: boolean }
  | { role: 'graphics'; clientCount: number; profileName: string }

/** Congregation/stage being off is the normal, expected state between
 *  services, so it's never a warning on its own — only `stage` running
 *  windowed *while switched on* is worth flagging. A Graphics destination
 *  has no window lifecycle to report ready=false against, so its live
 *  signal is SSE client count instead: 0 connected is always worth saying,
 *  since adding one is itself the operator declaring "this should be live." */
export function describeDestinationStatus(id: string, input: DestinationStatusInput): ObservabilityDestination {
  switch (input.role) {
    case 'unknown':
      return { id, kind: 'window', label: id, connected: false, warning: null }
    case 'congregation':
      return { id, kind: 'window', label: 'Congregation Screen', connected: input.ready, warning: null }
    case 'stage': {
      const warning = input.ready && input.windowed ? 'No external display — running windowed' : null
      return { id, kind: 'window', label: 'Stage Monitor', connected: input.ready, warning }
    }
    case 'graphics': {
      const connected = input.clientCount > 0
      return {
        id,
        kind: 'browser',
        label: `Graphics — ${input.profileName}`,
        connected,
        warning: connected ? null : 'No viewer connected'
      }
    }
  }
}
