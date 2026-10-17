// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import GlobalTapeBar, { tapeBarState } from '../../renderer/src/components/GlobalTapeBar'
import type { TapeWire } from '../../shared/tapePlayback'
import type { SyncMap } from '../../shared/tape'

const file = { id: 't_aaaaaaaaaaaa', hash: 'h', name: '99-0101M A Sample Message', origFilename: 'x.m4a', ext: 'm4a', container: 'm4a', codec: 'mp4a', bytes: 1, durationSec: 1000, bitrate: 1, vbr: null, seekTableOk: true, storage: 'managed' as const, linkPath: null, addedAt: '' }
const rec = { id: 'r_1', sermonId: 7, language: 'en', label: '', createdAt: '', file, synced: true, status: 'ok' as const }
const MAP: SyncMap = { id: 'm', recordingId: 'r_1', textLanguage: null, source: 'tap', updatedAt: '', regions: [], marks: [{ n: 1, t: 10, kind: 'start' }, { n: 2, t: 30, kind: 'start' }, { n: 3, t: 50, kind: 'start' }, { n: 4, t: 80, kind: 'start' }, { n: 5, t: 100, kind: 'start' }, { n: 6, t: 200, kind: 'start' }] }
const wire = (o: Partial<TapeWire> = {}): TapeWire => ({ recordingId: 'r_1', fileId: file.id, sermonId: 7, status: 'paused', position: 35, at: 0, duration: 1000, speed: 1, volume: 0.8, muted: false, hasPlayedOnce: true, stalled: false, error: null, errorKind: null, pausedBy: null, deviceId: '', deviceLabel: '', epoch: 1, sentAt: 0, ...o })

let listeners: Array<(w: TapeWire | null) => void> = []
const push = (w: TapeWire | null): void => { for (const l of [...listeners]) l(w) }
let api: Record<string, ReturnType<typeof vi.fn>>
let map: SyncMap | null = MAP
beforeEach(() => {
  listeners = []; map = MAP
  api = {
    tapeGet: vi.fn(async () => null),
    onTapeState: vi.fn((cb: (w: TapeWire | null) => void) => { listeners.push(cb); return () => { listeners = listeners.filter((x) => x !== cb) } }),
    tapeRecordings: vi.fn(async () => [rec]),
    tapeMapGet: vi.fn(async () => map),
    tapeCommand: vi.fn(async () => null),
    tapeSettingsGet: vi.fn(async () => ({ leadSec: 4, view: 'highlight' })),
    tapeSettingsSet: vi.fn(async () => ({})),
    tapeDevices: vi.fn(async () => [{ id: 'spk', label: 'Sanctuary speakers' }]),
    tapeSetDevice: vi.fn(async () => true),
    getSermonParagraphs: vi.fn(async () => [{ text: '1 Alpha.', sermonTitle: 'S', dateCode: '00-0000', sermonId: 7, paragraphIndex: 0, paragraphRef: '1' }, { text: '2 Bravo.', sermonTitle: 'S', dateCode: '00-0000', sermonId: 7, paragraphIndex: 1, paragraphRef: '2' }]),
    getLiveState: vi.fn(async () => []), onLiveChanged: vi.fn(() => vi.fn()),
    showSlide: vi.fn(), updateStage: vi.fn(), clearProjection: vi.fn()
  }
  Object.assign(window.electronAPI, api)
})
afterEach(() => vi.restoreAllMocks())

const open = async (w: TapeWire | null = wire(), onOpen = vi.fn()) => {
  const r = render(<GlobalTapeBar onOpenTape={onOpen} />)
  await act(async () => { push(w) })
  if (w) await waitFor(() => expect(api.tapeMapGet).toHaveBeenCalled())
  await act(async () => {})
  return { ...r, onOpen }
}

