// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import SermonFollowView from '../../renderer/src/components/SermonFollowView'
import type { Quote } from '../../renderer/src/types'
import type { TapeWire } from '../../shared/tapePlayback'
import type { SyncMap } from '../../shared/tape'

// placeholder text only. Row "1-3" holds three numbered paragraphs; paragraph 5 is long enough to be several pages.
const LONG = 'This is a sentence of placeholder words for paging. '.repeat(14)
const row = (ref: string, text: string, i: number): Quote => ({ text, sermonTitle: 'Sample', dateCode: '00-0000', sermonId: 7, paragraphIndex: i, paragraphRef: ref })
const ROWS: Quote[] = [row('header', 'SAMPLE 00-0000', 0), row('1-3', '1 Alpha one. 2 Bravo two. 3 Charlie three.', 1), row('4', '4 Delta four.', 2), row('5', `5 ${LONG}`, 3), row('6', '6 Foxtrot six.', 4)]

const file = { id: 't_aaaaaaaaaaaa', hash: 'h', name: 'Sample', origFilename: 'x.m4a', ext: 'm4a', container: 'm4a', codec: 'mp4a', bytes: 1, durationSec: 1000, bitrate: 1, vbr: null, seekTableOk: true, storage: 'managed' as const, linkPath: null, addedAt: '' }
const rec = { id: 'r_1', sermonId: 7, language: 'en', label: '', createdAt: '', file, synced: true, status: 'ok' as const }
const MAP: SyncMap = { id: 'm', recordingId: 'r_1', textLanguage: null, source: 'tap', updatedAt: '', regions: [], marks: [{ n: 1, t: 10, kind: 'start' }, { n: 2, t: 30, kind: 'start' }, { n: 3, t: 50, kind: 'start' }, { n: 4, t: 80, kind: 'start' }, { n: 5, t: 100, kind: 'start' }, { n: 6, t: 200, kind: 'start' }] }
const wire = (o: Partial<TapeWire> = {}): TapeWire => ({ recordingId: 'r_1', fileId: file.id, sermonId: 7, status: 'paused', position: 35, at: 0, duration: 1000, speed: 1, volume: 1, muted: false, hasPlayedOnce: true, stalled: false, error: null, errorKind: null, pausedBy: null, deviceId: '', deviceLabel: '', epoch: 1, sentAt: 0, ...o })

