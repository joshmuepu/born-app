import { describe, it, expect, vi, beforeEach } from 'vitest'
import { net } from 'electron'
import { cmpVersion, sameMajor, checkForUpdate } from '../../main/updateCheck'

beforeEach(() => {
  vi.mocked(net.fetch).mockReset()
})

describe('cmpVersion', () => {
  it('detects a newer version', () => {
    expect(cmpVersion('1.0.3', '1.0.2')).toBeGreaterThan(0)
    expect(cmpVersion('1.1.0', '1.0.9')).toBeGreaterThan(0)
    expect(cmpVersion('2.0.0', '1.9.9')).toBeGreaterThan(0)
  })

  it('detects an older or equal version', () => {
    expect(cmpVersion('1.0.2', '1.0.3')).toBeLessThan(0)
    expect(cmpVersion('1.0.3', '1.0.3')).toBe(0)
  })

  it('ignores a leading v', () => {
    expect(cmpVersion('v1.0.3', '1.0.2')).toBeGreaterThan(0)
    expect(cmpVersion('1.0.3', 'v1.0.3')).toBe(0)
  })

  it('treats missing segments as zero', () => {
    expect(cmpVersion('1.1', '1.1.0')).toBe(0)
    expect(cmpVersion('1.2', '1.1.9')).toBeGreaterThan(0)
  })
})

describe('sameMajor', () => {
  it('is true within the same major version', () => {
    expect(sameMajor('1.12.0', '1.0.0')).toBe(true)
    expect(sameMajor('2.0.0-dev.1', '2.3.4')).toBe(true)
  })

  it('is false across a major version — a v1 release is not an "update" for a v2 build, or vice versa', () => {
    expect(sameMajor('1.12.0', '2.0.0-dev.1')).toBe(false)
    expect(sameMajor('2.0.0-dev.1', '1.12.0')).toBe(false)
  })

  it('ignores a leading v and any pre-release suffix', () => {
    expect(sameMajor('v1.5.0', '1.0.0')).toBe(true)
  })
})

describe('checkForUpdate — a slow/stalled connection, not just a dead one', () => {
  it('passes a timeout signal to net.fetch, so a stalled (not just a failed) request can still abort', async () => {
    vi.mocked(net.fetch).mockResolvedValue(
      new Response(JSON.stringify({ tag_name: 'v9.9.9' }), { status: 200 })
    )
    await checkForUpdate()
    expect(net.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ signal: expect.anything() })
    )
  })

  it('reports checkFailed (not "up to date") when the request times out, same as any other network failure', async () => {
    // Simulates what net.fetch itself does once the real timeout fires —
    // this pins the code's own reaction to that failure, without depending
    // on fake timers racing an implementation-internal AbortSignal.timeout.
    vi.mocked(net.fetch).mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'))
    const info = await checkForUpdate()
    expect(info.checkFailed).toBe(true)
    expect(info.hasUpdate).toBe(false)
  })
})
