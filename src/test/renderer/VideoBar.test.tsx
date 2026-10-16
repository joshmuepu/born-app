// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import VideoBar from '../../renderer/src/components/VideoBar'
import type { PlaybackWire } from '../../shared/videoPlayback'

let push: (m: PlaybackWire) => void = () => {}
let command: ReturnType<typeof vi.fn>
const wire = (o: Partial<PlaybackWire> = {}): PlaybackWire => ({ channelId: 'main', mediaId: 'm_vid', status: 'paused', position: 0, duration: 125, volume: 0.8, muted: false, loop: false, hasPlayedOnce: false, stalled: false, error: null, epoch: 1, ...o })

beforeEach(() => {
  command = vi.fn(() => Promise.resolve(null))
  window.electronAPI.mediaPlaybackGet = vi.fn(() => Promise.resolve(wire())) as never
  window.electronAPI.mediaPlaybackCommand = command as never
  window.electronAPI.onMediaPlayback = vi.fn((cb: (m: PlaybackWire) => void) => { push = cb; return vi.fn() }) as never
  window.electronAPI.onMediaPlaybackStop = vi.fn(() => vi.fn()) as never
})

async function ready(): Promise<void> {
  render(<VideoBar channelId="main" mediaId="m_vid" />)
  await act(async () => { await Promise.resolve() })
}

describe("the operator's video bar", () => {
  it('a taken video says it is ready and that nothing plays until Play', async () => {
    await ready()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
    expect(screen.getByText(/Nothing plays until you press Play/)).toBeTruthy()
    expect(screen.getByText('/ 2:05')).toBeTruthy()
  })

  it('Play toggles the record; the label follows what the output reports', async () => {
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(command).toHaveBeenCalledWith('main', { type: 'toggle' })
    act(() => push(wire({ status: 'playing', position: 30, hasPlayedOnce: true })))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
    expect(screen.getByText('−1:35')).toBeTruthy()
  })

  it('volume, mute and loop send commands', async () => {
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }))
    expect(command).toHaveBeenCalledWith('main', { type: 'muted', value: true })
    fireEvent.click(screen.getByRole('button', { name: 'Loop' }))
    expect(command).toHaveBeenCalledWith('main', { type: 'loop', value: true })
    fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '25' } })
    expect(command).toHaveBeenCalledWith('main', { type: 'volume', value: 0.25 })
  })

  it('seeking commits when the slider is released', async () => {
    await ready()
    const seek = screen.getByLabelText('Position in the video')
    fireEvent.change(seek, { target: { value: '60' } })
    expect(command).not.toHaveBeenCalledWith('main', expect.objectContaining({ type: 'seek' }))
    fireEvent.pointerUp(seek)
    expect(command).toHaveBeenCalledWith('main', { type: 'seek', to: 60 })
  })

  it('says plainly when the picture has stopped, when it has finished, and when it failed', async () => {
    await ready()
    act(() => push(wire({ status: 'playing', stalled: true, hasPlayedOnce: true })))
    expect(screen.getByText(/stopped moving/)).toBeTruthy()
    act(() => push(wire({ status: 'ended', position: 125, hasPlayedOnce: true })))
    expect(screen.getByText(/Finished/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play' }).textContent).toMatch(/Play again/)
    act(() => push(wire({ status: 'error', error: 'media error 4' })))
    expect(screen.getByText(/This video stopped/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('ignores messages for another video or channel', async () => {
    await ready()
    act(() => push(wire({ mediaId: 'm_other', status: 'playing' })))
    act(() => push(wire({ channelId: 'second', status: 'playing' })))
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })
})
