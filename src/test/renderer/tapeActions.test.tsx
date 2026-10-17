// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { matchTapeShortcut, tapeKeysIgnored, getTapeActions, setTapeActions, useTapeLoaded } from '../../renderer/src/tapeActions'
import GlobalTapeBar from '../../renderer/src/components/GlobalTapeBar'
import type { TapeWire } from '../../shared/tapePlayback'
import type { SyncMap } from '../../shared/tape'

const k = (code: string, o: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) => ({ code, ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, ...o })

describe('the tape shortcuts', () => {
  it('⌘/Ctrl+Shift+P play/pause, ←/→ ±10 s, [ ] paragraphs', () => {
    expect(matchTapeShortcut(k('KeyP'))).toBe('toggle')
    expect(matchTapeShortcut(k('KeyP', { ctrlKey: false, metaKey: true }))).toBe('toggle')
    expect(matchTapeShortcut(k('ArrowLeft'))).toBe('back')
    expect(matchTapeShortcut(k('ArrowRight'))).toBe('forward')
    expect(matchTapeShortcut(k('BracketLeft'))).toBe('prev')
    expect(matchTapeShortcut(k('BracketRight'))).toBe('next')
  })
  it('plain Space, the arrows and the brackets are NOT tape keys (they already mean next slide / are typed), nor are other combinations', () => {
    for (const code of ['Space', 'ArrowLeft', 'ArrowRight', 'BracketLeft', 'KeyP']) expect(matchTapeShortcut(k(code, { ctrlKey: false, metaKey: false, shiftKey: false }))).toBeNull()
    expect(matchTapeShortcut(k('KeyP', { shiftKey: false }))).toBeNull() // ⌘/Ctrl+P alone is the browser's print
    expect(matchTapeShortcut(k('KeyP', { altKey: true }))).toBeNull()
    expect(matchTapeShortcut(k('KeyW'))).toBeNull() // projection window shortcut stays the projection window's
    expect(matchTapeShortcut(k('KeyL'))).toBeNull() // logo
  })
  it('never fires while typing, and never inside the timing editor (where Space taps)', () => {
    document.body.innerHTML = '<input id="a"/><textarea id="b"></textarea><select id="c"></select><div contenteditable="true" id="d"></div><div class="tse"><button id="e">x</button></div><button id="f">x</button>'
    for (const id of ['a', 'b', 'c', 'd', 'e']) expect(tapeKeysIgnored(document.getElementById(id))).toBe(true)
    expect(tapeKeysIgnored(document.getElementById('f'))).toBe(false)
    expect(tapeKeysIgnored(document.body)).toBe(false)
    expect(tapeKeysIgnored(null)).toBe(false)
  })
})

describe('the action registry', () => {
  it('knows when a tape is loaded, and tells a listener only when that changes', () => {
    const seen: boolean[] = []
    function Probe(): JSX.Element { const l = useTapeLoaded(); seen.push(l); return <span>{String(l)}</span> }
    render(<Probe />)
    const a = { toggle: vi.fn(), back: vi.fn(), forward: vi.fn(), prevParagraph: vi.fn(), nextParagraph: vi.fn(), screens: vi.fn(), onScreens: () => false }
    act(() => setTapeActions(a))
    expect(screen.getByText('true')).toBeTruthy()
    const renders = seen.length
    act(() => setTapeActions({ ...a })) // replaced while still loaded: nothing to redraw
    expect(seen.length).toBe(renders)
    act(() => setTapeActions(null))
    expect(screen.getByText('false')).toBeTruthy()
    expect(getTapeActions()).toBeNull()
  })
})

// the bar registers the actions while a tape is loaded, and watches for something else being taken
const file = { id: 't_a', hash: 'h', name: 'Sample', origFilename: 'x.m4a', ext: 'm4a', container: 'm4a', codec: 'mp4a', bytes: 1, durationSec: 1000, bitrate: 1, vbr: null, seekTableOk: true, storage: 'managed' as const, linkPath: null, addedAt: '' }
const rec = { id: 'r_1', sermonId: 7, language: 'en', label: '', createdAt: '', file, synced: true, status: 'ok' as const }
const MAP: SyncMap = { id: 'm', recordingId: 'r_1', textLanguage: null, source: 'tap', updatedAt: '', regions: [], marks: [10, 30, 50, 80].map((t, i) => ({ n: i + 1, t, kind: 'start' as const, confidence: null })) }
const wire = (o: Partial<TapeWire> = {}): TapeWire => ({ recordingId: 'r_1', fileId: file.id, sermonId: 7, status: 'playing', position: 35, at: 0, duration: 1000, speed: 1, volume: 1, muted: false, hasPlayedOnce: true, stalled: false, error: null, errorKind: null, pausedBy: null, deviceId: '', deviceLabel: '', epoch: 1, sentAt: 0, ...o })
let listeners: Array<(w: TapeWire | null) => void> = []
let liveCb: (c: unknown[]) => void = () => {}
let api: Record<string, ReturnType<typeof vi.fn>>
beforeEach(() => {
  try { localStorage.setItem('born.tape.hints.v1', JSON.stringify({ bar: true, place: true })) } catch { /* */ }
  listeners = []
  api = {
    tapeGet: vi.fn(async () => null), onTapeState: vi.fn((cb: (w: TapeWire | null) => void) => { listeners.push(cb); return () => { listeners = listeners.filter((x) => x !== cb) } }),
    tapeRecordings: vi.fn(async () => [rec]), tapeMapGet: vi.fn(async () => MAP), tapeCommand: vi.fn(async () => null),
    tapeSettingsGet: vi.fn(async () => ({ leadSec: 4, view: 'highlight' })), tapeSettingsSet: vi.fn(async () => ({})), tapeDevices: vi.fn(async () => []),
    getSermonParagraphs: vi.fn(async () => [{ text: '1 Alpha.', sermonTitle: 'S', dateCode: '00-0000', sermonId: 7, paragraphIndex: 0, paragraphRef: '1' }]),
    getLiveState: vi.fn(async () => []), onLiveChanged: vi.fn((cb: (c: unknown[]) => void) => { liveCb = cb; return vi.fn() }),
    showSlide: vi.fn(), updateStage: vi.fn(), clearProjection: vi.fn(), noteSermonUsed: vi.fn()
  }
  Object.assign(window.electronAPI, api)
})
afterEach(() => { vi.restoreAllMocks(); setTapeActions(null) })

