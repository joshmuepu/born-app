// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import TapePlace from '../../renderer/src/components/TapePlace'
import type { TapeWire } from '../../shared/tapePlayback'
import type { SyncMap } from '../../shared/tape'

const mkFile = (id: string, name: string, dur: number) => ({ id, hash: 'h' + id, name, origFilename: name + '.m4a', ext: 'm4a', container: 'm4a', codec: 'mp4a', bytes: 1, durationSec: dur, bitrate: 1, vbr: null, seekTableOk: true, storage: 'managed' as const, linkPath: null, addedAt: '' })
const entry = (id: string, sermonId: number, title: string, code: string, o: Record<string, unknown> = {}) => ({ id, sermonId, language: 'en', label: '', createdAt: '2026-0' + sermonId, file: mkFile('t_' + id, title, 1000), synced: true, status: 'ok' as const, sermonTitle: title, dateCode: code, timed: 6, ...o })
const E_READY = entry('r_1', 1, 'A Sample Message', '99-0101M')
const E_NEEDS = entry('r_2', 2, 'Sunday Message', '00-0001M', { timed: 0, synced: false })
const E_MISSING = entry('r_3', 3, 'Wednesday Evening', '00-0002M', { status: 'missing' as const })
const MAP: SyncMap = { id: 'm', recordingId: 'r_1', textLanguage: null, source: 'tap', updatedAt: '', regions: [], marks: [10, 30, 50, 80, 100, 200].map((t, i) => ({ n: i + 1, t, kind: 'start' as const })) }
const row = (ref: string, text: string, i: number) => ({ text, sermonTitle: 'S', dateCode: '00-0000', sermonId: 1, paragraphIndex: i, paragraphRef: ref })
const ROWS = [row('header', 'A SAMPLE MESSAGE', 0), row('1-3', '1 Alpha one. 2 Bravo two. 3 Charlie three.', 1), row('4', '4 Delta four.', 2), row('5', '5 Echo five.', 3), row('6', '6 Foxtrot six.', 4)]
const wire = (o: Partial<TapeWire> = {}): TapeWire => ({ recordingId: 'r_1', fileId: 't_r_1', sermonId: 1, status: 'paused', position: 35, at: 0, duration: 1000, speed: 1, volume: 1, muted: false, hasPlayedOnce: true, stalled: false, error: null, errorKind: null, pausedBy: null, deviceId: '', deviceLabel: '', epoch: 1, sentAt: 0, ...o })

