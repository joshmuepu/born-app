/** What the operator window sends is checked before it reaches a screen or the settings file: something malformed is dropped, never thrown on. */

export type AlertTarget = 'congregation' | 'stage' | 'both'

/** A Message for the screens: plain text (the old form) or { message, target }. Anything else, or an empty message, is null. */
export function alertPayload(payload: unknown): { message: string; target: AlertTarget } | null {
  const raw = typeof payload === 'string' ? payload : payload && typeof payload === 'object' ? (payload as { message?: unknown }).message : undefined
  if (typeof raw !== 'string' || !raw.trim()) return null
  const t = payload && typeof payload === 'object' ? (payload as { target?: unknown }).target : undefined
  const target: AlertTarget = t === 'stage' || t === 'both' ? t : 'congregation'
  return { message: raw, target }
}

/** Text typed by the operator (a screen's name): anything that is not text is no text. */
export function textInput(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}
