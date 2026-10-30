/**
 * remoteServicePath.ts — which service files the phone remote may open or import.
 *
 * The phone's Open saved / Import saved lists come from the recent service files (/api/services/recent) and the folder the phone
 * saves into. A path arriving from the network is accepted only when it is one of those, never any path on this computer (on
 * Windows a \\server\share path would even make the PC sign in to that server).
 */
import { isAbsolute, relative, resolve } from 'path'

export function isOpenableFromRemote(path: unknown, recentServices: string[], remoteSaveDir: string): path is string {
  if (typeof path !== 'string' || !path) return false
  if (recentServices.includes(path)) return true
  if (/^(\\\\|\/\/)/.test(path)) return false
  const rel = relative(resolve(remoteSaveDir), resolve(path))
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel) && /\.(born|bpservice)$/i.test(path)
}
