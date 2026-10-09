import { describe, it, expect, vi, beforeEach } from 'vitest'

// os.networkInterfaces() is mocked per-test below — getLocalIP() must pick
// the right one out of several candidates, which is exactly what a VPN,
// Docker/Parallels/VMware virtual adapter, or other virtual network
// interface makes ambiguous on a real machine.
const mockInterfaces = vi.fn()
vi.mock('os', () => ({
  networkInterfaces: () => mockInterfaces()
}))

// Re-imported fresh per test file run; getLocalIP reads networkInterfaces()
// on every call (no caching), so re-mocking between tests is enough.
const { getLocalIP } = await import('../../main/webRemote')

beforeEach(() => {
  mockInterfaces.mockReset()
})

function iface(address: string, opts: Partial<{ internal: boolean; family: string }> = {}) {
  return [{ address, family: 'IPv4', internal: false, ...opts }]
}

describe('getLocalIP', () => {
  it('picks the only private address when there is just one real adapter', () => {
    mockInterfaces.mockReturnValue({ en0: iface('10.0.0.124') })
    expect(getLocalIP()).toBe('10.0.0.124')
  })

  it('ignores internal/loopback interfaces', () => {
    mockInterfaces.mockReturnValue({
      lo0: iface('127.0.0.1', { internal: true }),
      en0: iface('10.0.0.124')
    })
    expect(getLocalIP()).toBe('10.0.0.124')
  })

  it('ignores IPv6 entries', () => {
    mockInterfaces.mockReturnValue({
      en0: [
        { address: 'fe80::1', family: 'IPv6', internal: false },
        { address: '10.0.0.124', family: 'IPv4', internal: false }
      ]
    })
    expect(getLocalIP()).toBe('10.0.0.124')
  })

  it('prefers a real Wi-Fi/Ethernet adapter over a VPN adapter that also has a private address, regardless of enumeration order', () => {
    // Reproduces the real-world bug: a VPN client (utun/tap/tun-style name
    // on macOS/Linux, or a "VPN"/virtual adapter on Windows) can hand out an
    // address in the same private ranges getLocalIP() already trusts
    // (10.x/172.16-31.x/192.168.x), and the old code just took whichever
    // came first in Object.values(networkInterfaces()) — OS-dependent,
    // unrelated to which adapter a phone on the church Wi-Fi could actually
    // reach.
    mockInterfaces.mockReturnValue({
      utun3: iface('10.8.0.2'), // VPN, enumerated first
      en0: iface('10.0.0.124') // the real Wi-Fi adapter, enumerated second
    })
    expect(getLocalIP()).toBe('10.0.0.124')
  })

  it('still prefers the real adapter when the VPN is enumerated after it', () => {
    mockInterfaces.mockReturnValue({
      en0: iface('10.0.0.124'),
      utun3: iface('10.8.0.2')
    })
    expect(getLocalIP()).toBe('10.0.0.124')
  })

  it('recognizes common Windows virtual-adapter name patterns too', () => {
    mockInterfaces.mockReturnValue({
      'vEthernet (Default Switch)': iface('172.28.128.1'),
      'VMware Network Adapter VMnet8': iface('192.168.197.1'),
      'Ethernet': iface('192.168.1.50')
    })
    expect(getLocalIP()).toBe('192.168.1.50')
  })

  it('falls back to whatever is available if every candidate looks virtual (never returns nothing)', () => {
    mockInterfaces.mockReturnValue({
      utun3: iface('10.8.0.2')
    })
    expect(getLocalIP()).toBe('10.8.0.2')
  })

  it('falls back to "localhost" when there are no usable addresses at all', () => {
    mockInterfaces.mockReturnValue({})
    expect(getLocalIP()).toBe('localhost')
  })
})
