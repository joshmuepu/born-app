// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, screen } from '@testing-library/react'
import ProjectionApp from '../../renderer/src/ProjectionApp'
import VideoBar from '../../renderer/src/components/VideoBar'
import SlideThumb from '../../renderer/src/components/SlideThumb'
import type { SlidePayload } from '../../renderer/src/types'
import type { PlaybackWire } from '../../shared/videoPlayback'

let showSlide: (s: SlidePayload) => void = () => {}
let playback: (m: PlaybackWire) => void = () => {}
let setBlank: (b: boolean) => void = () => {}
let alertCb: (m: string) => void = () => {}
let report: ReturnType<typeof vi.fn>

const ID = 'jNQXAC9IVRw'
const slide: SlidePayload = { kind: 'media', text: 'Me at the zoo', label: 'YouTube', media: { mediaId: 'yt-' + ID, type: 'youtube', youtubeId: ID } }
const wire = (o: Partial<PlaybackWire> = {}): PlaybackWire => ({ channelId: 'main', mediaId: 'yt-' + ID, status: 'paused', position: 0, duration: null, volume: 1, muted: false, loop: false, hasPlayedOnce: false, stalled: false, error: null, epoch: 1, ...o })
const frame = (): HTMLIFrameElement | null => document.querySelector('iframe.projection-yt')

/** Say something as the player page would: a message whose source is the iframe's own window. */
function fromPlayer(data: unknown): void {
  act(() => { window.dispatchEvent(new MessageEvent('message', { data, source: frame()!.contentWindow })) })
}

beforeEach(() => {
  report = vi.fn()
  window.electronAPI.onShowSlide = vi.fn((cb: (s: SlidePayload) => void) => { showSlide = cb; return vi.fn() })
  window.electronAPI.onSetBlankScreen = vi.fn((cb: (b: boolean) => void) => { setBlank = cb; return vi.fn() })
  window.electronAPI.onAlert = vi.fn((cb: (m: string) => void) => { alertCb = cb; return vi.fn() }) as never
  window.electronAPI.onMediaPlayback = vi.fn((cb: (m: PlaybackWire) => void) => { playback = cb; return vi.fn() })
  window.electronAPI.onMediaPlaybackStop = vi.fn(() => vi.fn())
  window.electronAPI.mediaPlaybackReport = report as never
  window.electronAPI.youtubeHostUrl = vi.fn(async (v: string) => `http://127.0.0.1:5555/player.html?v=${v}&sid=s&mode=live`) as never
})
afterEach(() => vi.restoreAllMocks())

async function takeIt(): Promise<void> {
  render(<ProjectionApp />)
  await act(async () => { showSlide(slide); playback(wire()) })
}