let listeners: Array<(w: TapeWire | null) => void> = []
let current: TapeWire | null = null
const push = (w: TapeWire | null): void => { current = w; for (const l of [...listeners]) l(w) }
let api: Record<string, ReturnType<typeof vi.fn>>
let library: unknown[] = []
const toast = vi.fn()
beforeEach(() => {
  listeners = []; current = null; library = [E_MISSING, E_READY, E_NEEDS]; toast.mockReset()
  try { localStorage.clear(); localStorage.setItem('born.tape.hints.v1', JSON.stringify({ bar: true, place: true })) } catch { /* */ }
  api = {
    tapeLibrary: vi.fn(async () => library),
    tapeGet: vi.fn(async () => current),
    onTapeState: vi.fn((cb: (w: TapeWire | null) => void) => { listeners.push(cb); return () => { listeners = listeners.filter((x) => x !== cb) } }),
    tapeRecordings: vi.fn(async () => [E_READY]),
    tapeMapGet: vi.fn(async (_id: string, lang: string | null) => (lang === null ? MAP : null)),
    tapeOverridesGet: vi.fn(async () => []),
    getSermonParagraphs: vi.fn(async () => ROWS),
    getLanguages: vi.fn(async () => ({ en: 'English', es: 'Spanish' })),
    tapeCommand: vi.fn(async () => null),
    tapeLoad: vi.fn(async () => null),
    tapeRemove: vi.fn(async () => true),
    tapeSettingsGet: vi.fn(async () => ({ speedRange: 'wide', mismatchPolicy: 'ask', leadSec: 4, view: 'highlight', escRule: 'keep', videoRule: 'pause', deviceLoss: 'pause' })),
    tapeSettingsSet: vi.fn(async () => ({})),
    tapeSermonList: vi.fn(async () => [{ id: 1, dateCode: '99-0101M', title: 'A Sample Message' }, { id: 5, dateCode: '65-0418M', title: 'It Is The Rising Of The Sun' }]),
    tapeInfo: vi.fn(async () => ({ available: true, message: null, folder: '/tmp/Tape audio', audioPage: 'https://x' })),
    tapeScanFolder: vi.fn(async () => [
      { path: '/tmp/Tape audio/65-0418M It Is.m4a', name: '65-0418M It Is.m4a', bytes: 5 * 1048576, parsedCode: '65-0418M', match: { id: 5, dateCode: '65-0418M', title: 'It Is The Rising Of The Sun' }, candidates: [], confidence: 'exact', imported: false },
      { path: '/tmp/Tape audio/mystery.mp3', name: 'mystery.mp3', bytes: 3 * 1048576, parsedCode: null, match: null, candidates: [], confidence: 'none', imported: false }
    ]),
    tapeImportConfirmed: vi.fn(async () => [{ ok: true }]),
    tapePickFolder: vi.fn(async () => null),
    tapeOpenAudioPage: vi.fn(async () => true),
    getLiveState: vi.fn(async () => []), onLiveChanged: vi.fn(() => vi.fn()),
    showSlide: vi.fn(), updateStage: vi.fn(), clearProjection: vi.fn()
  }
  Object.assign(window.electronAPI, api)
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => vi.restoreAllMocks())

const open = async (target: { recordingId?: string; sermonId?: number; tab?: 'follow' | 'timing' | 'options' | 'add'; nonce: number } | null = null, w: TapeWire | null = wire()) => {
  const r = render(<TapePlace visible target={target} pushToast={toast} />)
  await waitFor(() => expect(api.tapeLibrary).toHaveBeenCalled())
  await act(async () => { push(w) })
  await act(async () => {})
  return r
}

describe('the library', () => {
  it('lists every recording with its status in words, problems first', async () => {
    await open()
    const items = within(screen.getByRole('list', { name: 'Recordings' })).getAllByRole('listitem')
    expect(items[0].textContent).toMatch(/Wednesday Evening.*File missing/)
    expect(items[1].textContent).toMatch(/Sunday Message.*Needs timing/)
    expect(items[2].textContent).toMatch(/A Sample Message.*Timed/)
    expect(items[2].textContent).toMatch(/99-0101M · 0:16:40 · M4A/)
  })
  it('selects the recording that is in the player, and says so', async () => {
    await open()
    expect(screen.getByRole('button', { name: /A Sample Message/ }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByText(/M4A · in the player/)).toBeTruthy()
  })
  it('landing on a sermon (from the bar or a chip) selects that sermon\'s recording', async () => {
    await open({ sermonId: 2, nonce: 1 }, null)
    expect(screen.getByRole('button', { name: /Sunday Message/ }).getAttribute('aria-current')).toBe('true')
  })
  it('with no recordings at all it shows the friendly first-time state and the three ways to add one', async () => {
    library = []
    await open(null, null)
    expect(await screen.findByText('No recordings yet')).toBeTruthy()
    expect(screen.getByText(/Everything stays on this computer/)).toBeTruthy()
    expect(screen.getByText('Get audio')).toBeTruthy()
    expect(screen.getByText(/Your “Tape audio” folder/)).toBeTruthy()
  })
})

describe('the Follow tab', () => {
  it('shows the sermon text; the recording in the player has the paragraph being spoken highlighted and the others quiet', async () => {
    const { container } = await open()
    await screen.findByText('Bravo two.', { exact: false })
    expect(container.querySelectorAll('.tfl-row.is-cur')).toHaveLength(1)
    expect(container.querySelector('.tfl-row.is-cur')!.textContent).toMatch(/Bravo/)
    expect(container.querySelectorAll('.tfl-row.is-dim').length).toBeGreaterThan(2)
  })
  it('a recording that is not in the player says so and loads it PAUSED (nothing plays)', async () => {
    await open({ recordingId: 'r_2', nonce: 1 }, wire())
    expect(await screen.findByText(/not in the player yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Load it into the player' }))
    expect(api.tapeLoad).toHaveBeenCalledWith('r_2')
    expect(api.tapeCommand).not.toHaveBeenCalled()
  })
  it('only the paragraph NUMBER moves the tape, with an Undo; clicking the text does nothing to it', async () => {
    await open()
    await screen.findByText('Delta four.', { exact: false })
    fireEvent.click(screen.getByText('Delta four.', { exact: false }))
    expect(api.tapeCommand).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Move the tape to paragraph 4' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 80 })
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Moved the tape to ¶4', actionLabel: 'Undo' }))
    toast.mock.calls[0][0].onAction()
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 35 })
  })
  it('the numbers are not buttons you can press when the recording is not in the player', async () => {
    await open({ recordingId: 'r_2', nonce: 1 }, wire())
    await screen.findByText(/not in the player yet/)
    api.tapeMapGet.mockResolvedValue(MAP)
    const b = screen.queryAllByRole('button', { name: /Move the tape to paragraph/ })
    for (const x of b) expect((x as HTMLButtonElement).disabled).toBe(true)
  })
  it('has the text-language picker (the recording keeps its own language) and the screens controls', async () => {
    await open()
    expect(await screen.findByLabelText('Text language')).toBeTruthy()
    expect(screen.getByText(/Tape EN/)).toBeTruthy()
    expect(await screen.findByRole('button', { name: /Show on the screens/ })).toBeTruthy()
  })
  it('without timing it says the text cannot follow and where to fix it', async () => {
    api.tapeMapGet.mockResolvedValue(null)
    await open()
    expect(await screen.findByText(/No timing yet — the text cannot follow/)).toBeTruthy()
  })
  it('a hand on the scroll turns "Text follows the tape" off, and Back to the tape turns it on', async () => {
    const { container } = await open()
    await screen.findByText('Bravo two.', { exact: false })
    const sw = screen.getByRole('switch', { name: /Text follows the tape/ })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.wheel(container.querySelector('.tfl')!)
    await waitFor(() => expect(screen.getByRole('switch', { name: /Text follows the tape/ }).getAttribute('aria-checked')).toBe('false'))
    fireEvent.click(screen.getByRole('button', { name: 'Back to the tape' }))
    expect(screen.getByRole('switch', { name: /Text follows the tape/ }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('the other tabs', () => {
  it('Timing: says how timed it is and offers the editor; a recording with a bad file cannot be timed', async () => {
    await open({ recordingId: 'r_1', tab: 'timing', nonce: 1 })
    expect(await screen.findByText(/Timing for “A Sample Message”/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit timing…' })).toBeTruthy()
    expect(screen.getByText(/made by tapping along/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Wednesday Evening/ }))
    expect((await screen.findByRole('button', { name: /Edit timing…|Tap to sync…/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/cannot be timed until that is fixed/)).toBeTruthy()
  })
  it('Timing: removing a recording asks first, and says the sermon text and the audio file are never deleted', async () => {
    await open({ recordingId: 'r_1', tab: 'timing', nonce: 1 })
    fireEvent.click(await screen.findByRole('button', { name: 'Remove this recording…' }))
    expect(screen.getByText(/never deleted/)).toBeTruthy()
    expect(api.tapeRemove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Remove it/ }))
    await waitFor(() => expect(api.tapeRemove).toHaveBeenCalledWith('r_1'))
  })
  it('Options: the real options are here (and change the settings)', async () => {
    await open({ tab: 'options', nonce: 1 })
    fireEvent.click(await screen.findByRole('radio', { name: 'Also pauses' }))
    await waitFor(() => expect(api.tapeSettingsSet).toHaveBeenCalledWith({ escRule: 'pause' }))
  })
  it('Add: find the sermon, add through the same dialog; the folder scan offers files with the sermon they look like', async () => {
    await open({ tab: 'add', nonce: 1 })
    fireEvent.change(await screen.findByLabelText('Find the sermon'), { target: { value: 'rising' } })
    fireEvent.click(await screen.findByRole('button', { name: /65-0418M/ }))
    expect(screen.getByRole('button', { name: /Add a recording for “It Is The Rising Of The Sun”…/ })).toBeTruthy()
    expect(await screen.findByText('65-0418M It Is.m4a')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add to that sermon' }))
    await waitFor(() => expect(api.tapeImportConfirmed).toHaveBeenCalledWith([{ path: '/tmp/Tape audio/65-0418M It Is.m4a', sermonId: 5 }]))
    expect(screen.getByText(/no sermon recognised/)).toBeTruthy()
  })
  it('Get audio needs a sermon first; the publisher\'s page opens either way', async () => {
    await open({ tab: 'add', nonce: 1 })
    expect((await screen.findByRole('button', { name: /Download the tape/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Open the publisher’s page/ }))
    expect(api.tapeOpenAudioPage).toHaveBeenCalled()
  })
})

describe('the one-time hint', () => {
  it('welcomes the operator once, in plain words, and can be dismissed for good', async () => {
    try { localStorage.removeItem('born.tape.hints.v1') } catch { /* */ }
    await open()
    expect(screen.getByRole('note').textContent).toMatch(/Welcome to the Tape place.*Nothing plays until you press Play/)
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('note')).toBeNull()
  })
})

