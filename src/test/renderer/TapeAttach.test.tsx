// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import TapeAttach from '../../renderer/src/components/TapeAttach'
import type { TapeFolderHit, TapeImportResult, TapePreflight } from '../../shared/tape'

const file = { id: 't_aaaaaaaaaaaa', hash: 'h', name: 'Sample recording', origFilename: 'x.m4a', ext: 'm4a', container: 'm4a', codec: 'mp4a', bytes: 38_458_111, durationSec: 8687.9, bitrate: 35000, vbr: null, seekTableOk: true, storage: 'managed' as const, linkPath: null, addedAt: '' }
const rec = { id: 'r_1', sermonId: 1115, language: 'en', label: '', createdAt: '', file, synced: false, status: 'ok' as const }
const pf: TapePreflight = { recordingId: 'r_1', status: 'warn', checks: [{ id: 'file', level: 'ok', title: 'The recording is on this computer' }, { id: 'whole', level: 'ok', title: 'The whole file is there (not cut short)' }, { id: 'sync', level: 'warn', title: 'No paragraph timing yet', fix: 'sync' }] }
const hit = (o: Partial<TapeFolderHit> = {}): TapeFolderHit => ({ path: '/t/65-0418M a.m4a', name: '65-0418M a.m4a', bytes: 38_000_000, parsedCode: '65-0418M', match: { id: 1115, dateCode: '65-0418M', title: 'Sample' }, candidates: [], confidence: 'exact', imported: false, ...o })

let api: Record<string, ReturnType<typeof vi.fn>>
beforeEach(() => {
  api = {
    tapeRecordings: vi.fn(async () => []),
    tapeInfo: vi.fn(async () => ({ available: true, message: null, folder: '/t', audioPage: 'https://branham.org/en/MessageAudio' })),
    tapeScanFolder: vi.fn(async () => [hit()]),
    tapePreflight: vi.fn(async () => pf),
    tapePickAndImport: vi.fn(async () => ({ canceled: false, results: [{ ok: true, file, recording: rec, duplicate: false, warnings: [] }] as TapeImportResult[] })),
    tapeImportConfirmed: vi.fn(async () => [{ ok: true, file, recording: rec, duplicate: false, warnings: ['This MP3 has variable quality…'] }] as TapeImportResult[]),
    tapeImportPaths: vi.fn(async () => [{ ok: false, path: '/x', reason: 'not-audio', message: 'This isn’t an audio file BORN can use.' }] as TapeImportResult[]),
    tapeRemove: vi.fn(async () => true),
    tapeOpenAudioPage: vi.fn(async () => true),
    tapePickFolder: vi.fn(async () => '/t'),
    tapePathsForFiles: vi.fn((files: File[]) => files.map((f) => `/dropped/${f.name}`))
  }
  Object.assign(window.electronAPI, api)
})
afterEach(() => vi.restoreAllMocks())
const open = (extra: Partial<Parameters<typeof TapeAttach>[0]> = {}) => render(<TapeAttach sermonId={1115} sermonTitle="Sample" dateCode="65-0418M" onClose={() => {}} onChanged={() => {}} {...extra} />)

describe('Add the tape for this sermon', () => {
  it('says the recording is used from this computer, is kept as a copy, and can be downloaded from the publisher on a click', () => {
    open()
    expect(screen.getByText(/never changes the original/i)).toBeTruthy()
    expect(screen.getByText(/Downloads this recording from the publisher’s own site/)).toBeTruthy()
    expect(screen.getByText('Recommended')).toBeTruthy()
    expect(screen.getByText('Not available yet')).toBeTruthy()
  })
  it('"Get audio" downloads this sermon\'s tape on the click, and the publisher page is still one click away', async () => {
    const dl = vi.fn(async () => ({ ok: true, bytes: 5_000_000, results: [] }))
    Object.assign((window as unknown as { electronAPI: Record<string, unknown> }).electronAPI, { tapeDownload: dl, onTapeDownloadProgress: vi.fn(() => () => {}) })
    open()
    fireEvent.click(screen.getByRole('button', { name: /Download the tape for/ }))
    await waitFor(() => expect(dl).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /Open the publisher’s page/ }))
    expect(api.tapeOpenAudioPage).toHaveBeenCalled()
  })
  it('lists the folder files that match this sermon, and "Use this" adds it to THIS sermon', async () => {
    const onChanged = vi.fn()
    open({ onChanged })
    await screen.findByText('Matches by its date code')
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }))
    await waitFor(() => expect(api.tapeImportConfirmed).toHaveBeenCalledWith([{ path: '/t/65-0418M a.m4a', sermonId: 1115 }]))
    await screen.findByText(/Added “Sample recording”/)
    expect(screen.getByText(/variable quality/)).toBeTruthy() // a warning from the file check is shown, not hidden
    expect(onChanged).toHaveBeenCalled()
  })
  it('an ambiguous match asks the operator to check; a file for another sermon is offered for THAT sermon only on request', async () => {
    api.tapeScanFolder.mockResolvedValue([hit({ confidence: 'ambiguous' }), hit({ path: '/t/other.m4a', name: '65-0418E other.m4a', match: { id: 1114, dateCode: '65-0418E', title: 'Evening' }, candidates: [] })])
    open()
    await screen.findByText(/please check/)
    fireEvent.click(screen.getByText(/1 other file/))
    fireEvent.click(await screen.findByRole('button', { name: 'Add to that sermon' }))
    await waitFor(() => expect(api.tapeImportConfirmed).toHaveBeenCalledWith([{ path: '/t/other.m4a', sermonId: 1114 }]))
  })
  it('a folder file already added says so instead of offering it again', async () => {
    api.tapeScanFolder.mockResolvedValue([hit({ imported: true })])
    open()
    await screen.findByText('Already added')
    expect(screen.queryByRole('button', { name: 'Use this' })).toBeNull()
  })
  it('a dropped file that is not audio is refused in plain words', async () => {
    const { container } = open()
    const dlg = container.querySelector('[role=dialog]')!
    fireEvent.drop(dlg, { dataTransfer: { files: [new File(['x'], 'notes.m4a')] } })
    await screen.findByText(/isn’t an audio file BORN can use/)
    expect(api.tapeImportPaths).toHaveBeenCalledWith(['/dropped/notes.m4a'], { sermonId: 1115, link: false })
  })
  it('"Link, don’t copy" is passed through', async () => {
    open()
    fireEvent.click(screen.getByLabelText(/Link, don’t copy/))
    fireEvent.click(screen.getByRole('button', { name: /Choose a file/ }))
    await waitFor(() => expect(api.tapePickAndImport).toHaveBeenCalledWith({ sermonId: 1115, link: true }))
  })
  it('an attached recording shows its checks in plain words and the next step; removing asks first and keeps the file', async () => {
    api.tapeRecordings.mockResolvedValue([rec])
    const onSync = vi.fn()
    open({ onSync })
    await screen.findByText('The whole file is there (not cut short)')
    expect(screen.getByText(/Next step: make the text follow the tape/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Tap to sync/ }))
    expect(onSync).toHaveBeenCalledWith('r_1', 'tap')
    fireEvent.click(screen.getByRole('button', { name: /Remove Sample recording from this sermon/ }))
    expect(api.tapeRemove).not.toHaveBeenCalled()
    expect(screen.getByText(/The file stays in BORN/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(api.tapeRemove).toHaveBeenCalledWith('r_1'))
  })
  it('Esc closes it', () => {
    const onClose = vi.fn()
    const { container } = open({ onClose })
    fireEvent.keyDown(container.querySelector('[role=dialog]')!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
