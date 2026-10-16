/**
 * networks.ts — decides which of this computer's network addresses the
 * remote should advertise (QR, copyable address), in what order, and why.
 *
 * Pure on purpose (the OS interface list is passed in): the church failure
 * this exists for — Ethernet 172.30.20.126 *and* Wi-Fi 10.1.10.102 both up,
 * phone only able to reach the Wi-Fi one — is exactly the kind of thing that
 * must be reproducible in a unit test without a second real adapter.
 *
 * The HTTP server itself binds every interface (see webRemote.ts), so
 * nothing here affects what the server *answers on* — only what the operator
 * is shown and told to point a phone at.
 */
import { networkInterfaces, type NetworkInterfaceInfo } from 'os'

/** The OS interface list — or, for dev/QA only, `BORN_FAKE_NETWORKS`
 *  (JSON: `{"ifaces": <os.networkInterfaces() shape>, "ssids": {"Wi-Fi": "Name"}}`)
 *  so a one-adapter dev machine can show the multi-adapter church layout in
 *  the real app. Same spirit as BORN_REMOTE_PORT / BORN_MDNS_NAME: never set
 *  for a real install. A malformed value is ignored. */
export function readInterfaces(): NodeJS.Dict<NetworkInterfaceInfo[]> {
  const fake = fakeNetworks()
  return fake ? fake.ifaces : networkInterfaces()
}

export function fakeSsids(): Map<string, string> | null {
  const fake = fakeNetworks()
  return fake?.ssids ? new Map(Object.entries(fake.ssids)) : null
}

function fakeNetworks(): { ifaces: NodeJS.Dict<NetworkInterfaceInfo[]>; ssids?: Record<string, string> } | null {
  const raw = process.env.BORN_FAKE_NETWORKS
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed.ifaces === 'object' ? parsed : null
  } catch {
    return null
  }
}

export type NetworkKind = 'wifi' | 'ethernet' | 'vpn' | 'virtual' | 'other'

export interface RemoteNetwork {
  /** `${adapter name}|${address}` — stable across polls, unique per address. */
  id: string
  /** OS adapter name, e.g. "Ethernet 2", "Wi-Fi", "en0". */
  name: string
  /** Operator-facing name, e.g. "Wi-Fi (CBCI-3170)" or "Ethernet 2". */
  label: string
  address: string
  kind: NetworkKind
  ssid: string | null
  /** RFC1918 private range — the only kind a phone on a normal LAN can reach. */
  private: boolean
  /** Shown by default. False = VPN / virtual switch / link-local, only listed
   *  under "Show all". */
  usable: boolean
  /** Why it is hidden by default, for the "Show all" list. */
  hiddenReason: string | null
}

/** Optional facts the OS interface list itself doesn't carry. */
export interface NetworkMeta {
  /** adapter name -> connected Wi-Fi network name */
  ssidByAdapter?: Map<string, string>
  /** adapter name -> OS hardware-port label ("Wi-Fi", "Ethernet"…). macOS
   *  names adapters en0/en1, so this is the only way to tell Wi-Fi from
   *  Ethernet there. */
  portLabelByAdapter?: Map<string, string>
}

// VPN tunnels: they hand out ordinary-looking private addresses a phone on
// the church Wi-Fi can never reach.
const VPN_NAME = /utun|^tun|^tap|ppp|wireguard|^wg|ipsec|tailscale|zerotier|vpn/i
// OS-level virtual switches / hypervisor / container adapters. Same story.
const VIRTUAL_NAME = /awdl|llw|bridge|vnic|vmnet|vethernet|vmware|virtualbox|hyper-v|wsl|docker/i
const WIFI_NAME = /wi-?fi|wlan|wireless|airport/i
const ETHERNET_NAME = /ethernet|^eth\d|^en\d+$|\blan\b/i

/** Matches the old single-boolean notion used by the diagnostics output. */
export function looksVirtual(name: string): boolean {
  return VPN_NAME.test(name) || VIRTUAL_NAME.test(name)
}

export function isPrivateAddress(addr: string): boolean {
  return (
    addr.startsWith('192.168.') ||
    addr.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(addr)
  )
}

export function isLinkLocal(addr: string): boolean {
  return addr.startsWith('169.254.')
}

/** `::ffff:10.1.10.5` -> `10.1.10.5` (an IPv4 client seen on a dual-stack socket). */
export function normalizeIp(addr: string): string {
  return addr.startsWith('::ffff:') ? addr.slice(7) : addr
}

export function isLoopbackAddress(addr: string): boolean {
  const a = normalizeIp(addr)
  return a === '::1' || a.startsWith('127.')
}