describe('the bottom "Now playing" bar', () => {
  it('shows nothing when no tape is loaded', async () => {
    const { container } = await open(null)
    expect(container.firstChild).toBeNull()
  })
  it('names the recording and the paragraph being spoken, with time and time left and a tick at every paragraph start', async () => {
    const { container } = await open()
    expect(screen.getByText(/A Sample Message/)).toBeTruthy()
    expect(container.querySelector('.gtb-title')!.textContent).toBe('A Sample Message · ¶2')
    expect(screen.getByLabelText('Time played').textContent).toBe('0:00:35')
    expect(screen.getByLabelText('Time left').textContent).toBe('−0:16:05')
    expect(container.querySelectorAll('.tape-tick')).toHaveLength(6)
  })
  it('Play/Pause, back and forward 10 s, previous and next paragraph all work from here', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'toggle' })
    fireEvent.click(screen.getByRole('button', { name: 'Back 10 seconds' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'skip', by: -10 })
    fireEvent.click(screen.getByRole('button', { name: 'Forward 10 seconds' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'skip', by: 10 })
    fireEvent.click(screen.getByRole('button', { name: 'Next paragraph' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 50 })
    fireEvent.click(screen.getByRole('button', { name: 'Previous paragraph' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 30 })
  })
  it('the seek bar answers the arrow keys', async () => {
    await open()
    const s = screen.getByRole('slider', { name: 'Position in the tape' })
    fireEvent.keyDown(s, { key: 'ArrowRight' })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 40 })
  })
  it('volume and mute are here; the volume slider shows the real level', async () => {
    await open()
    expect((screen.getByLabelText('Volume') as HTMLInputElement).value).toBe('80')
    fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '55' } })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'volume', value: 0.55 })
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'muted', value: true })
  })
  it('clicking the title opens the Tape place for that sermon', async () => {
    const { onOpen } = await open()
    fireEvent.click(screen.getByRole('button', { name: /Open the Tape place/ }))
    expect(onOpen).toHaveBeenCalledWith(7)
  })
  it('without timing the paragraph buttons are off and the pill says so', async () => {
    map = null
    await open()
    expect((screen.getByRole('button', { name: 'Next paragraph' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('No timing')
  })
  it('the one button for putting the text on the screens lives here, and says what it will do', async () => {
    await open()
    const b = screen.getByRole('button', { name: /Text: not on the screens/ })
    await waitFor(() => expect((b as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(b)
    expect(api.showSlide).toHaveBeenCalledTimes(1)
    expect(api.showSlide.mock.calls[0][0].tape).toMatchObject({ recordingId: 'r_1', mode: 'highlight', pinned: null })
  })
})

describe('what goes wrong, in plain words with the one fix', () => {
  it('stalled: says so and offers to restart the sound (pause, then play)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await open(wire({ status: 'playing', stalled: true }))
    expect(screen.getByRole('status').textContent).toBe('Sound stopped')
    expect(screen.getByRole('alert').textContent).toMatch(/sound has stopped moving/)
    fireEvent.click(screen.getByRole('button', { name: 'Restart the sound' }))
    expect(api.tapeCommand).toHaveBeenCalledWith({ type: 'pause' })
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'play' })
    vi.useRealTimers()
  })
  it('output lost: says so and the fix opens the list of outputs', async () => {
    await open(wire({ status: 'paused', pausedBy: 'device', errorKind: 'device', error: 'The sound output was disconnected.' }))
    expect(screen.getByRole('status').textContent).toBe('Output lost')
    fireEvent.click(screen.getByRole('button', { name: 'Choose the output…' }))
    expect(await screen.findByRole('listbox', { name: 'Sound output' })).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: /Sanctuary speakers/ }))
    expect(api.tapeSetDevice).toHaveBeenCalledWith('spk', 'Sanctuary speakers')
  })
  it('paused for a video: says why, and one button resumes', async () => {
    await open(wire({ status: 'paused', pausedBy: 'video' }))
    expect(screen.getByRole('status').textContent).toBe('Paused for video')
    expect(screen.getByRole('alert').textContent).toMatch(/video or YouTube/)
    fireEvent.click(screen.getByRole('button', { name: 'Resume the tape' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'play' })
  })
  it('a healthy tape shows no warning line at all (the bar stays one row)', async () => {
    await open(wire({ status: 'playing' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('the status pill', () => {
  const base = { status: 'playing', stalled: false, errorKind: null, pausedBy: null, hasTiming: true, inGap: false, inDiffers: false }
  it('is always words, in the order of what matters most', () => {
    expect(tapeBarState(base)).toEqual({ label: 'In sync', tone: 'ok' })
    expect(tapeBarState({ ...base, hasTiming: false })).toEqual({ label: 'No timing', tone: 'warn' })
    expect(tapeBarState({ ...base, inGap: true })).toEqual({ label: 'No text here', tone: 'ok' })
    expect(tapeBarState({ ...base, inDiffers: true })).toEqual({ label: 'Tape differs here', tone: 'warn' })
    expect(tapeBarState({ ...base, stalled: true })).toEqual({ label: 'Sound stopped', tone: 'warn' })
    expect(tapeBarState({ ...base, status: 'paused', pausedBy: 'video' })).toEqual({ label: 'Paused for video', tone: 'warn' })
    expect(tapeBarState({ ...base, status: 'error', errorKind: 'device' })).toEqual({ label: 'Output lost', tone: 'bad' })
    expect(tapeBarState({ ...base, stalled: true, hasTiming: false }).label).toBe('Sound stopped')
  })
})