describe('the bar and the keys', () => {
  it('while a tape is loaded the registry does what the bar does: play/pause, ±10 s, paragraph skips', async () => {
    render(<GlobalTapeBar onOpenTape={vi.fn()} />)
    await act(async () => { for (const l of listeners) l(wire()) })
    await waitFor(() => expect(getTapeActions()).not.toBeNull())
    await waitFor(() => expect(api.tapeMapGet).toHaveBeenCalled())
    await act(async () => {})
    const t = getTapeActions()!
    t.toggle(); expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'toggle' })
    t.back(); expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'skip', by: -10 })
    t.forward(); expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'skip', by: 10 })
    t.nextParagraph(); expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 50 })
    t.prevParagraph(); expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 30 })
  })
  it('unloading the tape unregisters the actions (the keys then do nothing)', async () => {
    render(<GlobalTapeBar onOpenTape={vi.fn()} />)
    await act(async () => { for (const l of listeners) l(wire()) })
    await waitFor(() => expect(getTapeActions()).not.toBeNull())
    await act(async () => { for (const l of listeners) l(null) })
    expect(getTapeActions()).toBeNull()
  })
  it('when something else is taken while the tape\'s text was on the screens, it says so and offers the way back; a blank or a clear does not', async () => {
    const toast = vi.fn()
    render(<GlobalTapeBar onOpenTape={vi.fn()} pushToast={toast} />)
    await act(async () => { for (const l of listeners) l(wire()) })
    await waitFor(() => expect(api.tapeMapGet).toHaveBeenCalled())
    await act(async () => {})
    const tapeSlide = { kind: 'quote', text: 'x', tape: { v: 1, recordingId: 'r_1', sermonId: 7, title: 'S', mode: 'highlight', leadSec: 4, pinned: null, items: [{ n: 1, marker: '1', text: 'Alpha.' }], marks: MAP.marks, regions: [] } }
    await act(async () => { liveCb([{ id: 'main', label: 'Main', blanked: false, next: null, current: tapeSlide }]) })
    expect(toast).not.toHaveBeenCalled()
    await act(async () => { liveCb([{ id: 'main', label: 'Main', blanked: true, next: null, current: tapeSlide }]) }) // Esc: the screens are blanked, nothing was taken
    expect(toast).not.toHaveBeenCalled()
    await act(async () => { liveCb([{ id: 'main', label: 'Main', blanked: false, next: null, current: tapeSlide }]) })
    await act(async () => { liveCb([{ id: 'main', label: 'Main', blanked: false, next: null, current: { kind: 'bible', text: 'For God so loved the world…' } }]) })
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0]).toMatchObject({ actionLabel: 'Back to the tape text', message: expect.stringMatching(/tape keeps playing/) })
    expect(api.showSlide).not.toHaveBeenCalled() // offering is not doing
    await waitFor(() => expect(api.getSermonParagraphs).toHaveBeenCalled())
    await act(async () => {})
    toast.mock.calls[0][0].onAction()
    expect(api.showSlide).toHaveBeenCalledTimes(1)
  })
  it('clearing the screens (nothing taken) is not reported', async () => {
    const toast = vi.fn()
    render(<GlobalTapeBar onOpenTape={vi.fn()} pushToast={toast} />)
    await act(async () => { for (const l of listeners) l(wire()) })
    await act(async () => {})
    const tapeSlide = { kind: 'quote', text: 'x', tape: { v: 1, recordingId: 'r_1', sermonId: 7, title: 'S', mode: 'highlight', leadSec: 4, pinned: null, items: [], marks: [], regions: [] } }
    await act(async () => { liveCb([{ id: 'main', label: 'Main', blanked: false, next: null, current: tapeSlide }]) })
    await act(async () => { liveCb([{ id: 'main', label: 'Main', blanked: false, next: null, current: null }]) })
    expect(toast).not.toHaveBeenCalled()
  })
})
