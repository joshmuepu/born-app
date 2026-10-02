/**
 * presentationProfiles.ts — presentation profiles as real, referenced data.
 *
 * A profile describes how a destination renders a channel's content: a
 * page-level background mode, plus CSS declarations for each of the four
 * regions every Graphics layout has (panel, label, text, reference). Adding
 * a third profile means adding an entry to PRESENTATION_PROFILES below —
 * never a new `if` branch in whatever builds the page. The renderer (see
 * main/webRemote.ts's buildGraphicsHTML) reads a profile generically; it has
 * no special-cased knowledge of 'fullscreen' or 'lower-third' as names, and
 * nothing about either layout is hardcoded anywhere outside this file.
 *
 * Unlike the small shape-only types duplicated across main/preload/renderer
 * elsewhere in this codebase (SlidePayload, OutputInfo, etc. — fine to
 * redeclare since they never carry real content), this file's actual DATA
 * must exist in exactly one place to mean anything by "real data, not
 * hardcoded logic." main/webRemote.ts imports directly from here rather than
 * duplicating.
 */

export type PresentationProfileId = 'fullscreen' | 'lower-third'

/** Design-reference resolution the two profiles below were tuned against —
 *  not a fixed-pixel container. The actual CSS stays viewport-relative
 *  (vw/vh/%) so the page still works correctly at whatever resolution a
 *  consumer (OBS, a browser, anything) actually renders it at; this exists
 *  so that relationship is documented instead of implicit. */
export const GRAPHICS_CANVAS = { width: 1920, height: 1080 }

/** Percent inset from every edge that readable content stays clear of —
 *  matches broadcast "title-safe" convention, so content is never clipped by
 *  a TV's overscan, a stream platform's UI chrome, or a projector's edge
 *  blanking. Every profile below measures its horizontal margins from this
 *  one constant instead of each picking its own number. */
export const SAFE_AREA_PERCENT = 6

export interface PresentationProfile {
  id: PresentationProfileId
  name: string
  /** Page-level background. 'transparent' is genuine alpha — verified by
   *  sampling actual rendered pixel alpha values, not just "looks dark" —
   *  for a profile meant to sit over other video (Lower Third). A solid
   *  colour is for a profile that replaces the frame entirely (Full-Screen). */
  pageBackground: string
  /** CSS declarations for each named region, applied verbatim as that
   *  element's inline style. Deliberately an open-ended property:value
   *  record rather than a fixed {top,left,fontSize,...} shape — a profile
   *  can position and style its regions however it needs to without this
   *  data shape having to grow new fields first. */
  regions: {
    panel: Record<string, string>
    label: Record<string, string>
    text: Record<string, string>
    reference: Record<string, string>
  }
}

const EDGE = `${SAFE_AREA_PERCENT}%`

const FULLSCREEN: PresentationProfile = {
  id: 'fullscreen',
  name: 'Full-Screen',
  pageBackground: '#000',
  regions: {
    panel: { position: 'absolute', inset: '0' },
    label: {
      position: 'absolute',
      top: '6vh',
      left: EDGE,
      right: EDGE,
      'text-align': 'center',
      'font-size': 'clamp(0.9rem, 1.8vw, 1.5rem)',
      'font-weight': '600',
      'letter-spacing': '0.14em',
      'text-transform': 'uppercase',
      color: '#948d7c'
    },
    text: {
      position: 'absolute',
      top: '12vh',
      bottom: '13vh',
      left: '0',
      right: '0',
      padding: `0 ${EDGE}`,
      overflow: 'hidden',
      'line-height': '1.5',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'text-align': 'center',
      'font-size': 'clamp(1.4rem, 5vw, 4rem)'
    },
    reference: {
      position: 'absolute',
      bottom: '5vh',
      left: EDGE,
      right: EDGE,
      'text-align': 'center',
      'font-size': 'clamp(1rem, 3.2vh, 2.2rem)',
      color: '#c8c8c8',
      'letter-spacing': '0.02em'
    }
  }
}

/** Transparent page so OBS Browser Source (and any other CEF/Chromium-based
 *  compositor) shows whatever's behind it everywhere but the band itself —
 *  plain CSS, not a rendering feature BORN has to build; OBS already
 *  composites a transparent browser source natively. Only this profile
 *  needs that; Full-Screen's whole point is replacing the frame, not
 *  sitting over it. */
const LOWER_THIRD: PresentationProfile = {
  id: 'lower-third',
  name: 'Lower Third',
  pageBackground: 'transparent',
  regions: {
    panel: {
      position: 'absolute',
      left: EDGE,
      right: EDGE,
      bottom: '6%',
      background: 'rgba(10, 8, 6, 0.78)',
      'border-radius': '10px',
      padding: '16px 28px'
    },
    label: {
      display: 'block',
      'text-align': 'left',
      'font-size': 'clamp(0.7rem, 1.3vw, 1rem)',
      'font-weight': '600',
      'letter-spacing': '0.12em',
      'text-transform': 'uppercase',
      color: '#c9a86a',
      'margin-bottom': '4px'
    },
    text: {
      display: 'block',
      overflow: 'hidden',
      'line-height': '1.35',
      'text-align': 'left',
      'font-size': 'clamp(1rem, 2.1vw, 1.7rem)'
    },
    reference: {
      display: 'block',
      'text-align': 'left',
      'font-size': 'clamp(0.65rem, 1.1vw, 0.9rem)',
      color: '#d8cdb8',
      'letter-spacing': '0.02em',
      'margin-top': '6px'
    }
  }
}

export const PRESENTATION_PROFILES: Record<PresentationProfileId, PresentationProfile> = {
  fullscreen: FULLSCREEN,
  'lower-third': LOWER_THIRD
}

export function getPresentationProfile(id: PresentationProfileId): PresentationProfile {
  return PRESENTATION_PROFILES[id] ?? PRESENTATION_PROFILES.fullscreen
}

/**
 * Deliberately NOT built here — tracked for a later phase, not forgotten:
 *  - Content-type-aware profiles (song vs. Scripture vs. sermon quote each
 *    getting an automatically distinct treatment, not one profile for
 *    everything a channel shows).
 *  - Structured Scripture — reference and body as separately styleable
 *    elements, not reference-as-a-single-region like today.
 *  - Broadcast-specific lyric pagination (fewer lines per slide on a stream
 *    profile than on the sanctuary wall).
 *  - Transitions (fade/cut) between slides.
 *  - A Graphics preview in the operator UI (seeing what a profile looks
 *    like without a browser/OBS open).
 * Candidate name: Phase 3b, or folded into wherever content/channel work
 * (Phase 5) lands once that's further along — whichever makes sense when
 * it's actually picked up.
 */
