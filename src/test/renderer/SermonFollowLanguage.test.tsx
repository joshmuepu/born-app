// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import SermonFollowView from '../../renderer/src/components/SermonFollowView'
import type { Quote } from '../../renderer/src/types'
import type { TapeWire } from '../../shared/tapePlayback'
import type { SyncMap } from '../../shared/tape'

// placeholder text only. The recording is English with 6 numbered paragraphs; the "Spanish" text merged ¶5 and ¶6, so it has only 1–5.
const row = (ref: string, text: string, i: number, lang?: string): Quote => ({ text, sermonTitle: 'Sample', dateCode: '00-0000', sermonId: 7, paragraphIndex: i, paragraphRef: ref, language: lang })
const EN: Quote[] = [row('1', '1 Alpha.', 0), row('2', '2 Bravo.', 1), row('3', '3 Charlie.', 2), row('4', '4 Delta.', 3), row('5', '5 Echo.', 4), row('6', '6 Foxtrot.', 5)]
const ES: Quote[] = [row('1', '1 Alfa.', 0, 'es'), row('2', '2 Bravo uno.', 1, 'es'), row('3', '3 Carlos.', 2, 'es'), row('4', '4 Delta es.', 3, 'es'), row('5', '5 Eco y Fox.', 4, 'es')]

const file = { id: 't_aaaaaaaaaaaa', hash: 'h', name: 'Sample', origFilename: 'x.m4a', ext: 'm4a', container: 'm4a', codec: 'mp4a', bytes: 1, durationSec: 1000, bitrate: 1, vbr: null, seekTableOk: true, storage: 'managed' as const, linkPath: null, addedAt: '' }
const rec = { id: 'r_1', sermonId: 7, language: 'en', label: '', createdAt: '', file, synced: true, status: 'ok' as const }
const MAP: SyncMap = { id: 'm', recordingId: 'r_1', textLanguage: null, source: 'tap', updatedAt: '', regions: [], marks: [10, 30, 50, 80, 100, 200].map((t, i) => ({ n: i + 1, t, kind: 'start' as const })) }
const wire = (o: Partial<TapeWire> = {}): TapeWire => ({ recordingId: 'r_1', fileId: file.id, sermonId: 7, status: 'paused', position: 35, at: 0, duration: 1000, speed: 1, volume: 1, muted: false, hasPlayedOnce: true, stalled: false, error: null, errorKind: null, pausedBy: null, deviceId: '', deviceLabel: '', epoch: 1, sentAt: 0, ...o })

