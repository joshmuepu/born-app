import { describe, it, expect } from 'vitest'
import {
  listNetworks,
  chooseDefault,
  buildDiagnosticHints,
  windowsFirewallCommands,
  parseNetshWlan,
  parseHardwarePorts,
  parseAirportNetwork,
  subnetOf,
  normalizeIp,
  isLoopbackAddress,
  type RemoteNetwork
} from '../../main/networks'

const v4 = (address: string, extra: object = {}) => [
  { address, family: 'IPv4', internal: false, ...extra }
]

// The exact machine from the church: both orders, since os.networkInterfaces()
// enumeration order is OS-dependent and was what picked the wrong one.
const CHURCH_ETH_FIRST = { 'Ethernet 2': v4('172.30.20.126'), 'Wi-Fi': v4('10.1.10.102') }
const CHURCH_WIFI_FIRST = { 'Wi-Fi': v4('10.1.10.102'), 'Ethernet 2': v4('172.30.20.126') }
const SSID = { ssidByAdapter: new Map([['Wi-Fi', 'CBCI-3170']]) }

describe('listNetworks — the church machine', () => {
  it('lists both adapters with friendly names, Wi-Fi first, whatever the OS order', () => {
    for (const ifaces of [CHURCH_ETH_FIRST, CHURCH_WIFI_FIRST]) {
      const nets = listNetworks(ifaces, SSID)
      expect(nets.map((n) => [n.label, n.address, n.usable])).toEqual([
        ['Wi-Fi (CBCI-3170)', '10.1.10.102', true],
        ['Ethernet 2', '172.30.20.126', true]
      ])
    }
  })

  it('falls back to the plain adapter name when the SSID cannot be read', () => {
    expect(listNetworks(CHURCH_ETH_FIRST)[0].label).toBe('Wi-Fi')
  })
})

describe('listNetworks — filtering', () => {
  const messy = {
    lo0: v4('127.0.0.1', { internal: true }),
    'Ethernet 2': v4('172.30.20.126'),
    'Wi-Fi': v4('10.1.10.102'),
    'OpenVPN TAP-Windows': v4('10.8.0.2'),
    'vEthernet (Default Switch)': v4('172.28.64.1'),
    'vEthernet (WSL)': v4('172.22.0.1'),
    'VirtualBox Host-Only': v4('192.168.56.1'),
    'Ethernet 3': v4('169.254.44.9'), // cable unplugged / no DHCP
    'Wi-Fi 2': [{ address: 'fe80::1', family: 'IPv6', internal: false }] // IPv6-only
  }
  const nets = listNetworks(messy, SSID)

  it('drops loopback and IPv6-only adapters entirely', () => {
    expect(nets.find((n) => n.address === '127.0.0.1')).toBeUndefined()
    expect(nets.find((n) => n.name === 'Wi-Fi 2')).toBeUndefined()
  })

  it('shows only the two real networks by default', () => {
    expect(nets.filter((n) => n.usable).map((n) => n.address)).toEqual(['10.1.10.102', '172.30.20.126'])
  })

  it('keeps VPN, virtual switches and link-local available under "Show all", with a reason', () => {
    const hidden = nets.filter((n) => !n.usable)
    expect(hidden.map((n) => n.address).sort()).toEqual(
      ['10.8.0.2', '169.254.44.9', '172.22.0.1', '172.28.64.1', '192.168.56.1'].sort()
    )
    expect(hidden.every((n) => n.hiddenReason)).toBe(true)
    // …and hidden entries always sort after every usable one
    expect(nets.slice(0, 2).every((n) => n.usable)).toBe(true)
  })

  it('classifies kinds', () => {
    const kind = (name: string) => nets.find((n) => n.name === name)?.kind
    expect(kind('Wi-Fi')).toBe('wifi')
    expect(kind('Ethernet 2')).toBe('ethernet')
    expect(kind('OpenVPN TAP-Windows')).toBe('vpn')
    expect(kind('vEthernet (WSL)')).toBe('virtual')
  })

  it('uses the macOS hardware-port label to tell Wi-Fi from Ethernet (en0/en1)', () => {
    const nets = listNetworks(
      { en0: v4('192.168.1.20'), en5: v4('10.0.0.9'), bridge100: v4('192.168.64.1') },
      {
        portLabelByAdapter: new Map([
          ['en0', 'Wi-Fi'],
          ['en5', 'USB 10/100/1000 LAN']
        ]),
        ssidByAdapter: new Map([['en0', 'Home']])
      }
    )
    expect(nets[0]).toMatchObject({ name: 'en0', kind: 'wifi', label: 'Wi-Fi (Home)' })
    expect(nets[1]).toMatchObject({ name: 'en5', kind: 'ethernet' })
    expect(nets[2]).toMatchObject({ name: 'bridge100', usable: false })
  })
})