/** "10.1.10.102" -> "10.1.10.0/24". Display only — not real subnet math. */
export function subnetOf(addr: string): string {
  const a = normalizeIp(addr)
  const m = /^(\d+\.\d+\.\d+)\.\d+$/.exec(a)
  return m ? `${m[1]}.0/24` : a
}

function kindOf(name: string, portLabel: string | undefined): NetworkKind {
  if (VPN_NAME.test(name)) return 'vpn'
  if (VIRTUAL_NAME.test(name)) return 'virtual'
  const probe = portLabel ?? name
  if (WIFI_NAME.test(probe) || WIFI_NAME.test(name)) return 'wifi'
  if (ETHERNET_NAME.test(probe) || ETHERNET_NAME.test(name)) return 'ethernet'
  // A macOS port label we don't recognise ("Thunderbolt Bridge", "iPhone USB")
  // is not a LAN a phone can be on.
  if (portLabel && /bridge|thunderbolt|iphone|ipad|usb/i.test(portLabel)) return 'virtual'
  return 'other'
}

/**
 * Every non-loopback IPv4 address on this machine, classified and ordered
 * best-first (usable before hidden; Wi-Fi, then Ethernet, then other; private
 * before public). Ordering is by *kind*, never by OS enumeration order — the
 * enumeration order is what picked the wrong adapter at church.
 */
export function listNetworks(
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]>,
  meta: NetworkMeta = {}
): RemoteNetwork[] {
  const out: RemoteNetwork[] = []
  for (const [name, entries] of Object.entries(ifaces)) {
    for (const net of entries ?? []) {
      const family = net.family as string | number
      if (family !== 'IPv4' && family !== 4) continue
      if (net.internal) continue
      const portLabel = meta.portLabelByAdapter?.get(name)
      const kind = kindOf(name, portLabel)
      const ssid = kind === 'wifi' ? (meta.ssidByAdapter?.get(name) ?? null) : null
      const priv = isPrivateAddress(net.address)
      let usable = true
      let hiddenReason: string | null = null
      if (isLinkLocal(net.address)) {
        usable = false
        hiddenReason = 'Not connected to a real network (169.254 address)'
      } else if (kind === 'vpn') {
        usable = false
        hiddenReason = 'VPN — phones on the church Wi-Fi cannot reach this'
      } else if (kind === 'virtual') {
        usable = false
        hiddenReason = 'Virtual adapter — phones cannot reach this'
      }
      const baseLabel = kind === 'wifi' && !WIFI_NAME.test(name) ? 'Wi-Fi' : name
      out.push({
        id: `${name}|${net.address}`,
        name,
        label: ssid ? `${baseLabel} (${ssid})` : baseLabel,
        address: net.address,
        kind,
        ssid,
        private: priv,
        usable,
        hiddenReason
      })
    }
  }
  // Array.prototype.sort is stable, so equal ranks keep OS order — harmless
  // now, since it only breaks ties between genuinely equivalent adapters.
  return out.sort((a, b) => rank(a) - rank(b))
}

function rank(n: RemoteNetwork): number {
  if (isLinkLocal(n.address)) return 90
  const hidden = n.usable ? 0 : 40
  const kind = n.kind === 'wifi' ? 0 : n.kind === 'ethernet' ? 1 : 2
  return hidden + (n.private ? 0 : 10) + kind
}

export interface RememberedNetwork {
  name: string
  address: string
}

export interface DefaultChoice {
  network: RemoteNetwork | null
  /** One short line for the panel; null when there is nothing to explain
   *  (a single network — the common case, which must look exactly as before). */
  reason: string | null
}

/**
 * The network to show first. Order of preference:
 *  1. the network a phone last connected from (if it is still present),
 *  2. a Wi-Fi adapter with a private address,
 *  3. a physical Ethernet adapter,
 *  4. anything else — and only if nothing normal exists, even VPN/virtual
 *     (the old behaviour never returned "nothing" while any address existed).
 */
