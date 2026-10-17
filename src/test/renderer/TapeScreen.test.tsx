// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import TapeScreen from '../../renderer/src/components/TapeScreen'
import TapeScreenControls from '../../renderer/src/components/TapeScreenControls'
import type { TapeScreenSpec } from '../../shared/tapeScreen'
import type { TapeWire } from '../../shared/tapePlayback'
import type { TapeRecording, SyncMap } from '../../shared/tape'

const items = [
  { n: 1, marker: '1', text: 'First placeholder paragraph.' },
  { n: 2, marker: '2a', text: 'Second paragraph, page a.' }, { n: 2, marker: '2b', text: 'Second paragraph, page b.' },
  { n: 3, marker: '3', text: 'Third placeholder paragraph.' }
]
const spec = (o: Partial<TapeScreenSpec> = {}): TapeScreenSpec => ({
  v: 1, recordingId: 'r_1', sermonId: 1, title: 'A Sermon', mode: 'highlight', leadSec: 4, pinned: null, items,
  marks: [{ n: 1, t: 10, kind: 'start' }, { n: 2, t: 30, kind: 'start' }, { n: 3, t: 70, kind: 'start' }], regions: [], ...o
})
const wire = (o: Partial<TapeWire> = {}): TapeWire => ({ recordingId: 'r_1', fileId: 'f', sermonId: 1, status: 'paused', position: 12, at: 0, duration: 200, speed: 1, volume: 1, muted: false, hasPlayedOnce: true, stalled: false, error: null, errorKind: null, pausedBy: null, deviceId: '', deviceLabel: '', epoch: 1, sentAt: 0, ...o })

let push: (w: TapeWire | null) => void = () => {}
beforeEach(() => {
  Object.assign(window.electronAPI, {
    tapeGet: vi.fn(async () => null),
    onTapeState: vi.fn((cb: (w: TapeWire | null) => void) => { push = cb; return vi.fn() })
  })
})
afterEach(() => vi.restoreAllMocks())
const show = async (s: TapeScreenSpec, w: TapeWire | null) => {
  const r = render(<TapeScreen spec={s} baseRem={4} />)
  await act(async () => { push(w) })
  return r
}
const cur = (c: HTMLElement): string[] => [...c.querySelectorAll('[aria-current="true"] .tapescreen-tx')].map((e) => e.textContent ?? '')

describe('the highlight view', () => {
  it('marks only the paragraph being spoken as current, and shows its number big on its first page only', async () => {
    const { container } = await show(spec(), wire({ position: 35 }))
    expect(cur(container)).toEqual(['Second paragraph, page a.'])
    const nos = [...container.querySelectorAll('.tapescreen-no')].map((e) => e.textContent)
    expect(nos).toEqual(['1', '2', '', '3'])
    expect(container.querySelectorAll('.tapescreen-para.is-same')).toHaveLength(1) // the other page of paragraph 2
  })
  it('moves on when the tape moves, and never plays or moves the tape itself', async () => {
    const tapeCommand = vi.fn(); Object.assign(window.electronAPI, { tapeCommand })
    const { container } = await show(spec(), wire({ position: 12 }))
    expect(cur(container)).toEqual(['First placeholder paragraph.'])
    await act(async () => { push(wire({ position: 75 })) })
    expect(cur(container)).toEqual(['Third placeholder paragraph.'])
    expect(tapeCommand).not.toHaveBeenCalled()
  })
  it('a "no text here" stretch keeps the paragraph that was up', async () => {
    const s = spec({ regions: [{ kind: 'gap', start: 40, end: 60 }] })
    const { container } = await show(s, wire({ position: 35 }))
    expect(cur(container)).toEqual(['Second paragraph, page a.'])
    await act(async () => { push(wire({ position: 50 })) })
    expect(cur(container)).toEqual(['Second paragraph, page a.'])
  })
  it('before the tape starts nothing is current; a different tape is not followed', async () => {
    const { container } = await show(spec(), wire({ recordingId: 'other', position: 75 }))
    expect(cur(container)).toEqual([])
  })
  it('the "projector follows" switch off holds the pinned paragraph', async () => {
    const { container } = await show(spec({ pinned: 3 }), wire({ position: 12 }))
    expect(cur(container)).toEqual(['Third placeholder paragraph.'])
  })
  it('speaks the current paragraph politely to assistive technology and carries the palette', async () => {
    const { container } = await show(spec({ palette: 'contrast' }), wire({ position: 35 }))
    expect(container.querySelector('.tapescreen-live')!.textContent).toBe('Paragraph 2 (page 1 of 2)')
    expect(container.querySelector('.tapescreen--contrast')).toBeTruthy()
  })
  it('text of any script is drawn with automatic direction', async () => {
    const { container } = await show(spec({ items: [{ n: 1, marker: '1', text: 'مرحبا بالعالم' }], marks: [{ n: 1, t: 0, kind: 'start' }] }), wire({ position: 1 }))
    expect(container.querySelector('.tapescreen-tx')!.getAttribute('dir')).toBe('auto')
  })
})

