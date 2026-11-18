import type { WebRemoteState } from './webRemote'

/** What the congregation screen really shows, as this process holds it. */
export interface LiveScreen {
  slide: { kind: string; text: string; reference?: string; label?: string; marker?: string } | null
  blank: boolean
}

/** The phone's status follows the congregation screen itself, not only the operator window's idea of it: after the operator window is
 *  started again (it stopped, or was reloaded) it no longer knows what is live, though the screen still shows it. So while the
 *  congregation screen is open, whether it is hidden comes from here, and what is on it is filled in from here when the operator window
 *  has nothing. `live` is null when the congregation screen is closed; the state is then passed on as it is. */
export function withLiveScreen(state: WebRemoteState, live: LiveScreen | null): WebRemoteState {
  if (!state || typeof state !== 'object' || !live) return state
  const out = { ...state, blanked: live.blank }
  if (!state.onScreen && live.slide && !live.blank) {
    const s = live.slide
    out.onScreen = { kind: s.kind, text: s.text, reference: s.reference, label: s.label, marker: s.marker }
  }
  return out
}