describe('chooseDefault', () => {
  it('church case: prefers Wi-Fi over Ethernet regardless of enumeration order, and says why', () => {
    for (const ifaces of [CHURCH_ETH_FIRST, CHURCH_WIFI_FIRST]) {
      const c = chooseDefault(listNetworks(ifaces, SSID), null)
      expect(c.network?.address).toBe('10.1.10.102')
      expect(c.reason).toBe('Showing Wi-Fi (CBCI-3170) because phones usually connect over Wi-Fi.')
    }
  })

  it('prefers a physical Ethernet adapter when there is no Wi-Fi', () => {
    const c = chooseDefault(listNetworks({ 'Ethernet 2': v4('172.30.20.126'), Ethernet: v4('192.168.0.5') }), null)
    expect(c.network?.address).toBe('172.30.20.126')
  })

  it('prefers a private Wi-Fi over a public-range Wi-Fi/Ethernet', () => {
    const c = chooseDefault(listNetworks({ Ethernet: v4('8.8.4.4'), 'Wi-Fi': v4('192.168.1.7') }), null)
    expect(c.network?.address).toBe('192.168.1.7')
  })

  it('remembered network wins over the Wi-Fi preference', () => {
    const nets = listNetworks(CHURCH_ETH_FIRST, SSID)
    const c = chooseDefault(nets, { name: 'Ethernet 2', address: '172.30.20.126' })
    expect(c.network?.address).toBe('172.30.20.126')
    expect(c.reason).toBe('Showing Ethernet 2 because a phone connected from it last time.')
  })

  it('remembered network still matches after a DHCP address change (same adapter)', () => {
    const c = chooseDefault(listNetworks(CHURCH_ETH_FIRST, SSID), { name: 'Ethernet 2', address: '172.30.20.99' })
    expect(c.network?.address).toBe('172.30.20.126')
  })

  it('ignores a remembered network that is gone, or that is now hidden', () => {
    const nets = listNetworks({ ...CHURCH_ETH_FIRST, 'OpenVPN TAP': v4('10.8.0.2') }, SSID)
    expect(chooseDefault(nets, { name: 'Old Adapter', address: '1.2.3.4' }).network?.address).toBe('10.1.10.102')
    expect(chooseDefault(nets, { name: 'OpenVPN TAP', address: '10.8.0.2' }).network?.address).toBe('10.1.10.102')
  })

  it('single network: no explanation line, nothing changes for single-network computers', () => {
    const c = chooseDefault(listNetworks({ en0: v4('10.0.0.124') }), null)
    expect(c).toMatchObject({ reason: null })
    expect(c.network?.address).toBe('10.0.0.124')
    const r = chooseDefault(listNetworks({ en0: v4('10.0.0.124') }), { name: 'en0', address: '10.0.0.124' })
    expect(r.reason).toBeNull()
  })

  it('VPN + one real adapter counts as a single network', () => {
    const c = chooseDefault(listNetworks({ utun3: v4('10.8.0.2'), en0: v4('10.0.0.124') }), null)
    expect(c).toMatchObject({ reason: null })
    expect(c.network?.address).toBe('10.0.0.124')
  })

  it('falls back to a hidden network rather than nothing, and nothing only when there is no address', () => {
    const onlyVpn = chooseDefault(listNetworks({ utun3: v4('10.8.0.2') }), null)
    expect(onlyVpn.network?.address).toBe('10.8.0.2')
    expect(onlyVpn.reason).toMatch(/best guess/)
    expect(chooseDefault([], null)).toEqual({ network: null, reason: null })
  })
})

