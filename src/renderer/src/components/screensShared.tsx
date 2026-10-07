/**
 * screensShared.tsx — small pieces shared between the Screens popover
 * (ScreensMenu.tsx, quick/live actions) and the Outputs & Channels manager
 * (ScreensManager.tsx, setup) so the two surfaces never drift apart on
 * formatting or controls that appear in both.
 */
import type { OutputInfo, PresentationProfileId, SlidePayload } from '../types'

/** "PA278QV (2) (2560×1440)" → "PA278QV (2)". */
export function shortName(label: string): string {
  const m = /^(.*?)\s*\(\d{3,}[×x]\d{3,}/.exec(label)
  return (m ? m[1] : label).trim()
}

/** One short line for "what's live" — a reference/label when the content has
 *  one (every Bible verse and sermon quote does), falling back to the raw
 *  text for a song slide, which has neither. */
export function summarizeSlide(slide: SlidePayload): string {
  return slide.reference ?? slide.label ?? slide.text.slice(0, 60)
}

export const CHECKLIST_STEPS = [
  'Check the cable is in a native HDMI/DisplayPort port on the computer itself — not a USB-C hub or dock. Hubs are a common, silent point of failure for exactly this.',
  'On Windows: Win+P → make sure it’s set to "Extend", not "PC screen only" or disconnected. Settings → System → Display → click Detect if it’s not listed.',
  'On Mac: System Settings → Displays → click Detect Displays (hold Option while the menu is open on older macOS).',
  'If it still won’t show up, your computer may have hit its maximum number of simultaneous displays (common with a laptop’s built-in graphics). If you have a video switcher (e.g. an ATEM), try routing this screen through its output instead of plugging it directly into the computer.'
]

export function roleButtonClass(role: 'projection' | 'stage'): string {
  return role === 'projection' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'
}

/** Auto/Full-screen/Lower third — picking a fixed option also turns Auto
 *  off, since choosing one by hand is explicitly opting out of "picks it
 *  automatically." Used identically in the popover's quick channel row and
 *  in the Outputs & Channels manager, so an operator sees the exact same
 *  control (not two near-identical copies) wherever it appears — mid-service
 *  in the popover, or during setup in Manage. */
export function GraphicsProfilePicker({
  out,
  onSetOutputProfile,
  onSetOutputAutoProfile
}: {
  out: OutputInfo
  onSetOutputProfile: (id: string, profileId: PresentationProfileId) => void
  onSetOutputAutoProfile: (id: string, autoProfile: boolean) => void
}): JSX.Element {
  return (
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
}

/** The current profile as a short read-only label — for a row that shows
 *  the setting but isn't the place to change it. */
export function profileLabel(out: OutputInfo): string {
  if (out.autoProfile) return 'Auto'
  return out.profileId === 'lower-third' ? 'Lower third' : 'Full-screen'
}