describe('right-to-left and non-Latin text', () => {
  const texts: Array<[string, string]> = [['Arabic', 'بسم الله الرحمن الرحيم'], ['Persian', 'به نام خداوند جان و خرد'], ['Urdu', 'اللہ کے نام سے جو بڑا مہربان'], ['Amharic', 'በእግዚአብሔር ስም'], ['Thai', 'ในนามของพระเจ้า']]
  it.each(texts)('%s: each paragraph decides its own direction, so the number sits on the start side', async (_name, text) => {
    const { container } = await show(spec({ items: [{ n: 1, marker: '1', text }], marks: [{ n: 1, t: 0, kind: 'start' }] }), wire({ position: 1 }))
    expect(container.querySelector('.tapescreen-para')!.getAttribute('dir')).toBe('auto')
    expect(container.querySelector('.tapescreen-tx')!.getAttribute('dir')).toBe('auto')
    expect(container.querySelector('.tapescreen-tx')!.textContent).toBe(text)
  })
})

describe('one at a time', () => {
  it('shows one paragraph, the next one early by the lead, with NEXT ¶ and its countdown', async () => {
    const s = spec({ mode: 'one', leadSec: 4 })
    const { container } = await show(s, wire({ position: 20 }))
    expect(container.querySelectorAll('.tapescreen-tx')).toHaveLength(1)
    expect(container.querySelector('.tapescreen-tx')!.textContent).toBe('First placeholder paragraph.')
    expect(screen.getByText('NEXT ¶2')).toBeTruthy()
    await act(async () => { push(wire({ position: 26.5 })) })
    expect(container.querySelector('.tapescreen-tx')!.textContent).toBe('Second paragraph, page a.')
  })
  it('lead off switches exactly at the start', async () => {
    const { container } = await show(spec({ mode: 'one', leadSec: 0 }), wire({ position: 29.5 }))
    expect(container.querySelector('.tapescreen-tx')!.textContent).toBe('First placeholder paragraph.')
  })
})