let listeners: Array<(w: TapeWire | null) => void> = []
const push = (w: TapeWire | null): void => { for (const l of [...listeners]) l(w) }
let api: Record<string, ReturnType<typeof vi.fn>>
let overrides: Array<{ textN: number; mapN: number }> = []
let policy = 'ask'
beforeEach(() => {
  listeners = []
  overrides = []
  policy = 'ask'
  try { localStorage.clear() } catch { /* */ }
  api = {
    getSermonParagraphs: vi.fn(async (_id: number, lang: string) => (lang === 'es' ? ES : EN)),
    getLanguages: vi.fn(async () => ({ en: 'English', es: 'Spanish' })),
    tapeRecordings: vi.fn(async () => [rec]),
    tapeMapGet: vi.fn(async (_id: string, lang: string | null) => (lang === null ? MAP : null)),
    tapeOverridesGet: vi.fn(async () => overrides),
    tapeOverridesSet: vi.fn(async (_id: string, _l: string, rows: Array<{ textN: number; mapN: number }>) => { overrides = rows; return rows }),
    tapeGet: vi.fn(async () => null),
    onTapeState: vi.fn((cb: (w: TapeWire | null) => void) => { listeners.push(cb); return () => { listeners = listeners.filter((x) => x !== cb) } }),
    tapeCommand: vi.fn(async () => null),
    tapeLoad: vi.fn(async () => null),
    tapeSettingsGet: vi.fn(async () => ({ speedRange: 'wide', mismatchPolicy: policy, leadSec: 4, view: 'highlight' })),
    tapeSettingsSet: vi.fn(async () => ({})),
    tapeDevices: vi.fn(async () => []),
    getLiveState: vi.fn(async () => []),
    onLiveChanged: vi.fn(() => vi.fn())
  }
  Object.assign(window.electronAPI, api)
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => vi.restoreAllMocks())

async function open() {
  const r = render(<SermonFollowView sermonId={7} anchorRef="1" liveRef={null} onBack={vi.fn()} onProject={vi.fn()} onAddToQueue={vi.fn()} />)
  await waitFor(() => expect(screen.getAllByText(/^¶/).length).toBeGreaterThan(3))
  await act(async () => { push(wire()) })
  await act(async () => {})
  return r
}
const chooseSpanish = async (): Promise<void> => {
  fireEvent.change(screen.getByLabelText('Text language'), { target: { value: 'es' } })
  await waitFor(() => expect(api.getSermonParagraphs).toHaveBeenCalledWith(7, 'es'))
  await act(async () => {})
  await act(async () => { push(wire()) })
}
const card = (marker: string): HTMLElement => screen.getByText(`¶${marker}`).closest('.follow-para') as HTMLElement

describe('text language and tape language are separate', () => {
  it('the same English tape highlights the Spanish text by paragraph number, and the tape is still shown as English', async () => {
    await open()
    expect(screen.getByText(/Tape EN/)).toBeTruthy()
    await chooseSpanish()
    expect(card('2').className).toMatch(/follow-para--tape(?!-)/)
    expect(screen.getByText(/Bravo uno\./)).toBeTruthy()
    expect(screen.getByText(/Tape EN/)).toBeTruthy()
  })
  it('an English text with the same numbering shows no warning', async () => {
    await open()
    expect(screen.queryByRole('group', { name: 'Paragraph numbers differ' })).toBeNull()
  })
})

describe('when the numbering differs', () => {
  it('says plainly where, and asks what to do (default policy: Ask me)', async () => {
    await open()
    await chooseSpanish()
    const n = await screen.findByRole('group', { name: 'Paragraph numbers differ' })
    expect(n.textContent).toMatch(/Spanish: The recording has 6 timed paragraphs, the text has 5\. 5 numbers match\. Only in the timing: 6\./)
    expect(screen.getByRole('button', { name: 'Use matching numbers only' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Don’t follow this text/ })).toBeTruthy()
  })
  it('"Don’t follow this text" stops the highlight (and says so); "Follow anyway" brings it back', async () => {
    await open()
    await chooseSpanish()
    fireEvent.click(await screen.findByRole('button', { name: /Don’t follow this text/ }))
    await waitFor(() => expect(card('2').className).not.toMatch(/follow-para--tape/))
    expect(screen.getByText('Not following this text.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Follow anyway' }))
    await waitFor(() => expect(card('2').className).toMatch(/follow-para--tape(?!-)/))
  })
  it('the choice is remembered for that recording and language', async () => {
    await open()
    await chooseSpanish()
    fireEvent.click(await screen.findByRole('button', { name: 'Use matching numbers only' }))
    expect(localStorage.getItem('born.tape.mismatch.r_1.es')).toBe('matching')
    expect(screen.getByText('Following the matching numbers only.')).toBeTruthy()
  })
  it('the setting "Never use" applies at once, without asking', async () => {
    policy = 'never'
    await open()
    await chooseSpanish()
    expect(await screen.findByText('Not following this text.')).toBeTruthy()
    expect(card('2').className).not.toMatch(/follow-para--tape/)
  })
  it('lining up a difference saves an override and the numbers then agree', async () => {
    await open()
    await chooseSpanish()
    fireEvent.click(await screen.findByRole('button', { name: /Line up the differences/ }))
    expect(screen.getAllByText(/Only in the timing:/).length).toBeGreaterThan(1)
    // the Spanish text's ¶5 ("Eco y Fox") is really the recording's ¶6, after the merge: here we line 5 up with 6
    fireEvent.change(screen.getByLabelText('Text paragraph number'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Timing paragraph number'), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(api.tapeOverridesSet).toHaveBeenCalledWith('r_1', 'es', [{ textN: 5, mapN: 6 }]))
    await screen.findByText(/the numbers now line up \(1 adjusted\)/)
    // and the tape at 205 s (the recording's ¶6) now highlights the text's ¶5
    await act(async () => { push(wire({ position: 205 })) })
    expect(card('5').className).toMatch(/follow-para--tape(?!-)/)
  })
  it('an adjustment can be removed again', async () => {
    overrides = [{ textN: 5, mapN: 6 }]
    await open()
    await chooseSpanish()
    fireEvent.click(await screen.findByRole('button', { name: /Line up the differences/ }))
    fireEvent.click(screen.getByRole('button', { name: /Remove the adjustment for text paragraph 5/ }))
    await waitFor(() => expect(api.tapeOverridesSet).toHaveBeenCalledWith('r_1', 'es', []))
  })
})

describe('a map made for the text language is used as it is', () => {
  it('no numbering warning, because that map was timed against this text', async () => {
    api.tapeMapGet.mockImplementation(async (_id: string, lang: string | null) => (lang === 'es' ? { ...MAP, textLanguage: 'es', marks: MAP.marks.slice(0, 5) } : MAP))
    await open()
    await chooseSpanish()
    expect(screen.queryByRole('group', { name: 'Paragraph numbers differ' })).toBeNull()
    expect(card('2').className).toMatch(/follow-para--tape(?!-)/)
  })
})
