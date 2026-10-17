// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

/** The engine page, driven with a fake <audio>: what it does when the record says so, and what it reports. */
class FakeAudio {
  src = ''; preload = ''; currentTime = 0; duration = NaN; volume = 1; muted = false; playbackRate = 1; preservesPitch = false; paused = true; ended = false; readyState = 0; error: { code: number } | null = null
  sink = ''; sinkFails = false
  plays = 0; loads = 0
  private l: Record<string, Array<() => void>> = {}
  addEventListener(n: string, f: () => void, o?: { once?: boolean }): void { (this.l[n] ??= []).push(o?.once ? () => { f(); this.l[n] = this.l[n].filter((x) => x !== f) } : f) }
  emit(n: string): void { for (const f of [...(this.l[n] ?? [])]) f() }
  load(): void { this.loads++ }
  removeAttribute(): void { this.src = '' }
  async play(): Promise<void> { this.plays++; this.paused = false }
  pause(): void { this.paused = true; this.emit('pause') }
  async setSinkId(id: string): Promise<void> { if (this.sinkFails) throw new Error('gone'); this.sink = id }
}

let audio: FakeAudio
let send: (m: unknown) => void
let reports: Array<Record<string, unknown>>
let devicesSent: unknown[]
let lost: number
let devList: Array<{ kind: string; deviceId: string; label: string }>
let devChange: () => void

async function boot() {
  vi.resetModules()
  audio = new FakeAudio()
  reports = []; devicesSent = []; lost = 0
  ;(globalThis as unknown as { Audio: unknown }).Audio = function () { return audio }
  Object.assign(window.electronAPI, {
    onTapeEngine: vi.fn((cb: (m: unknown) => void) => { send = cb; return vi.fn() }),
    tapeEngineReport: vi.fn((r: Record<string, unknown>) => { reports.push(r) }),
    tapeEngineDevices: vi.fn((l: unknown) => { devicesSent.push(l) }),
    tapeEngineDeviceLost: vi.fn(() => { lost++ }),
    tapeEngineReady: vi.fn()
  })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { enumerateDevices: async () => devList, addEventListener: (_n: string, f: () => void) => { devChange = f } } })
  await import('../../renderer/src/audio')
}
const apply = (o: Record<string, unknown> = {}) => send({ type: 'apply', fileId: 't_abcdef012345', status: 'paused', position: 0, epoch: 1, speed: 1, volume: 1, muted: false, deviceId: '', ...o })
const tick = () => new Promise((r) => setTimeout(r, 0))

beforeEach(async () => {
  devList = [{ kind: 'audiooutput', deviceId: 'default', label: 'Default' }, { kind: 'audiooutput', deviceId: 'usb', label: 'USB mixer' }, { kind: 'audioinput', deviceId: 'mic', label: 'Mic' }]
  await boot()
})

describe('the audio engine', () => {
  it('tells the main process it is ready, and lists only the OUTPUT devices', async () => {
    expect(window.electronAPI.tapeEngineReady).toHaveBeenCalled()
    await tick()
    expect(devicesSent.at(-1)).toEqual([{ id: 'default', label: 'Default' }, { id: 'usb', label: 'USB mixer' }])
  })
  it('loads the file through the born-tape protocol (never a path) and reports "ready" once the browser knows its length', async () => {
    apply()
    await tick()
    expect(audio.src).toBe('born-tape://file/t_abcdef012345')
    audio.duration = 8688; audio.readyState = 1; audio.emit('loadedmetadata')
    expect(reports.at(-1)).toMatchObject({ ready: true, duration: 8688 })
  })
  it('does NOT play when the record is paused, and plays only after the file is ready', async () => {
    apply({ status: 'playing' })
    await tick()
    expect(audio.plays).toBe(0) // not ready yet
    audio.duration = 100; audio.readyState = 4; audio.emit('loadedmetadata')
    await tick()
    expect(audio.plays).toBe(1)
  })
  it('applies speed, volume, mute and keeps pitch', async () => {
    apply({ speed: 1.25, volume: 0.4, muted: true })
    await tick()
    expect(audio).toMatchObject({ playbackRate: 1.25, volume: 0.4, muted: true, preservesPitch: true })
  })
  it('seeks ONLY when the epoch changes (its own position reports can never make it jump)', async () => {
    audio.readyState = 4
    apply({ position: 500, epoch: 1 })
    await tick()
    expect(audio.currentTime).toBe(500)
    audio.currentTime = 520 // it played on
    apply({ position: 500, epoch: 1, speed: 1.1 }) // same epoch: a settings change, not a jump
    await tick()
    expect(audio.currentTime).toBe(520)
    apply({ position: 90, epoch: 2 })
    await tick()
    expect(audio.currentTime).toBe(90)
  })
  it('a seek requested before the metadata is there is done as soon as it arrives', async () => {
    apply({ position: 4323.5, epoch: 1 })
    await tick()
    expect(audio.currentTime).toBe(0)
    audio.readyState = 1; audio.emit('loadedmetadata')
    expect(audio.currentTime).toBe(4323.5)
  })
  it('sends the chosen output device to the browser; a device that is not there is reported as a DEVICE problem, never played elsewhere', async () => {
    apply({ deviceId: 'usb' })
    await tick()
    expect(audio.sink).toBe('usb')
    audio.sinkFails = true
    apply({ deviceId: 'gone', epoch: 1 })
    await tick(); await tick()
    expect(reports.at(-1)).toMatchObject({ errorKind: 'device' })
    expect(String(reports.at(-1)!.error)).toMatch(/Choose another output/)
  })
  it('unplugging the device in use is reported as "device lost" (main pauses the tape)', async () => {
    apply({ deviceId: 'usb' })
    await tick()
    devList = devList.filter((d) => d.deviceId !== 'usb')
    devChange()
    await tick(); await tick()
    expect(lost).toBe(1)
  })
  it('says why a file cannot play, in words', async () => {
    apply()
    audio.error = { code: 4 }; audio.emit('error')
    expect(String(reports.at(-1)!.error)).toMatch(/Convert it to M4A/)
    expect(reports.at(-1)).toMatchObject({ errorKind: 'decode' })
    audio.error = { code: 2 }; audio.emit('error')
    expect(reports.at(-1)).toMatchObject({ errorKind: 'file' })
  })
  it('reports the end of the tape, and unloading stops everything', async () => {
    apply()
    audio.emit('ended')
    expect(reports.at(-1)).toMatchObject({ ended: true })
    send({ type: 'unload' })
    expect(audio.paused).toBe(true)
    expect(audio.src).toBe('')
  })
})
