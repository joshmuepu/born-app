/**
 * On Windows a process the app starts must not open a console window: the update install ran `cmd.exe` without hiding it,
 * so a black window flashed while BORN updated. These tests read the exact options passed to each process-starting call.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const spawned: Array<{ cmd: string; args: string[]; opts: Record<string, unknown> }> = []
const ran: Array<{ cmd: string; args: string[]; opts: Record<string, unknown> }> = []
vi.mock('child_process', () => ({
  spawn: vi.fn((cmd: string, args: string[], opts: Record<string, unknown>) => {
    spawned.push({ cmd, args, opts })
    return { unref: vi.fn() }
  }),
  execFile: vi.fn((cmd: string, args: string[], opts: Record<string, unknown>, cb: (e: Error | null, out: string) => void) => {
    ran.push({ cmd, args, opts })
    cb(null, '')
  })
}))

import { app } from 'electron'
import { applyUpdate } from '../../main/updateCheck'

const realPlatform = process.platform
const setPlatform = (p: string): void => { Object.defineProperty(process, 'platform', { value: p, configurable: true }) }
let tmp = ''
beforeEach(() => {
  spawned.length = 0; ran.length = 0
  tmp = mkdtempSync(join(tmpdir(), 'born-hidden-'))
  vi.mocked(app.getPath).mockImplementation((name: string) => (name === 'exe' ? 'C:\\Program Files\\BORN\\born.exe' : tmp))
  Object.assign(app, { isPackaged: true })
})
afterEach(() => { setPlatform(realPlatform); Object.assign(app, { isPackaged: undefined }); vi.mocked(app.getPath).mockImplementation(() => ':memory:') })

describe('the Windows update install', () => {
  it('starts its command shell hidden, detached and with no output attached', async () => {
    setPlatform('win32')
    const r = await applyUpdate(join(tmp, 'BORN-Setup.exe'))
    expect(r.ok).toBe(true)
    expect(spawned).toHaveLength(1)
    expect(spawned[0].cmd).toBe('cmd.exe')
    expect(spawned[0].args[0]).toBe('/c')
    expect(spawned[0].opts).toMatchObject({ windowsHide: true, detached: true, stdio: 'ignore' })
  })
})

describe('the macOS update install', () => {
  it('passes the same options (hiding is ignored off Windows)', async () => {
    setPlatform('darwin')
    vi.mocked(app.getPath).mockImplementation((name: string) => (name === 'exe' ? join(tmp, 'Branham or Nothing.app', 'Contents', 'MacOS', 'born') : tmp))
    const r = await applyUpdate(join(tmp, 'BORN.dmg'))
    expect(r.ok).toBe(true)
    expect(spawned[0].cmd).toBe('/bin/bash')
    expect(spawned[0].opts).toMatchObject({ windowsHide: true, detached: true, stdio: 'ignore' })
  })
})

describe('the Wi-Fi name lookup (Remote panel)', () => {
  it('runs netsh hidden, with a time limit and no shell', async () => {
    setPlatform('win32')
    vi.resetModules()
    const { getNetworkMeta } = await import('../../main/networkMeta')
    getNetworkMeta() // starts the lookup in the background
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
    expect(ran.length).toBeGreaterThan(0)
    for (const r of ran) {
      expect(r.cmd).toBe('netsh')
      expect(r.opts).toMatchObject({ windowsHide: true, timeout: 3000 })
      expect(r.opts.shell).toBeUndefined()
    }
  })
})
