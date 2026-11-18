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

/** The file name a service saved from the phone gets (in the phone's save folder): no path characters, and never one of the names
 *  Windows keeps for devices (CON, NUL, COM1…: a file saved as "CON.born" there goes nowhere) or one ending in a dot or a space. */
/** "Name (2)", "Name (3)" … the first name whose file is not taken yet, for the phone's "Keep both". */
export function freeServiceName(name: string, taken: (fileName: string) => boolean): string {
  const base = String(name ?? '').trim()
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} (${n})`
    if (!taken(safeServiceFileName(candidate))) return candidate
  }
  return `${base} (${Date.now()})`
}

export function safeServiceFileName(name: unknown): string {
  let n = String(name ?? '').trim().replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80).replace(/[. ]+$/, '')
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(n)) n += ' service'
  return n || 'Untitled service'
}
