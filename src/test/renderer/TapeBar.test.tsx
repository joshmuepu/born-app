// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import TapeBar from '../../renderer/src/components/TapeBar'
import type { TapeRecording } from '../../shared/tape'
import type { TapeWire } from '../../shared/tapePlayback'

const file = { id: 't_aaaaaaaaaaaa', hash: 'h', name: 'Sample recording', origFilename: 'x.m4a', ext: 'm4a', container: 'm4a', codec: 'mp4a', bytes: 1, durationSec: 8688, bitrate: 1, vbr: null, seekTableOk: true, storage: 'managed' as const, linkPath: null, addedAt: '' }
const rec: TapeRecording = { id: 'r_1', sermonId: 1115, language: 'en', label: '', createdAt: '', file, synced: true }
const wire = (o: Partial<TapeWire> = {}): TapeWire => ({
  recordingId: 'r_1', fileId: file.id, sermonId: 1115, status: 'paused', position: 100, at: 0, duration: 8688, speed: 1, volume: 0.8, muted: false, hasPlayedOnce: false, stalled: false,
  error: null, errorKind: null, pausedBy: null, deviceId: '', deviceLabel: '', epoch: 1, sentAt: 0, ...o
})

let push: (w: TapeWire | null) => void = () => {}
let api: Record<string, ReturnType<typeof vi.fn>>
beforeEach(() => {
  api = {
    tapeGet: vi.fn(async () => null),
    onTapeState: vi.fn((cb: (w: TapeWire | null) => void) => { push = cb; return vi.fn() }),
    tapeCommand: vi.fn(async () => null),
    tapeLoad: vi.fn(async () => null),
    tapeSettingsGet: vi.fn(async () => ({ speedRange: 'wide' })),
    tapeDevices: vi.fn(async () => [{ id: 'default', label: 'Default - Speakers' }, { id: 'usb1', label: 'USB mixer' }, { id: 'hdmi', label: '' }]),
    tapeSetDevice: vi.fn(async () => true)
  }
  Object.assign(window.electronAPI, api)
})
afterEach(() => vi.restoreAllMocks())
const bar = (p: Partial<Parameters<typeof TapeBar>[0]> = {}) => render(<TapeBar recording={rec} {...p} />)

describe('the tape bar before anything is loaded', () => {
  it('shows the recording\'s own length, and Play loads the tape AND plays (the operator pressed it)', async () => {
    bar()
    expect(screen.getByLabelText('Time left').textContent).toBe('−2:24:48')
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(api.tapeLoad).toHaveBeenCalledWith('r_1', { play: true })
    expect(api.tapeCommand).not.toHaveBeenCalled()
  })
  it('seeking before it is loaded loads it at that position, paused', () => {
    bar()
    const slider = screen.getByRole('slider', { name: 'Position in the tape' })
    fireEvent.keyDown(slider, { key: 'End' })
    expect(api.tapeLoad).toHaveBeenCalledWith('r_1', { position: 8687 })
  })
})

describe('a loaded tape', () => {
  it('"Ready — nothing plays until you press Play" while paused and never started', async () => {
    bar()
    await act(async () => { push(wire()) })
    expect(screen.getByText(/Nothing plays until you press Play/)).toBeTruthy()
    expect(screen.getByLabelText('Time played').textContent).toBe('0:01:40')
  })
  it('Play/Pause toggles, ±10 s skip, speed and mute are commands to the main process (the bar never plays anything itself)', async () => {
    bar()
    await act(async () => { push(wire({ status: 'playing', hasPlayedOnce: true })) })
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'toggle' })
    fireEvent.click(screen.getByRole('button', { name: 'Back 10 seconds' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'skip', by: -10 })
    fireEvent.click(screen.getByRole('button', { name: 'Forward 10 seconds' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'skip', by: 10 })
    fireEvent.click(screen.getByRole('button', { name: '1.25×' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'speed', value: 1.25 })
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'muted', value: true })
    fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '40' } })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'volume', value: 0.4 })
  })
  it('the current speed is marked, and the speed range follows the setting', async () => {
    bar()
    await act(async () => { push(wire({ speed: 1.1 })) })
    expect(screen.getByRole('button', { name: '1.1×' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '1×' }).getAttribute('aria-pressed')).toBe('false')
  })
  it('the seek bar is a keyboard slider (arrows 5 s, Shift 30 s) and says where it is in words', async () => {
    bar()
    await act(async () => { push(wire({ position: 1000 })) })
    const s = screen.getByRole('slider', { name: 'Position in the tape' })
    expect(s.getAttribute('aria-valuetext')).toBe('0:16:40 of 2:24:48')
    fireEvent.keyDown(s, { key: 'ArrowRight' })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 1005 })
    fireEvent.keyDown(s, { key: 'ArrowLeft', shiftKey: true })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 970 })
  })
  it('draws a tick for every paragraph start', async () => {
    const { container } = bar({ paragraphStarts: [26, 71, 138] })
    expect(container.querySelectorAll('.tape-tick')).toHaveLength(3)
  })
  it('previous/next paragraph are off until the editor/follower provides them', () => {
    bar()
    expect((screen.getByRole('button', { name: 'Previous paragraph' }) as HTMLButtonElement).disabled).toBe(true)
    const next = vi.fn()
    const { unmount } = bar({ onNextParagraph: next })
    unmount()
  })
})

describe('what the bar says when something is wrong', () => {
  it.each([
    [{ status: 'paused' as const, pausedBy: 'video' as const, hasPlayedOnce: true }, /video or YouTube item went on the screen/],
    [{ status: 'paused' as const, pausedBy: 'device' as const, hasPlayedOnce: true, errorKind: 'device' as const, error: 'The sound output was disconnected. The tape is paused.' }, /disconnected/],
    [{ status: 'error' as const, error: 'This computer cannot play this recording. Convert it to M4A (AAC) and add that file.', errorKind: 'decode' as const }, /Convert it to M4A/],
    [{ status: 'playing' as const, stalled: true, hasPlayedOnce: true }, /stopped moving/],
    [{ status: 'ended' as const, hasPlayedOnce: true }, /finished/]
  ])('%o', async (o, re) => {
    bar()
    await act(async () => { push(wire(o)) })
    expect(screen.getByRole('status').textContent).toMatch(re)
  })
  it('a tape for ANOTHER recording being loaded does not make this bar claim to be playing it', async () => {
    bar()
    await act(async () => { push(wire({ recordingId: 'r_other', status: 'playing' })) })
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })
})

describe('where the sound comes out', () => {
  it('lists the outputs by name (and a plain "Output N" when a name is missing), and choosing one is remembered', async () => {
    bar()
    await act(async () => { push(wire()) })
    fireEvent.click(screen.getByRole('button', { name: /System default/ }))
    await screen.findByRole('listbox', { name: 'Sound output' })
    expect(screen.getByRole('button', { name: /USB mixer/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Output 2/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /USB mixer/ }))
    expect(api.tapeSetDevice).toHaveBeenCalledWith('usb1', 'USB mixer')
  })
})