describe('the operator controls', () => {
  const rec: TapeRecording = { id: 'r_1', sermonId: 1, language: 'en', label: '', createdAt: '', file: { id: 'f', hash: 'h', name: 'S', origFilename: 'x', ext: 'm4a', container: 'm4a', codec: 'a', bytes: 1, durationSec: 200, bitrate: 1, vbr: null, seekTableOk: true, storage: 'managed', linkPath: null, addedAt: '' }, synced: true }
  const map: SyncMap = { id: 'm', recordingId: 'r_1', textLanguage: null, source: 'tap', marks: spec().marks.map((m) => ({ ...m, confidence: null })) as never, regions: [], updatedAt: '' }
  let liveCb: (c: unknown[]) => void = () => {}
  let showSlide: ReturnType<typeof vi.fn>
  beforeEach(() => {
    showSlide = vi.fn()
    Object.assign(window.electronAPI, {
      showSlide, updateStage: vi.fn(), clearProjection: vi.fn(),
      tapeSettingsGet: vi.fn(async () => ({ leadSec: 4, view: 'highlight' })), tapeSettingsSet: vi.fn(async () => ({})),
      getLiveState: vi.fn(async () => []), onLiveChanged: vi.fn((cb: (c: unknown[]) => void) => { liveCb = cb; return vi.fn() })
    })
  })
  const onTaken = vi.fn()
  const mount = async () => { const r = render(<TapeScreenControls recording={rec} sermonId={1} title="A Sermon" items={items} map={map} position={35} onTaken={onTaken} />); await act(async () => {}); return r }

  it('nothing is shown until the operator presses Put on the screens, and then the payload carries the tape screen and the current paragraph', async () => {
    await mount()
    expect(showSlide).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Put on the screens/ }))
    const p = showSlide.mock.calls[0][0]
    expect(p.kind).toBe('quote')
    expect(p.text).toBe('Second paragraph, page a.')
    expect(p.tape).toMatchObject({ recordingId: 'r_1', mode: 'highlight', pinned: null, leadSec: 4 })
    expect(p.tape.items).toHaveLength(4)
    expect(onTaken).toHaveBeenCalledWith(items[1]) // "Recently played" learns which paragraph went up
    expect(window.electronAPI.updateStage).toHaveBeenCalledWith(p, null) // the stage monitor gets its own layout of the same screen
  })
  it('choosing a view or colours changes nothing on the screens until Put on the screens', async () => {
    await mount()
    fireEvent.click(screen.getByRole('radio', { name: 'One at a time' }))
    fireEvent.change(screen.getByLabelText('Screen colours'), { target: { value: 'light' } })
    expect(showSlide).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Put on the screens/ }))
    expect(showSlide.mock.calls[0][0].tape).toMatchObject({ mode: 'one', palette: 'light' })
    expect(window.electronAPI.tapeSettingsSet).toHaveBeenCalledWith({ view: 'single' })
  })
  it('with the tape screen live, "Screens follow the tape" off pins the paragraph that is up, and on releases it', async () => {
    await mount()
    await act(async () => { liveCb([{ id: 'main', label: 'Main', blanked: false, next: null, current: { kind: 'quote', text: 'x', tape: spec() } }]) })
    const sw = screen.getByRole('switch', { name: /Screens follow the tape/ })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(sw)
    expect(showSlide.mock.calls[0][0].tape.pinned).toBe(2)
    await act(async () => { liveCb([{ id: 'main', label: 'Main', blanked: false, next: null, current: { kind: 'quote', text: 'x', tape: spec({ pinned: 2 }) } }]) })
    const sw2 = screen.getByRole('switch', { name: /Screens follow the tape/ })
    expect(sw2.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw2)
    expect(showSlide.mock.calls[1][0].tape.pinned).toBeNull()
  })
  it('while the tape screen is up, changing the view waits for "Apply to the screens"', async () => {
    await mount()
    await act(async () => { liveCb([{ id: 'main', label: 'Main', blanked: false, next: null, current: { kind: 'quote', text: 'x', tape: spec() } }]) })
    expect(screen.queryByRole('button', { name: /Apply to the screens/ })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'One at a time' }))
    expect(showSlide).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Apply to the screens/ }))
    expect(showSlide.mock.calls[0][0].tape).toMatchObject({ mode: 'one', pinned: null })
  })
  it('"Take off the screens" clears the screen; a blanked screen is not reported as showing the tape', async () => {
    await mount()
    await act(async () => { liveCb([{ id: 'main', label: 'Main', blanked: false, next: null, current: { kind: 'quote', text: 'x', tape: spec() } }]) })
    fireEvent.click(screen.getByRole('button', { name: /Take off the screens/ }))
    expect(window.electronAPI.clearProjection).toHaveBeenCalled()
    await act(async () => { liveCb([{ id: 'main', label: 'Main', blanked: true, next: null, current: { kind: 'quote', text: 'x', tape: spec() } }]) })
    expect(screen.queryByRole('switch', { name: /Screens follow/ })).toBeNull()
  })
  it('without timing there is nothing to show, so no controls', async () => {
    const r = render(<TapeScreenControls recording={rec} sermonId={1} title="A" items={items} map={null} position={0} />)
    expect(r.container.firstChild).toBeNull()
  })
})
