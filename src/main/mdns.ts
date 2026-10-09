/**
 * mdns.ts — advertises the web remote on the LAN by name (Bonjour/mDNS), so a
 * phone's browser can resolve `born-remote.local` instead of a raw IP that
 * changes whenever the router reassigns a DHCP lease. Implemented at the
 * protocol level (not by shelling out to OS Bonjour/Avahi), so it works the
 * same on a Windows church machine that has no Bonjour installed as it does
 * on a Mac.
 */
import Bonjour, { Service } from 'bonjour-service'
import { log } from './logger'

/** Dev-only escape hatch, same purpose as BORN_USER_DATA_DIR/BORN_REMOTE_PORT
 *  — lets a second local checkout advertise under a different name instead of
 *  racing this one for 'born-remote.local' (mDNS's own probe-and-rename
 *  handles that collision without crashing, but silently, and can leave the
 *  hostname unresolved rather than just renamed — this avoids relying on
 *  that). Never set for a real install. */
const HOSTNAME = process.env.BORN_MDNS_NAME || 'born-remote'

let bonjour: Bonjour | null = null
let service: Service | null = null
let resolvedHost: string | null = null

/** Start advertising once the web remote's HTTP server is listening. Safe to
 *  call even if the network has no multicast (it just never resolves and the
 *  caller falls back to a plain IP address). */
export function startMdns(port: number): void {
  try {
    bonjour = new Bonjour(undefined, (err: Error) => {
      log.warn('mdns: background error', err)
    })
    service = bonjour.publish({
      name: process.env.BORN_MDNS_NAME ? `BORN Remote (${process.env.BORN_MDNS_NAME})` : 'BORN Remote',
      type: 'http',
      port,
      host: `${HOSTNAME}.local`,
      probe: true // detects a name already taken on this LAN and renames itself
    })
    service.on('up', () => {
      resolvedHost = service?.host ?? `${HOSTNAME}.local`
      log.info(`mdns: advertising as ${resolvedHost} (port ${port})`)
    })
    service.on('error', (err: Error) => log.warn('mdns: publish error', err))
  } catch (e) {
    log.warn('mdns: failed to start — falling back to IP-only', e)
  }
}

/** The `.local` hostname once mDNS has finished probing, else null (caller
 *  should fall back to a plain LAN IP until/unless this resolves). */
export function getMdnsHostname(): string | null {
  return resolvedHost
}

export function stopMdns(): void {
  try {
    bonjour?.unpublishAll()
    bonjour?.destroy()
  } catch {
    /* best-effort on shutdown */
  }
  bonjour = null
  service = null
  resolvedHost = null
}
