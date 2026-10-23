import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { app, net, shell } from 'electron'
import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { cmpVersion, sameMajor, checkForUpdate, downloadUpdate, windowsUpdateScriptFor } from '../../main/updateCheck'

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

/* ── The download itself ────────────────────────────────────────────────────────
 * The update CHECK is a few hundred bytes from api.github.com; the DOWNLOAD is a
 * ~175 MB installer from GitHub's CDN. A church network (TLS-inspecting antivirus,
 * a proxy, tired WiFi) kills the second one long before the first. These pin what
 * must happen when it does — above all, that a half-downloaded installer is never
 * handed back as "ok" and then run.
 */
describe('downloadUpdate — a network that drops the connection, and a half-downloaded installer', () => {
  const realPlatform = process.platform
  const asWindows = (on: boolean): void => {
    Object.defineProperty(process, 'platform', { value: on ? 'win32' : realPlatform, configurable: true })
  }
  /** A streamed response: the chunks it really sends, and the length it claims. */
  const streamed = (chunks: string[], declared?: number, stallAfter = -1): Response => {
    let i = 0
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (stallAfter >= 0 && i >= stallAfter) return new Promise<void>(() => {}) // never resolves: the connection goes quiet
        if (i >= chunks.length) { c.close(); return }
        c.enqueue(new TextEncoder().encode(chunks[i++]))
        return
      }
    })
    const sent = chunks.join('').length
    return new Response(body, { status: 200, headers: { 'content-length': String(declared ?? sent) } })
  }
  /** Put a real update in the cache the way the app does: by running the check. */
  const armed = async (): Promise<void> => {
    vi.mocked(net.fetch).mockResolvedValue(
      new Response(JSON.stringify({ tag_name: 'v1.13.2' }), { status: 200 })
    )
    await checkForUpdate()
    vi.mocked(net.fetch).mockReset()
  }

  beforeEach(() => {
    asWindows(true)
    vi.mocked(app.getVersion).mockReturnValue('1.13.1')
    vi.mocked(app.getPath).mockReturnValue(mkdtempSync(join(tmpdir(), 'born-upd-')))
    vi.mocked(shell.openExternal).mockClear()
  })
  afterEach(() => { asWindows(false) })

  it('refuses a download that stopped early instead of reporting success (a truncated installer must never be run)', async () => {
    await armed()
    vi.mocked(net.fetch).mockResolvedValue(streamed(['half an installer'], 999999))
    const r = await downloadUpdate(null, { retries: 1, backoffMs: 0 })
    expect(r.ok).toBe(false)
    expect(r.path).toBeUndefined()
  })

  it('keeps the file only when every byte arrived', async () => {
    await armed()
    vi.mocked(net.fetch).mockResolvedValue(streamed(['a whole installer']))
    const r = await downloadUpdate(null, { retries: 1, backoffMs: 0 })
    expect(r.ok).toBe(true)
    expect(readFileSync(r.path as string, 'utf8')).toBe('a whole installer')
  })

  it('tries again when the connection is reset, instead of giving up on the first failure', async () => {
    await armed()
    vi.mocked(net.fetch)
      .mockRejectedValueOnce(new Error('net::ERR_SSL_PROTOCOL_ERROR'))
      .mockResolvedValue(streamed(['installer bytes']))
    const r = await downloadUpdate(null, { retries: 3, backoffMs: 0 })
    expect(r.ok).toBe(true)
    expect(net.fetch).toHaveBeenCalledTimes(2)
  })

  it('gives up on a connection that goes quiet instead of downloading forever', async () => {
    await armed()
    vi.mocked(net.fetch).mockResolvedValue(streamed(['first chunk', 'never sent'], 999999, 1))
    const r = await downloadUpdate(null, { retries: 1, backoffMs: 0, stallMs: 60 })
    expect(r.ok).toBe(false)
    expect(String(r.error)).toMatch(/stopped sending|stalled/i)
  })

  it('names itself to the network the same way the check does, so it is one recognisable request', async () => {
    await armed()
    vi.mocked(net.fetch).mockResolvedValue(streamed(['installer bytes']))
    await downloadUpdate(null, { retries: 1, backoffMs: 0 })
    expect(net.fetch).toHaveBeenCalledWith(
      expect.stringContaining('BORN-1.13.2-Windows-Setup.exe'),
      expect.objectContaining({ headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('BORN/') }) })
    )
  })

  it('after it has really failed, opens the download page in the browser and says so', async () => {
    await armed()
    vi.mocked(net.fetch).mockRejectedValue(new Error('net::ERR_SSL_PROTOCOL_ERROR'))
    const r = await downloadUpdate(null, { retries: 2, backoffMs: 0 })
    expect(r.ok).toBe(false)
    expect(shell.openExternal).toHaveBeenCalledTimes(1)
    expect(String(r.error)).toMatch(/browser/i)
  })

  it('checks the size the release itself reports, not only the one the connection claims', async () => {
    vi.mocked(net.fetch).mockResolvedValue(
      new Response(JSON.stringify({
        tag_name: 'v1.13.2',
        assets: [{ name: 'BORN-1.13.2-Windows-Setup.exe', size: 183610852, browser_download_url: 'https://example.invalid/real.exe' }]
      }), { status: 200 })
    )
    const info = await checkForUpdate()
    expect(info.assetSize).toBe(183610852)
    vi.mocked(net.fetch).mockReset()
    // the connection agrees with itself but not with the release: still refused
    vi.mocked(net.fetch).mockResolvedValue(streamed(['short']))
    const r = await downloadUpdate(null, { retries: 1, backoffMs: 0 })
    expect(r.ok).toBe(false)
  })
})

/* The Windows hand-off: what the app writes and runs once the installer is on disk. */
describe('the Windows update script', () => {
  it('quotes every path, installs silently, relaunches the app and cleans up after itself', () => {
    const s = windowsUpdateScriptFor('C:\\Users\\Op Name\\Temp\\BORN Setup.exe', 'C:\\Program Files\\BORN\\born.exe')
    expect(s).toContain('"C:\\Users\\Op Name\\Temp\\BORN Setup.exe" /S')
    expect(s).toContain('start "" "C:\\Program Files\\BORN\\born.exe"')
    expect(s).toContain('del "C:\\Users\\Op Name\\Temp\\BORN Setup.exe"')
    expect(s.endsWith('del "%~f0"\r\n')).toBe(true)
  })
})
