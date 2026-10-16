// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import ProjectionApp from '../../renderer/src/ProjectionApp'
import type { SlidePayload } from '../../renderer/src/types'
import type { PlaybackWire } from '../../shared/videoPlayback'

let showSlide: (s: SlidePayload) => void = () => {}
let playback: (m: PlaybackWire) => void = () => {}
let stopPlayback: (c: string) => void = () => {}
let setBlank: (b: boolean) => void = () => {}
let alertCb: (m: string) => void = () => {}
let report: ReturnType<typeof vi.fn>
let play: ReturnType<typeof vi.spyOn>
let pause: ReturnType<typeof vi.spyOn>

const wire = (o: Partial<PlaybackWire> = {}): PlaybackWire => ({ channelId: 'main', mediaId: 'm_vid', status: 'paused', position: 0, duration: 30, volume: 1, muted: false, loop: false, hasPlayedOnce: false, stalled: false, error: null, epoch: 1, ...o })
const video = (): HTMLVideoElement | null => document.querySelector('.projection-media video')

beforeEach(() => {
  vi.useFakeTimers()
  report = vi.fn()
  window.electronAPI.onShowSlide = vi.fn((cb: (s: SlidePayload) => void) => { showSlide = cb; return vi.fn() })
  window.electronAPI.onSetBlankScreen = vi.fn((cb: (b: boolean) => void) => { setBlank = cb; return vi.fn() })
  window.electronAPI.onAlert = vi.fn((cb: (m: string) => void) => { alertCb = cb; return vi.fn() }) as never
  window.electronAPI.onMediaPlayback = vi.fn((cb: (m: PlaybackWire) => void) => { playback = cb; return vi.fn() })
  window.electronAPI.onMediaPlaybackStop = vi.fn((cb: (c: string) => void) => { stopPlayback = cb; return vi.fn() })
  window.electronAPI.mediaPlaybackReport = report as never
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const videoSlide: SlidePayload = { kind: 'media', text: 'Clip', media: { mediaId: 'm_vid', type: 'video' } }

describe('the main output: video', () => {
  it('a taken video waits on its first frame — it is NOT started by itself', () => {
    render(<ProjectionApp />)
    act(() => { showSlide(videoSlide); playback(wire()) })
    const v = video()!
    expect(v).toBeTruthy()
    expect(v.getAttribute('src')).toBe('born-media://file/m_vid')
    expect(v.autoplay).toBe(false)
    expect(play).not.toHaveBeenCalled()
  })

  it('a message that arrives BEFORE the video is on screen is not lost', () => {
    render(<ProjectionApp />)
    act(() => { playback(wire({ status: 'playing', position: 4, hasPlayedOnce: true })) })
    act(() => { showSlide(videoSlide) })
    expect(play).toHaveBeenCalled()
  })

  it('Play, Pause, volume, mute and loop from the record reach the element; a seek happens only when the epoch changes', () => {
    render(<ProjectionApp />)
    act(() => { showSlide(videoSlide); playback(wire()) })
    const v = video()!
    Object.defineProperty(v, 'readyState', { value: 4, configurable: true })
    act(() => { playback(wire({ status: 'playing', position: 12, epoch: 2, volume: 0.4, muted: true, loop: true, hasPlayedOnce: true })) })
    expect(play).toHaveBeenCalledTimes(1)
    expect(v.currentTime).toBe(12)
    expect(v.volume).toBeCloseTo(0.4)
    expect(v.muted).toBe(true)
    expect(v.loop).toBe(true)
    // same epoch, new position (the clock advancing): the element is left alone
    v.currentTime = 13.5
    act(() => { playback(wire({ status: 'playing', position: 13, epoch: 2, hasPlayedOnce: true })) })
    expect(v.currentTime).toBe(13.5)
    Object.defineProperty(v, 'paused', { value: false, configurable: true }) // (jsdom does not really play)
    act(() => { playback(wire({ status: 'paused', position: 13.5, epoch: 2, hasPlayedOnce: true })) })
    expect(pause).toHaveBeenCalled()
  })

  it('reports its real position about once a second (this is the clock the other screens follow)', () => {
    render(<ProjectionApp />)
    act(() => { showSlide(videoSlide); playback(wire({ status: 'playing', hasPlayedOnce: true })) })
    const v = video()!
    Object.defineProperty(v, 'paused', { value: false, configurable: true })
    Object.defineProperty(v, 'duration', { value: 30, configurable: true })
    v.currentTime = 2
    act(() => { vi.advanceTimersByTime(1000) })
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ position: 2, playing: true, duration: 30, ended: false }))
    // frames not advancing for two checks while playing = stalled
    act(() => { vi.advanceTimersByTime(1000) })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ stalled: true }))
  })

  it('reports the end of a video that does not loop', () => {
    render(<ProjectionApp />)
    act(() => { showSlide(videoSlide); playback(wire({ status: 'playing', hasPlayedOnce: true })) })
    const v = video()!
    act(() => { v.dispatchEvent(new Event('ended')) })
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ ended: true }))
  })

  it('reports a playback error instead of hiding it', () => {
    render(<ProjectionApp />)
    act(() => { showSlide(videoSlide); playback(wire()) })
    act(() => { video()!.dispatchEvent(new Event('error')) })
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ error: expect.stringContaining('media error') }))
  })

  it('PANIC: Esc/Blank removes the picture AND the sound at once (the element is gone)', () => {
    render(<ProjectionApp />)
    act(() => { showSlide(videoSlide); playback(wire({ status: 'playing', hasPlayedOnce: true })) })
    expect(video()).toBeTruthy()
    act(() => { setBlank(true) })
    expect(document.querySelector('video')).toBeNull()
    expect(document.querySelector('.projection-idle')).toBeTruthy()
  })

  it('an alert (e.g. a nursery call) still shows over a playing video, and the video carries on', () => {
    render(<ProjectionApp />)
    act(() => { showSlide(videoSlide); playback(wire({ status: 'playing', hasPlayedOnce: true })) })
    act(() => { alertCb('Nursery: please come to room 3') })
    expect(document.querySelector('.projection-alert')?.textContent).toBe('Nursery: please come to room 3')
    expect(video()).toBeTruthy()
  })

  it('stop (the video was replaced or cleared) forgets the record', () => {
    render(<ProjectionApp />)
    act(() => { showSlide(videoSlide); playback(wire()); stopPlayback('main') })
    act(() => { showSlide({ kind: 'bible', text: 'John 3:16', reference: 'John 3:16' }) })
    expect(document.querySelector('video')).toBeNull()
  })
})

describe('motion backgrounds', () => {
  it('a video background is muted, loops, autoplays behind the text, and has no controls or clock', () => {
    render(<ProjectionApp />)
    act(() => { showSlide({ kind: 'bible', text: 'John 3:16', reference: 'John 3:16 · KJV', background: { mediaId: 'm_bg', dim: 40, motion: true } }) })
    const v = document.querySelector('.projection-bg video') as HTMLVideoElement
    expect(v).toBeTruthy()
    expect(v.muted).toBe(true)
    expect(v.loop).toBe(true)
    expect(v.autoplay).toBe(true)
    expect(v.getAttribute('src')).toBe('born-media://file/m_bg')
    expect(report).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('John 3:16')
  })
  it('a still background is still an image', () => {
    render(<ProjectionApp />)
    act(() => { showSlide({ kind: 'bible', text: 'x', reference: 'x', background: { mediaId: 'm_bg', dim: 40 } }) })
    expect(document.querySelector('.projection-bg img')).toBeTruthy()
    expect(document.querySelector('.projection-bg video')).toBeNull()
  })
})
