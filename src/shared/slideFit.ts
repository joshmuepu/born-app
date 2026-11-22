/** How a slide fits the congregation screen, as the operator is told before and while it is live. The screen shrinks a long slide to fit, down to a
 *  third of its starting size; below 3% of the screen height (32 px on a 1080-line screen) body text is hard to read from the back of a church, and
 *  a slide that still does not fit at the smallest size has its end cut off. Measured on the congregation screen itself (ProjectionApp.tsx). */
export const SMALL_TEXT_SHARE = 0.03

export type SlideFitNotice = 'cut' | 'small' | null

/** `textPx` is the fitted font size, `screenHeight` the screen's height, both in CSS pixels. */
export function slideFitNotice(textPx: number, screenHeight: number, cut: boolean): SlideFitNotice {
  if (cut) return 'cut'
  if (screenHeight > 0 && textPx < screenHeight * SMALL_TEXT_SHARE - 0.05) return 'small'
  return null
}

/** The worst notice among an item's slides: a cut slide outranks a small one. */
export function worstNotice(notices: SlideFitNotice[] | undefined): SlideFitNotice {
  if (!notices) return null
  if (notices.includes('cut')) return 'cut'
  if (notices.includes('small')) return 'small'
  return null
}

export const SLIDE_FIT_WORDS: Record<'cut' | 'small', { badge: string; title: string }> = {
  small: {
    badge: 'Text is very small',
    title: 'On the congregation screen this slide is shrunk to under 3% of the screen height to fit, which is hard to read from the back of the room.'
  },
  cut: {
    badge: 'Text is cut',
    title: 'This slide does not fit on the congregation screen even at the smallest size, so its end is cut off.'
  }
}
