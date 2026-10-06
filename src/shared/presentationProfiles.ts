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
   *  colour is for a profile that replaces the frame entirely (Full-Screen).
   *  Documents intent per profile; the live Graphics page (which ships every
   *  profile's CSS at once so it can switch content-type treatment without a
   *  reload) actually keeps html/body transparent always and lets each
   *  profile's own `panel` region supply its backdrop instead — see
   *  buildGraphicsHTML in webRemote.ts. */
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
    /** The citation line — "John 3:16" or "The Patmos Vision". */
    reference: Record<string, string>
    /** The subordinate half of the citation, split off whatever followed the
     *  first " · " in the source reference string ("KJV", or "60-1204E ·
     *  15") — its own element so it can be styled distinctly (smaller,
     *  dimmer) from the main reference instead of being stuck inside one
     *  opaque string. Empty/hidden when the source reference has no " · ". */
    referenceDetail: Record<string, string>
    /** The small superscript verse-number badge on a Bible slide. */
    marker: Record<string, string>
  }
  /** How a new slide replaces the one before it on this profile. 'cut' is
   *  instant (today's only behaviour, still the default); 'fade' crossfades
   *  over durationMs — configurable per profile since Lower Third sitting
   *  over live video reads better with a soft fade than Full-Screen does. */
  transition: { type: 'cut' | 'fade'; durationMs: number }
  /** The Graphics output's own, separate pagination for long lyrics —
   *  independent of whatever paginateText already did for the congregation
   *  slide. When a slide's line count exceeds `linesPerPage`, the output
   *  auto-cycles through the rest on its own timer (see pushGraphicsUpdate
   *  in webRemote.ts) rather than either dropping content or shrinking text
   *  to fit, so a broadcast viewer eventually sees every line. */
  broadcastPagination: { linesPerPage: number; intervalMs: number }
}

const EDGE = `${SAFE_AREA_PERCENT}%`

const FULLSCREEN: PresentationProfile = {
  id: 'fullscreen',
  name: 'Full-Screen',
  pageBackground: '#000',
  regions: {
    // Carries its own opaque backdrop (rather than relying on the page
    // background) so it can share a page with Lower Third's transparent
    // panel and still fully replace the frame — see the live-switching note
    // on PresentationProfile.pageBackground above.
    panel: { position: 'absolute', inset: '0', background: '#000' },
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
      // A song slide's lyric lines are real '\n's, meaningful line breaks
      // the operator and congregation screen both already honor — without
      // this they'd collapse into one run-on line like any other HTML text.
      'white-space': 'pre-line',
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
    },
    // Sibling of #reference, not nested inside it — needs its own absolute
    // position (every other Full-Screen region is taken out of flow) rather
    // than margin-top, which only works relative to a preceding in-flow
    // sibling and otherwise just places it at #panel's own flow origin
    // (the top of the frame, nowhere near the reference line it's supposed
    // to sit under).
    referenceDetail: {
      position: 'absolute',
      bottom: '2vh',
      left: EDGE,
      right: EDGE,
      'text-align': 'center',
      'font-size': 'clamp(0.75rem, 2vh, 1.3rem)',
      color: '#8a8a8a',
      'letter-spacing': '0.02em'
    },
    marker: {
      'font-size': '0.45em',
      'font-weight': '700',
      color: '#b8b8b8',
      'vertical-align': 'super',
      'line-height': '0',
      'margin-right': '0.3em'
    }
  },
  transition: { type: 'cut', durationMs: 0 },
  broadcastPagination: { linesPerPage: 4, intervalMs: 4500 }
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
      'white-space': 'pre-line',
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
    },
    referenceDetail: {
      display: 'inline',
      'font-size': '0.85em',
      color: '#a89a7c',
      'margin-left': '0.5em'
    },
    marker: {
      'font-size': '0.5em',
      'font-weight': '700',
      color: '#c9bda0',
      'vertical-align': 'super',
      'line-height': '0',
      'margin-right': '0.25em'
    }
  },
  // A caption band sitting over live video reads better easing in and out
  // than cutting — the sanctuary wall (Full-Screen) has no such video to
  // clash with, so it stays an instant cut.
  transition: { type: 'fade', durationMs: 350 },
  // Less room than Full-Screen, so a shorter page — two lyric lines at a
  // time, cycling through the rest, rather than four.
  broadcastPagination: { linesPerPage: 2, intervalMs: 4000 }
}

export const PRESENTATION_PROFILES: Record<PresentationProfileId, PresentationProfile> = {
  fullscreen: FULLSCREEN,
  'lower-third': LOWER_THIRD
}

export function getPresentationProfile(id: PresentationProfileId): PresentationProfile {
  return PRESENTATION_PROFILES[id] ?? PRESENTATION_PROFILES.fullscreen
}

/** A Graphics destination with autoProfile on resolves its treatment from
 *  this instead of one fixed, hand-picked profile — the whole point being
 *  that an operator never switches profiles by hand as the service moves
 *  from a song to a verse to a quote. Pure data: giving a kind a different
 *  default, or adding a third profile and pointing a kind at it, is an edit
 *  here, never a renderer change (see buildGraphicsHTML in webRemote.ts,
 *  which ships every profile's CSS and switches between them by attribute). */
export const DEFAULT_CONTENT_PROFILES: Record<'song' | 'bible' | 'quote', PresentationProfileId> = {
  song: 'lower-third',
  bible: 'fullscreen',
  quote: 'fullscreen'
}