describe('diagnostic hints', () => {
  const two = listNetworks(CHURCH_ETH_FIRST, SSID)
  const one = listNetworks({ 'Wi-Fi': v4('10.1.10.102') })
  const ok = (nets: RemoteNetwork[]) => nets.map((n) => ({ address: n.address, ok: true }))

  it('tells the operator to try the other address when no phone has connected on a multi-network machine', () => {
    const h = buildDiagnosticHints({ platform: 'darwin', networks: two, probes: ok(two), phoneCount: 0 })
    expect(h.join(' ')).toMatch(/same network as the address shown.*try the other address/)
  })

  it('says nothing extra for a healthy single-network, non-Windows machine', () => {
    expect(buildDiagnosticHints({ platform: 'darwin', networks: one, probes: ok(one), phoneCount: 0 })).toEqual([])
  })

  it('adds the Windows firewall hint only on Windows with no phone yet', () => {
    expect(buildDiagnosticHints({ platform: 'win32', networks: one, probes: ok(one), phoneCount: 0 }).join()).toMatch(/Firewall/)
    expect(buildDiagnosticHints({ platform: 'win32', networks: one, probes: ok(one), phoneCount: 1 })).toEqual([])
  })

  it('flags an address this computer could not even reach itself on', () => {
    const h = buildDiagnosticHints({
      platform: 'darwin',
      networks: two,
      probes: [{ address: '10.1.10.102', ok: true }, { address: '172.30.20.126', ok: false }],
      phoneCount: 1
    })
    expect(h[0]).toMatch(/could not reach itself at 172\.30\.20\.126/)
  })

  it('gives the exact copyable firewall commands for the port', () => {
    expect(windowsFirewallCommands(4316)).toEqual([
      'Get-NetConnectionProfile',
      'New-NetFirewallRule -DisplayName "BORN Remote" -Direction Inbound -Protocol TCP -LocalPort 4316 -Action Allow -Profile Private'
    ])
  })
})

describe('OS output parsers', () => {
  it('parseNetshWlan reads the connected SSID per adapter, not the BSSID', () => {
    const out = [
      'There is 1 interface on the system:',
      '',
      '    Name                   : Wi-Fi',
      '    Description            : Intel(R) Wi-Fi 6 AX201',
      '    State                  : connected',
      '    SSID                   : CBCI-3170',
      '    BSSID                  : aa:bb:cc:dd:ee:ff',
      '    Signal                 : 91%'
    ].join('\r\n')
    expect([...parseNetshWlan(out)]).toEqual([['Wi-Fi', 'CBCI-3170']])
  })

  it('parseNetshWlan ignores adapters that are not connected', () => {
    expect(parseNetshWlan('    Name : Wi-Fi\n    State : disconnected\n    SSID : Old\n').size).toBe(0)
    expect(parseNetshWlan('').size).toBe(0)
  })

  it('parseHardwarePorts maps devices to port labels', () => {
    const out = 'Hardware Port: Wi-Fi\nDevice: en0\nEthernet Address: x\n\nHardware Port: Thunderbolt Bridge\nDevice: bridge0\n'
    expect(Object.fromEntries(parseHardwarePorts(out))).toEqual({ en0: 'Wi-Fi', bridge0: 'Thunderbolt Bridge' })
  })

  it('parseAirportNetwork', () => {
    expect(parseAirportNetwork('Current Wi-Fi Network: CBCI-3170\n')).toBe('CBCI-3170')
    expect(parseAirportNetwork('You are not associated with an AirPort network.\n')).toBeNull()
  })
})

describe('address helpers', () => {
  it('subnetOf / normalizeIp / isLoopbackAddress', () => {
    expect(subnetOf('10.1.10.55')).toBe('10.1.10.0/24')
    expect(subnetOf('::ffff:10.1.10.55')).toBe('10.1.10.0/24')
    expect(normalizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4')
    expect(isLoopbackAddress('::1') && isLoopbackAddress('127.0.0.1') && isLoopbackAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('10.1.10.2')).toBe(false)
  })
})
