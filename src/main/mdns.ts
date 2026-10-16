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

interface Responder {
  bonjour: Bonjour
  service: Service
}

let responders: Responder[] = []
let resolvedHost: string | null = null
let advertisedKey = ''

function publishOn(port: number, address: string | null, probe: boolean): Responder | null {
  try {
    // One responder per network adapter. A single multicast-dns socket joins
    // the group on every adapter but SENDS on only one (the OS's pick), so on
    // a two-network machine a phone on the "other" network would never hear
    // the reply to its query. `interface` pins membership + sending to this
    // adapter; `bind` stays 0.0.0.0 because a socket bound to a unicast
    // address does not receive multicast on macOS/BSD.
    const bonjour = new Bonjour(
      // bonjour-service's typings only list ServiceConfig, but it hands
      // these options straight to multicast-dns (see mdns-server.js).
      address ? ({ interface: address, bind: '0.0.0.0' } as object) : undefined,
      (err: Error) => log.warn('mdns: background error', err)
    )
    const service = bonjour.publish({
      name: process.env.BORN_MDNS_NAME ? `BORN Remote (${process.env.BORN_MDNS_NAME})` : 'BORN Remote',
      type: 'http',
      port,
      host: `${HOSTNAME}.local`,
      // Only the first responder probes for a name collision: the probe treats
      // ANY reply for the name as "taken", including our own other responders.
      probe
    })
    service.on('error', (err: Error) => log.warn('mdns: publish error', err))
    return { bonjour, service }
  } catch (e) {
    log.warn(`mdns: failed to start${address ? ` on ${address}` : ''} — falling back to IP-only`, e)
    return null
  }
}

/** Start advertising once the web remote's HTTP server is listening. Safe to
 *  call even if the network has no multicast (it just never resolves and the
 *  caller falls back to a plain IP address). `addresses` are this computer's
 *  usable adapter addresses; empty means "let the library pick" (old
 *  behaviour). */
export function startMdns(port: number, addresses: string[] = []): void {
  stopMdns()
  advertisedKey = [...addresses].sort().join(',')
  const [first, ...rest] = addresses
  const primary = publishOn(port, first ?? null, true)
  if (!primary) return
  responders = [primary]
  primary.service.on('up', () => {
    resolvedHost = primary.service.host ?? `${HOSTNAME}.local`
    log.info(
      `mdns: advertising as ${resolvedHost} (port ${port}) on ${addresses.length ? addresses.join(', ') : 'default interface'}`
    )
    // Start the others only after the name is confirmed free.
    for (const addr of rest) {
      if (!responders.includes(primary)) return // stopped meanwhile
      const r = publishOn(port, addr, false)
      if (r) responders.push(r)
    }
  })
}

/** Re-advertise if the set of usable adapters changed since startMdns (Wi-Fi
 *  joined after launch, cable unplugged). No-op when nothing changed or mDNS
 *  isn't running. */
export function refreshMdns(port: number, addresses: string[]): void {
  if (responders.length === 0) return
  if ([...addresses].sort().join(',') === advertisedKey) return
  log.info('mdns: network set changed — re-advertising')
  startMdns(port, addresses)
}

/** The `.local` hostname once mDNS has finished probing, else null (caller
 *  should fall back to a plain LAN IP until/unless this resolves). */
export function getMdnsHostname(): string | null {
  return resolvedHost
}

export function stopMdns(): void {
  for (const r of responders) {
    try {
      r.bonjour.unpublishAll()
      r.bonjour.destroy()
    } catch {
      /* best-effort on shutdown */
    }
  }
  responders = []
  resolvedHost = null
}
