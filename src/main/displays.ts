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

/** What makes a physical display recognizable again after a reboot or a
 *  reconnect — model label + resolution + internal-flag, deliberately NOT
 *  Electron's raw numeric id. That id is reassigned by the OS/driver on
 *  every session (especially on Windows, where a driver reinit or plugging
 *  things in a different order can renumber displays), so pinning an
 *  operator's choice to it silently breaks the exact hardware instability
 *  this feature exists to be resilient to. */
export interface DisplayFingerprint {
  label: string
  width: number
  height: number
  internal: boolean
}

/** An operator-given name ("Sanctuary Projector") persisted across restarts.
 *  `ordinal` disambiguates two identical monitors (same model + resolution,
 *  e.g. a matched pair) by their left-to-right position among displays
 *  sharing that fingerprint, recorded at the moment the operator named it.
 *  Best-effort: if two identical monitors are later swapped to different
 *  ports, the name can attach to the wrong one until renamed. */
export interface NamedDisplay {
  name: string
  fingerprint: DisplayFingerprint
  ordinal: number
}

export function fingerprintOf(d: DisplayLike): DisplayFingerprint {
  return {
    label: (d.label || '').trim(),
    width: d.bounds.width,
    height: d.bounds.height,
    internal: !!d.internal
  }
}

function sameFingerprint(a: DisplayFingerprint, b: DisplayFingerprint): boolean {
  return a.label === b.label && a.width === b.width && a.height === b.height && a.internal === b.internal
}

/** Every currently-connected display sharing `fingerprint`, left-to-right by
 *  physical position — the ordering both naming and matching rely on to tell
 *  apart identical duplicate monitors. */
function siblingsOf(displays: DisplayLike[], fingerprint: DisplayFingerprint): DisplayLike[] {
  return displays
    .filter((d) => sameFingerprint(fingerprintOf(d), fingerprint))
    .sort((a, b) => a.bounds.x - b.bounds.x)
}

/** Captures what to remember about `target` when the operator names it. */
export function fingerprintAndOrdinal(
  displays: DisplayLike[],
  target: DisplayLike
): { fingerprint: DisplayFingerprint; ordinal: number } {
  const fingerprint = fingerprintOf(target)
  const siblings = siblingsOf(displays, fingerprint)
  const ordinal = Math.max(0, siblings.findIndex((d) => d.id === target.id))
  return { fingerprint, ordinal }
}

/** Resolves a saved name back to a currently-connected display, or null if
 *  nothing connected right now matches its fingerprint (the display is
 *  unplugged, powered off, or — as with a genuine GPU/driver ceiling — will
 *  never be detected at all). */
export function matchNamedDisplay(displays: DisplayLike[], named: NamedDisplay): DisplayLike | null {
  return siblingsOf(displays, named.fingerprint)[named.ordinal] ?? null
}

/** The exact saved NamedDisplay entry for `d` right now, if any — the
 *  inverse of fingerprintAndOrdinal: recompute d's own ordinal among its
 *  current siblings and look for a saved entry at that (fingerprint,
 *  ordinal). Returns the entry itself (not just its name) so a caller can
 *  replace or remove it precisely, e.g. when the operator renames it. */
export function findNamedEntry(
  displays: DisplayLike[],
  d: DisplayLike,
  namedDisplays: NamedDisplay[]
): NamedDisplay | undefined {
  const { fingerprint, ordinal } = fingerprintAndOrdinal(displays, d)
  return namedDisplays.find((n) => sameFingerprint(n.fingerprint, fingerprint) && n.ordinal === ordinal)
}

/** The operator name attached to `d` right now, if any. */
export function nameForDisplay(
  displays: DisplayLike[],
  d: DisplayLike,
  namedDisplays: NamedDisplay[]
): string | null {
  return findNamedEntry(displays, d, namedDisplays)?.name ?? null
}

export interface ProjectionTarget {
  display: DisplayLike
  /** true when we fell back to the operator's own screen (no external display). */
  isFallback: boolean
  /** true when the chosen display came from an explicit operator override. */
  isOverride: boolean
  /** The operator named a display for this role, but nothing connected right
   *  now matches it — kept distinct from a plain automatic pick so the UI can
   *  say "Sanctuary Projector — not detected" instead of quietly switching to
   *  a different screen with no explanation. */
  missingOverrideName: string | null
}

