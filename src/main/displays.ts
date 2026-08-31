/**
 * displays.ts — pure logic for choosing which monitor the projection window
 * should live on. No Electron deps so it can be unit-tested in Node.
 */

export interface DisplayLike {
  id: number
  label?: string
  internal?: boolean
  bounds: { x: number; y: number; width: number; height: number }
  workArea?: { x: number; y: number; width: number; height: number }
}

export interface ProjectionTarget {
  display: DisplayLike
  /** true when we fell back to the operator's own screen (no external display). */
  isFallback: boolean
  /** true when the chosen display came from an explicit operator override. */
  isOverride: boolean
}

/**
 * Choose the projection display.
 *   1. An explicit, still-connected override wins.
 *   2. Otherwise the first external (non-primary) display, preferring a
 *      non-internal panel (so a closed-lid laptop with two externals is sane).
 *   3. Otherwise the primary display (marked as a fallback).
 */
export function pickProjectionDisplay(
  displays: DisplayLike[],
  primaryId: number,
  overrideId?: number | null
): ProjectionTarget {
  if (overrideId != null) {
    const forced = displays.find((d) => d.id === overrideId)
    if (forced) {
      return { display: forced, isFallback: forced.id === primaryId, isOverride: true }
    }
  }

  const externals = displays.filter((d) => d.id !== primaryId)
  const target = externals.find((d) => !d.internal) ?? externals[0]
  if (target) return { display: target, isFallback: false, isOverride: false }

  const primary = displays.find((d) => d.id === primaryId) ?? displays[0]
  return { display: primary, isFallback: true, isOverride: false }
}

export interface StageTarget {
  /** null → no screen free for the stage monitor; use a normal window. */
  display: DisplayLike | null
  /** true when we fell back to a windowed stage monitor (no spare screen). */
  isFallback: boolean
  /** true when the chosen display came from an explicit operator override. */
  isOverride: boolean
}

/**
 * Choose the stage-monitor display.
 *   1. An explicit, still-connected override wins.
 *   2. Otherwise a screen that is neither the operator's nor the projector's.
 *   3. Otherwise none — the stage monitor stays a normal window.
 */
export function pickStageDisplay(
  displays: DisplayLike[],
  primaryId: number,
  projectionId: number,
  overrideId?: number | null
): StageTarget {
  if (overrideId != null) {
    const forced = displays.find((d) => d.id === overrideId)
    if (forced) return { display: forced, isFallback: false, isOverride: true }
  }
  const spare = displays.find((d) => d.id !== primaryId && d.id !== projectionId)
  if (spare) return { display: spare, isFallback: false, isOverride: false }
  return { display: null, isFallback: true, isOverride: false }
}

/** A short human label for a display, for the operator's picker + logs. */
export function describeDisplay(d: DisplayLike, primaryId: number): string {
  const size = `${d.bounds.width}×${d.bounds.height}`
  const name = d.label && d.label.trim() ? d.label.trim() : d.internal ? 'Built-in display' : 'Display'
  const tags = [d.id === primaryId ? 'primary' : null, d.internal ? 'internal' : null].filter(Boolean)
  return tags.length ? `${name} (${size}, ${tags.join(', ')})` : `${name} (${size})`
}
