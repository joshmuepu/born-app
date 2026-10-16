/**
 * networkMeta.ts — best-effort lookup of Wi-Fi names (and macOS port labels)
 * so the Remote panel can say "Wi-Fi (CBCI-3170)" instead of just "Wi-Fi".
 *
 * Safe by construction: fixed commands, no shell, no user input in the
 * arguments, hard timeout, and every failure (command missing, locale
 * differences, OS location-permission gating) just means "no name" — the
 * panel falls back to the adapter name. Never blocks the UI: callers read the
 * cached result and a refresh runs in the background.
 */
import { execFile } from 'child_process'
import {
  type NetworkMeta,
  parseAirportNetwork,
  parseHardwarePorts,
  parseNetshWlan
} from './networks'

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { timeout: 3000, windowsHide: true, maxBuffer: 256 * 1024 }, (err, stdout) =>
        resolve(err ? '' : String(stdout))
      )
    } catch {
      resolve('')
    }
  })
}

async function gather(): Promise<NetworkMeta> {
  const meta: NetworkMeta = {}
  if (process.platform === 'win32') {
    meta.ssidByAdapter = parseNetshWlan(await run('netsh', ['wlan', 'show', 'interfaces']))
  } else if (process.platform === 'darwin') {
    const ports = parseHardwarePorts(await run('networksetup', ['-listallhardwareports']))
    meta.portLabelByAdapter = ports
    const ssids = new Map<string, string>()
    for (const [device, label] of ports) {
      if (!/wi-?fi|airport/i.test(label)) continue
      const ssid = parseAirportNetwork(await run('networksetup', ['-getairportnetwork', device]))
      if (ssid) ssids.set(device, ssid)
    }
    meta.ssidByAdapter = ssids
  }
  return meta
}

const STALE_MS = 15_000
let cached: NetworkMeta = {}
let fetchedAt = 0
let inFlight = false

/** Cached meta; kicks off a background refresh when stale. Never awaits. */
export function getNetworkMeta(): NetworkMeta {
  if (!inFlight && Date.now() - fetchedAt > STALE_MS) {
    inFlight = true
    fetchedAt = Date.now()
    gather()
      .then((m) => {
        cached = m
      })
      .catch(() => {})
      .finally(() => {
        inFlight = false
      })
  }
  return cached
}