function autoPickExternal(displays: DisplayLike[], primaryId: number): DisplayLike | undefined {
  const externals = displays.filter((d) => d.id !== primaryId)
  return externals.find((d) => !d.internal) ?? externals[0]
}

/**
 * Choose the projection display.
 *   1. A named override that's currently connected wins.
 *   2. Otherwise the first external (non-primary) display, preferring a
 *      non-internal panel (so a closed-lid laptop with two externals is sane)
 *      — and if the override name is set but unmatched, that's recorded so
 *      the UI can say so.
 *   3. Otherwise the primary display (marked as a fallback).
 */
export function pickProjectionDisplay(
  displays: DisplayLike[],
  primaryId: number,
  overrideName?: string | null,
  namedDisplays: NamedDisplay[] = []
): ProjectionTarget {
  if (overrideName) {
    const named = namedDisplays.find((n) => n.name === overrideName)
    const forced = named ? matchNamedDisplay(displays, named) : null
    if (forced) {
      return { display: forced, isFallback: forced.id === primaryId, isOverride: true, missingOverrideName: null }
    }
    const target = autoPickExternal(displays, primaryId)
    if (target) return { display: target, isFallback: false, isOverride: false, missingOverrideName: overrideName }
    const primary = displays.find((d) => d.id === primaryId) ?? displays[0]
    return { display: primary, isFallback: true, isOverride: false, missingOverrideName: overrideName }
  }

  const target = autoPickExternal(displays, primaryId)
  if (target) return { display: target, isFallback: false, isOverride: false, missingOverrideName: null }
  const primary = displays.find((d) => d.id === primaryId) ?? displays[0]
  return { display: primary, isFallback: true, isOverride: false, missingOverrideName: null }
}

export interface StageTarget {
  /** null → no screen free for the stage monitor; use a normal window. */
  display: DisplayLike | null
  /** true when we fell back to a windowed stage monitor (no spare screen). */
  isFallback: boolean
  /** true when the chosen display came from an explicit operator override. */
  isOverride: boolean
  /** Same meaning as ProjectionTarget.missingOverrideName. */
  missingOverrideName: string | null
}

/**
 * Choose the stage-monitor display.
 *   1. A named override that's currently connected wins.
 *   2. Otherwise a screen that is neither the operator's nor the projector's.
 *   3. Otherwise none — the stage monitor stays a normal window.
 */
export function pickStageDisplay(
  displays: DisplayLike[],
  primaryId: number,
  projectionId: number,
  overrideName?: string | null,
  namedDisplays: NamedDisplay[] = []
): StageTarget {
  const spareOf = (): DisplayLike | undefined =>
    displays.find((d) => d.id !== primaryId && d.id !== projectionId)

  if (overrideName) {
    const named = namedDisplays.find((n) => n.name === overrideName)
    const forced = named ? matchNamedDisplay(displays, named) : null
    if (forced) return { display: forced, isFallback: false, isOverride: true, missingOverrideName: null }
    const spare = spareOf()
    return spare
      ? { display: spare, isFallback: false, isOverride: false, missingOverrideName: overrideName }
      : { display: null, isFallback: true, isOverride: false, missingOverrideName: overrideName }
  }

  const spare = spareOf()
  return spare
    ? { display: spare, isFallback: false, isOverride: false, missingOverrideName: null }
    : { display: null, isFallback: true, isOverride: false, missingOverrideName: null }
}

/** A short human label for a display, for the operator's picker + logs.
 *  Prefers an operator-given name over the raw system label when one is
 *  attached to this exact display right now. */
export function describeDisplay(
  d: DisplayLike,
  primaryId: number,
  namedDisplays: NamedDisplay[] = [],
  allDisplays: DisplayLike[] = [d]
): string {
  const custom = nameForDisplay(allDisplays, d, namedDisplays)
  const size = `${d.bounds.width}×${d.bounds.height}`
  const name = custom || (d.label && d.label.trim() ? d.label.trim() : d.internal ? 'Built-in display' : 'Display')
  const tags = [d.id === primaryId ? 'primary' : null, d.internal ? 'internal' : null].filter(Boolean)
  return tags.length ? `${name} (${size}, ${tags.join(', ')})` : `${name} (${size})`
}