describe('the main output: a YouTube video', () => {
  it('is shown in a frame from the local player host (a real origin, so YouTube can identify BORN) — not file://', async () => {
    await takeIt()
    const f = frame()!
    expect(f.getAttribute('src')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/player\.html\?v=jNQXAC9IVRw/)
    expect(f.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
    expect(f.getAttribute('tabindex')).toBe('-1')
  })
  it('asks for the player to start at the record\'s position, never before it is wanted', async () => {
    await takeIt()
    expect(window.electronAPI.youtubeHostUrl).toHaveBeenCalledWith(ID, 0)
    expect(frame()!.getAttribute('src')).not.toMatch(/autoplay/)
  })
  it('never draws an alert over the player', async () => {
    await takeIt()
    act(() => alertCb('Nursery: please come to room 2'))
    expect(document.querySelector('.projection-alert')).toBeNull()
    expect(screen.queryByText(/Nursery/)).toBeNull()
  })
  it('an alert on an ordinary slide still shows (the rule is only for YouTube)', async () => {
    render(<ProjectionApp />)
    await act(async () => { showSlide({ kind: 'quote', text: 'Hello' }) })
    act(() => alertCb('Nursery'))
    expect(document.querySelector('.projection-alert')).not.toBeNull()
  })
  it('reports what the player says, as plain playback numbers', async () => {
    await takeIt()
    fromPlayer({ t: 'ready' })
    fromPlayer({ t: 'tick', state: 1, time: 12.5, duration: 19 })
    expect(report).toHaveBeenLastCalledWith({ position: 12.5, playing: true, duration: 19, ended: false, stalled: false, error: null })
    fromPlayer({ t: 'state', state: 0, time: 19, duration: 19 })
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ ended: true, playing: false }))
  })
  it('turns a player error code into a plain sentence for the operator', async () => {
    await takeIt()
    fromPlayer({ t: 'error', code: 150 })
    expect(report.mock.calls.at(-1)![0].error).toMatch(/does not allow/)
  })
  it('ignores messages from anywhere but its own frame', async () => {
    await takeIt()
    act(() => { window.dispatchEvent(new MessageEvent('message', { data: { t: 'tick', state: 1, time: 5, duration: 9 }, source: window })) })
    expect(report).not.toHaveBeenCalled()
  })
  it('does what the record says — and only after the player said it is ready', async () => {
    await takeIt()
    const post = vi.spyOn(frame()!.contentWindow!, 'postMessage')
    await act(async () => { playback(wire({ status: 'playing', hasPlayedOnce: true })) })
    expect(post).not.toHaveBeenCalled()
    fromPlayer({ t: 'ready' })
    expect(post).toHaveBeenCalledWith({ cmd: 'play' }, '*')
    await act(async () => { playback(wire({ status: 'paused', hasPlayedOnce: true, muted: true, volume: 0.5 })) })
    expect(post).toHaveBeenCalledWith({ cmd: 'pause' }, '*')
    expect(post).toHaveBeenCalledWith({ cmd: 'mute', value: true }, '*')
    expect(post).toHaveBeenCalledWith({ cmd: 'volume', value: 50 }, '*')
  })
  it('seeks only when a command moved the position (epoch), never because of its own reports', async () => {
    await takeIt()
    fromPlayer({ t: 'ready' })
    const post = vi.spyOn(frame()!.contentWindow!, 'postMessage')
    await act(async () => { playback(wire({ position: 7, status: 'playing', epoch: 1 })) })
    expect(post.mock.calls.some((c) => (c[0] as { cmd: string }).cmd === 'seek')).toBe(false)
    await act(async () => { playback(wire({ position: 90, status: 'playing', epoch: 2 })) })
    expect(post).toHaveBeenCalledWith({ cmd: 'seek', to: 90 }, '*')
  })
  it('blank (Esc) removes the player completely — nothing is covered, nothing keeps playing', async () => {
    await takeIt()
    expect(frame()).not.toBeNull()
    act(() => setBlank(true))
    expect(frame()).toBeNull()
  })
})

describe("the operator's bar for a YouTube video", () => {
  beforeEach(() => {
    window.electronAPI.mediaPlaybackGet = vi.fn(async () => wire({ duration: 200 })) as never
    window.electronAPI.mediaPlaybackCommand = vi.fn(async () => null) as never
  })
  it('says it is online and that nothing plays until Play, and has no Loop button', async () => {
    render(<VideoBar channelId="main" mediaId={'yt-' + ID} online />)
    expect(await screen.findByText(/Online \(YouTube\)\. Nothing plays until you press Play\. Ads may appear\./)).toBeTruthy()
    expect(screen.queryByLabelText('Loop')).toBeNull()
    expect(screen.getByLabelText('Play')).toBeTruthy()
    expect(screen.getByLabelText('Position in the video')).toBeTruthy()
    expect(screen.getByLabelText('Volume')).toBeTruthy()
    expect(screen.getByLabelText('Mute')).toBeTruthy()
  })
  it('a local video bar still has Loop', async () => {
    render(<VideoBar channelId="main" mediaId={'yt-' + ID} />)
    expect(await screen.findByLabelText('Loop')).toBeTruthy()
  })
  it('a frozen clock is described as possibly an ad or slow internet, never "detected an ad"', async () => {
    window.electronAPI.mediaPlaybackGet = vi.fn(async () => wire({ status: 'playing', stalled: true, hasPlayedOnce: true, duration: 200 })) as never
    render(<VideoBar channelId="main" mediaId={'yt-' + ID} online />)
    const t = await screen.findByText(/time not advancing/)
    expect(t.textContent).toMatch(/This can be an ad, or the internet slowing down/)
  })
  it('an error says what to do, including the backup', async () => {
    window.electronAPI.mediaPlaybackGet = vi.fn(async () => wire({ status: 'error', error: 'The owner of this video does not allow it to be shown in other programs.' })) as never
    render(<VideoBar channelId="main" mediaId={'yt-' + ID} online />)
    expect((await screen.findByText(/This video stopped/)).textContent).toMatch(/use your backup/)
  })
})

describe('Preview / Live thumbnails for a YouTube item', () => {
  it('show the name and an Online chip, never a player', () => {
    const { container } = render(<SlideThumb slide={slide} fontSize={4.5} emptyLabel="" />)
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.textContent).toMatch(/Online/)
    expect(container.textContent).toMatch(/Me at the zoo/)
  })
})
