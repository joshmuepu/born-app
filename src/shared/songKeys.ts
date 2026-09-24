/**
 * songKeys.ts — the 24 standard musical keys BORN lets a song be tagged
 * with: 12 chromatic roots (sharps only — C#, not the enharmonic D♭, since
 * the two name the same pitch and a song's "key" here is a display label,
 * not something the app computes with) times major/minor.
 *
 * A constrained list, not free text: the key field is pure metadata today
 * (nothing parses or transposes from it), so free text would only buy typos
 * and inconsistent notation ("Bb" vs "B♭" vs "B-flat") for a non-technical
 * user, with no upside.
 */

const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const MAJOR_KEYS: string[] = ROOTS.map((r) => r)
export const MINOR_KEYS: string[] = ROOTS.map((r) => `${r}m`)

/** All 24 valid keys, majors then minors. The only values `songKey` may
 *  hold besides `null` — validate against this before writing to the db. */
export const STANDARD_KEYS: string[] = [...MAJOR_KEYS, ...MINOR_KEYS]

export function isStandardKey(key: string): boolean {
  return STANDARD_KEYS.includes(key)
}