let listeners: Array<(w: TapeWire | null) => void> = []
const push = (w: TapeWire | null): void => { for (const l of [...listeners]) l(w) }
let api: Record<string, ReturnType<typeof vi.fn>>
beforeEach(() => {
  listeners = []
  api = {
    getSermonParagraphs: vi.fn(async () => ROWS),
    tapeRecordings: vi.fn(async () => [rec]),
    tapeMapGet: vi.fn(async () => MAP),
    tapeGet: vi.fn(async () => null),
    onTapeState: vi.fn((cb: (w: TapeWire | null) => void) => { listeners.push(cb); return () => { listeners = listeners.filter((x) => x !== cb) } }),
    tapeCommand: vi.fn(async () => null),
    tapeLoad: vi.fn(async () => null),
    tapeSettingsGet: vi.fn(async () => ({ speedRange: 'wide' })),
    tapeDevices: vi.fn(async () => [])
  }
  Object.assign(window.electronAPI, api)
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => vi.restoreAllMocks())

const onProject = vi.fn()
async function open(pos = 35, status: TapeWire['status'] = 'paused') {
  const r = render(<SermonFollowView sermonId={7} anchorRef="header" liveRef={null} onBack={vi.fn()} onProject={onProject} onAddToQueue={vi.fn()} />)
  await waitFor(() => expect(screen.getAllByText(/^¶/).length).toBeGreaterThan(3))
  await act(async () => { push(wire({ position: pos, status })) })
  await waitFor(() => expect(api.tapeMapGet).toHaveBeenCalled())
  await act(async () => {})
  return r
}
const card = (marker: string): HTMLElement => screen.getByText(`¶${marker}`).closest('.follow-para') as HTMLElement

describe('the reader follows the tape', () => {
  it('highlights the paragraph being spoken (¶2 at 35 s) and dims the others', async () => {
    await open(35)
    expect(card('2').className).toMatch(/follow-para--tape(?!-)/)
    expect(card('1').className).toMatch(/follow-para--tape-dim/)
    expect(card('4').className).toMatch(/follow-para--tape-dim/)
  })
  it('moves to the next paragraph as the tape moves, and every PAGE of a long paragraph belongs to it', async () => {
    await open(35)
    await act(async () => { push(wire({ position: 120 })) })
    const pages = screen.getAllByText(/^¶5[a-z]$/)
    expect(pages.length).toBeGreaterThan(1)
    for (const p of pages) expect(p.closest('.follow-para')!.className).toMatch(/follow-para--tape(?!-)/)
    expect(card('2').className).toMatch(/follow-para--tape-dim/)
  })
  it('scrolls the card for the tape\'s place into view (follow on)', async () => {
    const spy = vi.fn()
    ;(Element.prototype as unknown as { scrollTo: unknown }).scrollTo = spy
    await open(35)
    await act(async () => { push(wire({ position: 85 })) })
    expect(spy).toHaveBeenCalled()
  })
  it('nothing is highlighted before the tape is loaded or when there is no timing', async () => {
    api.tapeMapGet.mockResolvedValue(null)
    render(<SermonFollowView sermonId={7} anchorRef="header" liveRef={null} onBack={vi.fn()} onProject={onProject} onAddToQueue={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByText(/^¶/).length).toBeGreaterThan(3))
    await act(async () => { push(wire()) })
    expect(document.querySelector('.follow-para--tape')).toBeNull()
    expect(await screen.findByText(/No timing yet/)).toBeTruthy()
  })
})

describe('follow or browse freely — the user\'s place is never lost', () => {
  it('a hand on the wheel turns follow off and offers "Back to the tape"; the highlight stays the TAPE\'s', async () => {
    await open(35)
    expect(screen.getByRole('switch', { name: /Reader follows the tape/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.wheel(document.querySelector('.follow-list')!)
    expect(screen.getByRole('switch', { name: /Reader follows/ }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('button', { name: 'Back to the tape' })).toBeTruthy()
    await act(async () => { push(wire({ position: 85 })) })
    expect(card('4').className).toMatch(/follow-para--tape(?!-)/) // still follows in the highlight
    fireEvent.click(screen.getByRole('button', { name: 'Back to the tape' }))
    expect(screen.getByRole('switch', { name: /Reader follows/ }).getAttribute('aria-checked')).toBe('true')
  })
  it('F toggles follow from the keyboard', async () => {
    await open(35)
    fireEvent.keyDown(document.querySelector('.follow-view')!, { key: 'f' })
    expect(screen.getByRole('switch', { name: /Reader follows/ }).getAttribute('aria-checked')).toBe('false')
  })
  it('while follow is off the reader does not scroll by itself', async () => {
    const spy = vi.fn()
    await open(35)
    ;(Element.prototype as unknown as { scrollTo: unknown }).scrollTo = spy
    fireEvent.wheel(document.querySelector('.follow-list')!)
    spy.mockClear()
    await act(async () => { push(wire({ position: 120 })) })
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('click a paragraph to move the tape', () => {
  it('seeks the tape to that paragraph\'s start (not the screen), and says so with an Undo', async () => {
    await open(35)
    fireEvent.click(card('4'))
    expect(api.tapeCommand).toHaveBeenCalledWith({ type: 'seek', to: 80 })
    expect(onProject).not.toHaveBeenCalled()
    expect(screen.getByText(/Jumped to ¶4/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 35 })
    expect(screen.queryByText(/Jumped to/)).toBeNull()
  })
  it('a paragraph with no time (or a header) still projects the old way', async () => {
    api.tapeMapGet.mockResolvedValue({ ...MAP, marks: MAP.marks.filter((m) => m.n !== 4) })
    await open(35)
    onProject.mockClear()
    fireEvent.click(card('4'))
    expect(onProject).toHaveBeenCalled()
    expect(api.tapeCommand).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'seek', to: 80 }))
  })
  it('without a loaded tape for this recording a click just projects', async () => {
    render(<SermonFollowView sermonId={7} anchorRef="header" liveRef={null} onBack={vi.fn()} onProject={onProject} onAddToQueue={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByText(/^¶/).length).toBeGreaterThan(3))
    onProject.mockClear()
    fireEvent.click(card('4'))
    expect(onProject).toHaveBeenCalled()
  })
})

describe('keys and buttons for paragraphs', () => {
  it('"]" goes to the next paragraph start and "[" back to this paragraph\'s start (>3 s in) or the one before', async () => {
    await open(35)
    fireEvent.keyDown(document.querySelector('.follow-view')!, { key: ']' })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 50 })
    fireEvent.keyDown(document.querySelector('.follow-view')!, { key: '[' })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 30 }) // 5 s into ¶2 → its start
    await act(async () => { push(wire({ position: 31 })) })
    fireEvent.keyDown(document.querySelector('.follow-view')!, { key: '[' })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'seek', to: 10 }) // 1 s in → the one before
  })
  it('Space plays/pauses (loading the tape first if it is not loaded), arrows skip 10 s (Shift 30 s)', async () => {
    await open(35, 'playing')
    const v = document.querySelector('.follow-view')!
    fireEvent.keyDown(v, { key: ' ' })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'toggle' })
    fireEvent.keyDown(v, { key: 'ArrowRight' })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'skip', by: 10 })
    fireEvent.keyDown(v, { key: 'ArrowLeft', shiftKey: true })
    expect(api.tapeCommand).toHaveBeenLastCalledWith({ type: 'skip', by: -30 })
  })
  it('the reader is a reader: it has no player — no Play, no seek bar, no skip buttons (those live in the bottom bar)', async () => {
    await open(35)
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()
    expect(screen.queryByRole('slider', { name: 'Position in the tape' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Next paragraph' })).toBeNull()
    expect(document.querySelectorAll('.tape-tick')).toHaveLength(0)
  })
})
