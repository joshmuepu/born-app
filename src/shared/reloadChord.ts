/** Ctrl/Cmd+R and Ctrl/Cmd+Shift+R are the browser "reload" chords. Electron's default menu binds them to Reload, so a stray press
 *  mid-service reloads the operator window (or the projector/stage output) and drops what it was showing. The packaged app swallows them. */
export function isReloadChord(input: { type?: string; key: string; control?: boolean; meta?: boolean; alt?: boolean }): boolean {
  if (input.type && input.type !== 'keyDown') return false
  if (!(input.control || input.meta) || input.alt) return false
  return input.key.toLowerCase() === 'r'
}
