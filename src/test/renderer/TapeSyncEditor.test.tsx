// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import TapeSyncEditor from '../../renderer/src/components/TapeSyncEditor'
import type { Quote } from '../../shared/queueItem'
import type { TapeRecording, SyncMap } from '../../shared/tape'
import type { TapeWire } from '../../shared/tapePlayback'

const file = { id: 't_aaaaaaaaaaaa', hash: 'h', name: 'Sample', origFilename: 'x.m4a', ext: 'm4a', container: 'm4a', codec: 'mp4a', bytes: 1, durationSec: 600, bitrate: 1, vbr: null, seekTableOk: true, storage: 'managed' as const, linkPath: null, addedAt: '' }
const rec: TapeRecording = { id: 'r_1', sermonId: 1, language: 'en', label: '', createdAt: '', file, synced: false }
const row = (ref: string, text: string): Quote => ({ text, sermonTitle: 'T', dateCode: '00-0000', sermonId: 1, paragraphIndex: 0, paragraphRef: ref })
// placeholder text only: a range row ("1-3") that holds three numbered paragraphs, then 4 and 5
const ROWS = [row('1-3', '1 Alpha paragraph of placeholder words. 2 Bravo paragraph of placeholder words. 3 Charlie paragraph of placeholder words.'), row('4', '4 Delta paragraph.'), row('5', '5 Echo paragraph.')]
const wire = (o: Partial<TapeWire> = {}): TapeWire => ({ recordingId: 'r_1', fileId: file.id, sermonId: 1, status: 'paused', position: 100, at: 0, duration: 600, speed: 1, volume: 1, muted: false, hasPlayedOnce: true, stalled: false, error: null, errorKind: null, pausedBy: null, deviceId: '', deviceLabel: '', epoch: 1, sentAt: 0, ...o })

let push: (w: TapeWire | null) => void = () => {}
let api: Record<string, ReturnType<typeof vi.fn>>
let savedMap: SyncMap | null = null
beforeEach(() => {
  savedMap = null
  api = {
    getSermonParagraphs: vi.fn(async () => ROWS),
    tapeMapGet: vi.fn(async () => savedMap),
    tapeActivity: vi.fn(async () => ({ values: [0.2, 0.9, 0.9, 0.1], durationSec: 600 })),
    tapeGet: vi.fn(async () => null),
    onTapeState: vi.fn((cb: (w: TapeWire | null) => void) => { push = cb; return vi.fn() }),
    tapeCommand: vi.fn(async () => null),
    tapeLoad: vi.fn(async () => null),
    tapeSettingsGet: vi.fn(async () => ({ speedRange: 'wide' })),
    tapeDevices: vi.fn(async () => []),
    tapeMapSave: vi.fn(async (_id: string, _l: unknown, _s: string, marks: unknown[]) => ({ ok: true as const, map: { id: 'm', recordingId: 'r_1', textLanguage: null, source: 'tap', marks, regions: [], updatedAt: '' }, issues: [] })),
    tapeMapExport: vi.fn(async () => ({ ok: true, path: '/x.json' })),
    tapeAlignRun: vi.fn(async () => ({ ok: true as const, seconds: 61.4, heardWords: 100, result: { marks: [{ n: 1, t: 10, kind: 'start' as const, confidence: 0.95 }, { n: 2, t: 20, kind: 'start' as const, confidence: 0.4 }, { n: 3, t: 30, kind: 'start' as const, confidence: 0.9 }], regions: [], stats: { paragraphs: 5, located: 3, lowConfidence: 1, matchedWordsPct: 80, anchors: 9 } } })),
    tapePickTool: vi.fn(async () => '/opt/whisper/whisper-cli'),
    tapeSettingsSet: vi.fn(async () => ({})),
    tapeAlignCancel: vi.fn(async () => true),
    onTapeAlignProgress: vi.fn(() => vi.fn()),
    tapeMapImport: vi.fn(async () => ({ ok: true as const, marks: [{ n: 1, t: 10, kind: 'start' as const }, { n: 2, t: 20, kind: 'start' as const }], regions: [], textLanguage: null, warnings: ['It was made for a different sermon.'] }))
  }
  Object.assign(window.electronAPI, api)
  try { localStorage.removeItem('born.tape.reaction') } catch { /* */ }
})
afterEach(() => vi.restoreAllMocks())

