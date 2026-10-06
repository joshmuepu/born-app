/**
 * apiVersioning.ts — maps a versioned API path to whatever unversioned path
 * already implements it. Pure: webRemote.ts is the only caller, and the only
 * place that needs to know v1 exists at all — every actual route handler
 * stays written against the plain, unversioned path it always used.
 */

export const AUTOMATION_WS_VERSION = 1

/** /api/v1/* is the versioned surface for every data/control route this
 *  server answers. The unversioned path each one maps to keeps working
 *  forever as a plain alias — an already-configured integration (a saved
 *  Stream Deck/Companion button, the bundled phone remote's own cached
 *  client code) never breaks just because a versioned path was added
 *  alongside it. Returns `path` unchanged when it isn't under /api/v1/ at
 *  all — in particular /output/graphics/* and / are never touched: those
 *  are rendered pages/resources an operator pastes into OBS or a browser,
 *  not API calls, and must never move. */
export function resolveApiV1(path: string): string {
  if (!path.startsWith('/api/v1/')) return path
  const rest = path.slice('/api/v1/'.length)
  if (rest === 'command') return '/command'
  if (rest === 'state') return '/state'
  // Every other v1 route already lives one path segment up, under plain
  // /api/ today (search, bible, song, songs, services, sermons, automation).
  return `/api/${rest}`
}