export function chooseDefault(
  networks: RemoteNetwork[],
  remembered: RememberedNetwork | null
): DefaultChoice {
  const usable = networks.filter((n) => n.usable)
  if (usable.length === 0) {
    const fallback = networks[0] ?? null
    return {
      network: fallback,
      reason: fallback
        ? 'No normal network was found, so this is the best guess — phones may not be able to reach it.'
        : null
    }
  }
  const single = usable.length === 1
  if (remembered) {
    const exact = usable.find((n) => n.name === remembered.name && n.address === remembered.address)
    // Same adapter, new DHCP lease — still the network the phone uses.
    const byName = usable.find((n) => n.name === remembered.name)
    const hit = exact ?? byName
    if (hit && !single) {
      return { network: hit, reason: `Showing ${hit.label} because a phone connected from it last time.` }
    }
    if (hit) return { network: hit, reason: null }
  }
  const best = usable[0]
  if (single) return { network: best, reason: null }
  const others = usable.slice(1)
  if (best.kind === 'wifi') {
    return {
      network: best,
      reason: `Showing ${best.label} because phones usually connect over Wi-Fi.`
    }
  }
  if (best.kind === 'ethernet') {
    const anyWifi = others.some((n) => n.kind === 'wifi')
    return {
      network: best,
      reason: anyWifi
        ? `Showing ${best.label}. The Wi-Fi network has a public-range address, so it is listed second.`
        : `Showing ${best.label} because there is no Wi-Fi connection on this computer.`
    }
  }
  return { network: best, reason: `Showing ${best.label}. If your phone cannot connect, try another network below.` }
}

// ── Reading Wi-Fi names / port labels from the OS (parsers are pure) ─────────

/** `netsh wlan show interfaces` -> adapter name -> SSID, connected ones only. */
export function parseNetshWlan(stdout: string): Map<string, string> {
  const out = new Map<string, string>()
  let name: string | null = null
  let ssid: string | null = null
  let connected = false
  const flush = (): void => {
    if (name && ssid && connected) out.set(name, ssid)
    name = null
    ssid = null
    connected = false
  }
  for (const raw of stdout.split(/\r?\n/)) {
    const m = /^\s*([^:]+?)\s*:\s*(.*?)\s*$/.exec(raw)
    if (!m) continue
    const key = m[1]
    const val = m[2]
    if (key === 'Name') {
      flush()
      name = val
    } else if (key === 'SSID') {
      ssid = val || null
    } else if (key === 'State') {
      connected = /^connected$/i.test(val)
    }
  }
  flush()
  return out
}

/** `networksetup -listallhardwareports` -> device (en0) -> port label (Wi-Fi). */
export function parseHardwarePorts(stdout: string): Map<string, string> {
  const out = new Map<string, string>()
  let port: string | null = null
  for (const raw of stdout.split(/\r?\n/)) {
    const p = /^Hardware Port:\s*(.+?)\s*$/.exec(raw)
    if (p) {
      port = p[1]
      continue
    }
    const d = /^Device:\s*(\S+)\s*$/.exec(raw)
    if (d && port) {
      out.set(d[1], port)
      port = null
    }
  }
  return out
}

/** `networksetup -getairportnetwork en0` -> SSID, or null when not associated
 *  (macOS may also redact the name; that reads as "not associated" too). */
export function parseAirportNetwork(stdout: string): string | null {
  const m = /^Current Wi-Fi Network:\s*(.+?)\s*$/m.exec(stdout)
  return m ? m[1] : null
}

// ── Connection-check hints ────────────────────────────────────────────────────

export interface ProbeResult {
  address: string
  ok: boolean
}

/** The two PowerShell commands the operator can copy on Windows. BORN never
 *  runs these itself — changing firewall rules is the operator's call. */
export function windowsFirewallCommands(port: number): string[] {
  return [
    'Get-NetConnectionProfile',
    `New-NetFirewallRule -DisplayName "BORN Remote" -Direction Inbound -Protocol TCP -LocalPort ${port} -Action Allow -Profile Private`
  ]
}

/** Plain-language likely causes, shown in the connection check. Only says
 *  something when there is a real reason to. */
export function buildDiagnosticHints(input: {
  platform: string
  networks: RemoteNetwork[]
  probes: ProbeResult[]
  phoneCount: number
}): string[] {
  const hints: string[] = []
  const usable = input.networks.filter((n) => n.usable)
  // Only networks the operator can actually pick matter here — a hidden VPN or
  // virtual adapter failing its self-test is expected and not worth alarming over.
  const usableAddrs = new Set(usable.map((n) => n.address))
  const failed = input.probes.filter((p) => !p.ok && usableAddrs.has(p.address))
  if (failed.length > 0) {
    hints.push(
      `This computer could not reach itself at ${failed.map((p) => p.address).join(', ')}. ` +
        'Something on this computer (a firewall or security program) may be blocking the remote on that network.'
    )
  }
  if (input.phoneCount === 0) {
    if (usable.length > 1) {
      hints.push(
        'No phone has connected yet. Your phone must be on the same network as the address shown. ' +
          'If it cannot connect, try the other address.'
      )
    }
    if (input.platform === 'win32') {
      hints.push(
        'If the phone is on the right network and still cannot connect, Windows Firewall may be blocking it. ' +
          'The commands below show whether this network is Private or Public, and allow the remote through.'
      )
    }
  }
  return hints
}
