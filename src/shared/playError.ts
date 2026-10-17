/** A browser's "play() failed" error in words a volunteer can act on (the raw text — "NotSupportedError: Failed to load because no supported source was found" — stays in the log). */
export function plainPlayError(e: unknown): string {
  const name = (e as { name?: string } | null)?.name ?? ''
  const msg = String((e as { message?: string } | null)?.message ?? e ?? '')
  if (name === 'NotAllowedError' || /not allowed|user (gesture|didn't interact)/i.test(msg)) return 'the computer would not let it start.'
  if (name === 'NotSupportedError' || /no supported source|not supported/i.test(msg)) return 'this computer cannot play this file'
  if (name === 'AbortError') return 'it was interrupted.'
  return 'it could not be played'
}