async function open(extra: Partial<Parameters<typeof TapeSyncEditor>[0]> = {}) {
  const r = render(<TapeSyncEditor recording={rec} sermonId={1} sermonTitle="Sample" dateCode="00-0000" onClose={() => {}} {...extra} />)
  await act(async () => { push(wire()) })
  await screen.findByRole('row', { name: 'Paragraph 5' })
  await waitFor(() => expect(api.tapeMapGet).toHaveBeenCalled())
  await act(async () => {})
  return r
}
const dlg = (): HTMLElement => screen.getByRole('dialog')
const space = (): void => { fireEvent.keyDown(dlg(), { key: ' ' }) }

describe('the sync editor', () => {
  it('uses the NUMBERED paragraphs: a range row "1-3" is three paragraphs, and it says which to listen for', async () => {
    await open()
    expect(screen.getByText('0 of 5 paragraphs timed')).toBeTruthy()
    expect(screen.getByText(/“Alpha paragraph/)).toBeTruthy()
    for (const n of [1, 2, 3, 4, 5]) expect(screen.getByRole('row', { name: `Paragraph ${n}` })).toBeTruthy()
  })
  it('the tape waits paused: opening the editor loads it but never plays', async () => {
    await open()
    expect(api.tapeLoad).not.toHaveBeenCalledWith('r_1', expect.objectContaining({ play: true }))
  })
  it('Space taps the paragraph being listened for, minus the reaction time, then moves on to the next', async () => {
    await open()
    space()
    expect(within(screen.getByRole('row', { name: 'Paragraph 1' })).getByText('0:01:39')).toBeTruthy() // 100 s − 0.25 s = 99.75 → 0:01:39
    await screen.findByText(/Listen for the start of ¶ 2/)
    expect(screen.getByText('1 of 5 paragraphs timed')).toBeTruthy()
  })
  it('the reaction time is adjustable and remembered', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Reaction time in seconds'), { target: { value: '1' } })
    space()
    expect(within(screen.getByRole('row', { name: 'Paragraph 1' })).getByText('0:01:39')).toBeTruthy() // 99.0
    expect(localStorage.getItem('born.tape.reaction')).toBe('1')
  })
  it('nudge changes by a tenth; Undo (button, U, ⌘Z) takes each change back', async () => {
    await open()
    space()
    fireEvent.click(screen.getByRole('button', { name: 'Paragraph 1: 0.1 seconds later' }))
    fireEvent.click(screen.getByRole('button', { name: 'Paragraph 1: 0.1 seconds later' }))
    fireEvent.keyDown(dlg(), { key: 'u' })
    fireEvent.keyDown(dlg(), { key: 'z', metaKey: true })
    fireEvent.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(screen.getByText('0 of 5 paragraphs timed')).toBeTruthy()
    expect((screen.getByRole('button', { name: /^Undo/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('clicking a row chooses which paragraph the next tap times (to fix one in the middle)', async () => {
    await open()
    fireEvent.click(screen.getByRole('row', { name: 'Paragraph 4' }))
    await screen.findByText(/Listen for the start of ¶ 4/)
    space()
    expect(within(screen.getByRole('row', { name: 'Paragraph 4' })).queryByText('—')).toBeNull()
  })
  it('"not on this tape" skips a paragraph and the tap moves past it', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Paragraph 1: not on this tape' }))
    expect(within(screen.getByRole('row', { name: 'Paragraph 1' })).getByText('not on tape')).toBeTruthy()
    await screen.findByText(/Listen for the start of ¶ 2/)
  })
  it('"No text here" marks a region in two presses and lists it with a way to remove it', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /No text here/ }))
    await act(async () => { push(wire({ position: 160 })) })
    fireEvent.click(screen.getByRole('button', { name: /End “no text”/ }))
    expect(screen.getByText(/No text 0:01:40–0:02:40/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Remove this no-text region/ }))
    expect(screen.queryByText(/No text 0:01:40/)).toBeNull()
  })
  it('Save sends the marks keyed by paragraph number, and says how many are timed', async () => {
    await open()
    space()
    await screen.findByText(/Listen for the start of ¶ 2/)
    await act(async () => { push(wire({ position: 120 })) })
    space()
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    await screen.findByText(/Saved — 2 paragraphs are timed/)
    const call = api.tapeMapSave.mock.calls[0]
    expect(call[0]).toBe('r_1'); expect(call[1]).toBeNull(); expect(call[2]).toBe('tap')
    expect((call[3] as Array<{ n: number; t: number }>).map((m) => [m.n, m.t])).toEqual([[1, 99.75], [2, 119.75]])
  })
  it('a map with times going backwards is NOT saved, and the problem is named', async () => {
    await open()
    space() // ¶1 at 99.75
    await act(async () => { push(wire({ position: 50 })) })
    space() // ¶2 at 49.75 — before ¶1
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    await screen.findByText(/Paragraph 2 starts before paragraph 1/)
    expect(api.tapeMapSave).not.toHaveBeenCalled()
  })
  it('closing with unsaved changes asks first; "Close without saving" really closes', async () => {
    const onClose = vi.fn()
    await open({ onClose })
    space()
    fireEvent.keyDown(dlg(), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText(/changes that are not saved/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close without saving' }))
    expect(onClose).toHaveBeenCalled()
  })
  it('closing with nothing changed closes at once', async () => {
    const onClose = vi.fn()
    await open({ onClose })
    fireEvent.keyDown(dlg(), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
  it('opening a timing file loads it as UNSAVED changes with its warnings shown', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /Open timing/ }))
    await screen.findByText(/Timing loaded — 2 paragraphs/)
    expect(screen.getByText(/different sermon/)).toBeTruthy()
    expect(screen.getByText('2 of 5 paragraphs timed')).toBeTruthy()
    expect((screen.getByRole('button', { name: /^Save/ }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('sharing needs a saved map (the file holds what is saved) and says it holds times only', async () => {
    savedMap = { id: 'm', recordingId: 'r_1', textLanguage: null, source: 'tap', marks: [{ n: 1, t: 10, kind: 'start' }], regions: [], updatedAt: '' }
    await open()
    fireEvent.click(screen.getByRole('button', { name: /Share timing/ }))
    await screen.findByText(/times only — no text and no audio/)
    expect(api.tapeMapExport).toHaveBeenCalledWith('r_1', null)
  })
  it('an existing saved map opens with its times and no unsaved changes', async () => {
    savedMap = { id: 'm', recordingId: 'r_1', textLanguage: null, source: 'auto', marks: [{ n: 1, t: 10, kind: 'start', confidence: 0.4 }, { n: 2, t: 20, kind: 'start', confidence: 0.95 }], regions: [], updatedAt: '' }
    await open()
    expect(screen.getByText('2 of 5 paragraphs timed')).toBeTruthy()
    expect(screen.getByText('auto · 40%')).toBeTruthy()
    expect(screen.getByText(/1 proposed time is low-confidence/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /^Save/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('"play from here" starts the tape one second before the marker', async () => {
    savedMap = { id: 'm', recordingId: 'r_1', textLanguage: null, source: 'tap', marks: [{ n: 1, t: 50, kind: 'start' }], regions: [], updatedAt: '' }
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Paragraph 1: play from here' }))
    expect(api.tapeCommand).toHaveBeenCalledWith({ type: 'seek', to: 49 })
  })

  it('"Suggest timing" loads a PROPOSAL as unsaved changes, says how many to check, and saves it as automatic only when the operator saves', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /Suggest timing/ }))
    await screen.findByText(/Suggestion ready in 61 s — 3 of 5 paragraphs found with confidence; 1 to check\. Nothing is saved yet\./)
    expect(api.tapeMapSave).not.toHaveBeenCalled()
    expect(api.tapeAlignRun).toHaveBeenCalledWith('r_1', expect.arrayContaining([expect.objectContaining({ n: 1 }), expect.objectContaining({ n: 5 })]))
    expect(screen.getByText(/auto · 40%/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(() => expect(api.tapeMapSave).toHaveBeenCalled())
    expect(api.tapeMapSave.mock.calls[0][2]).toBe('auto')
  })
  it('"Next least sure" goes to the lowest-confidence suggestion first and puts the tape just before it', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /Suggest timing/ }))
    await screen.findByText(/Suggestion ready/)
    fireEvent.click(screen.getByRole('button', { name: /Next least sure/ }))
    expect(api.tapeCommand).toHaveBeenCalledWith({ type: 'seek', to: 19 })
  })
  it('a failed or canceled suggestion shows the reason and leaves the timing alone', async () => {
    api.tapeAlignRun.mockResolvedValueOnce({ ok: false, message: 'Choose the whisper.cpp program (whisper-cli) in Settings first.' })
    await open()
    fireEvent.click(screen.getByRole('button', { name: /Suggest timing/ }))
    await screen.findByText(/Choose the whisper\.cpp program/)
    expect(screen.getByText('0 of 5 paragraphs timed')).toBeTruthy()
  })

  it('has no recogniser settings: the speech recogniser comes with BORN', async () => {
    await open()
    expect(screen.queryByRole('button', { name: 'Automatic timing tools' })).toBeNull()
    expect(screen.queryByText(/whisper-cli program/)).toBeNull()
  })
})
