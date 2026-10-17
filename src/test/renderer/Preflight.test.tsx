// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Preflight from '../../renderer/src/components/Preflight'
import { migrateQueue, mediaToItem, slideshowToItem } from '../../shared/queueItem'
import type { MediaPreflightResult } from '../../shared/media'

const song = { kind: 'song', id: 's1', songId: 1, title: 'Alpha', slides: [{ text: 'Verse' }] }
const pf = (over: Partial<MediaPreflightResult>): MediaPreflightResult => ({ id: 'm_000000000001', name: 'Welcome', status: 'ok', deep: 'ok', width: 1920, height: 1080, bytes: 1000, storage: 'managed', notes: [], ...over })

function mockApi(results: MediaPreflightResult[], info: Record<string, unknown> = { available: true, freeBytes: 500 * 2 ** 30 }) {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    mediaPreflight: vi.fn(async () => results),
    mediaInfo: vi.fn(async () => info),
    listOutputs: vi.fn(async () => []),
    mediaBackgroundsGet: vi.fn(async () => ({ settings: { destinations: {}, channels: {} }, congregationMain: null })),
    mediaRelinkPick: vi.fn(async () => ({ ok: false, canceled: true }))
  }
}

describe('Preflight: is tonight ready?', () => {
  beforeEach(() => mockApi([]))

  it('says ready when everything is in place', async () => {
    mockApi([pf({})])
    const q = [...migrateQueue([song]), mediaToItem({ id: 'm_000000000001', name: 'Welcome' })]
    render(<Preflight open queue={q} onClose={() => {}} onRemoveItem={() => {}} />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Ready — all 2 checks passed/))
  })

  it('flags a missing picture as a problem with a one-click remove, and offers Find the file for a linked one', async () => {
    mockApi([pf({ status: 'missing', storage: 'linked' })])
    const onRemove = vi.fn()
    const q = [mediaToItem({ id: 'm_000000000001', name: 'Welcome' })]
    render(<Preflight open queue={q} onClose={() => {}} onRemoveItem={onRemove} />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/1 problem to fix/))
    expect(screen.getByText('Find the file…')).toBeTruthy()
    fireEvent.click(screen.getByText('Remove from queue'))
    expect(onRemove).toHaveBeenCalledWith(0)
  })

  it('a damaged same-size file is a failure, not a pass', async () => {
    mockApi([pf({ deep: 'damaged', notes: ['The file no longer matches what was added (it may be damaged).'] })])
    render(<Preflight open queue={[mediaToItem({ id: 'm_000000000001', name: 'Welcome' })]} onClose={() => {}} onRemoveItem={() => {}} />)
    await waitFor(() => expect(screen.getAllByText(/the file is damaged/).length).toBeGreaterThan(0))
  })

  it('a slideshow with one bad picture fails and names it', async () => {
    mockApi([pf({ id: 'm_000000000001', name: 'A' }), pf({ id: 'm_000000000002', name: 'B', status: 'missing' })])
    const show = slideshowToItem([{ id: 'm_000000000001', name: 'A' }, { id: 'm_000000000002', name: 'B' }], 'Announcements')
    render(<Preflight open queue={[show]} onClose={() => {}} onRemoveItem={() => {}} />)
    await waitFor(() => expect(screen.getByText(/B: the file is missing/)).toBeTruthy())
  })

  it('an unknown (newer-version) item is reported as unshowable', async () => {
    const q = migrateQueue([{ kind: 'hologram', id: 'h', slides: [] }])
    render(<Preflight open queue={q} onClose={() => {}} onRemoveItem={() => {}} />)
    await waitFor(() => expect(screen.getByText(/can't be shown/)).toBeTruthy())
  })

  it('low disk space is a warning, nearly none is a failure', async () => {
    mockApi([], { available: true, freeBytes: 0.5 * 2 ** 30 })
    render(<Preflight open queue={migrateQueue([song])} onClose={() => {}} onRemoveItem={() => {}} />)
    await waitFor(() => expect(screen.getByText(/Only 0.5 GB of disk space/)).toBeTruthy())
  })

  describe('the tape for a sermon in the queue', () => {
    const quoteItem = { kind: 'quote', id: 'q1', quote: { text: 'x', sermonTitle: 'A Sermon', dateCode: '00-0000', sermonId: 5, paragraphIndex: 0, paragraphRef: '1' }, slides: [{ text: 'x' }] }
    const withTape = (checks: Array<{ id: string; level: 'ok' | 'warn' | 'fail'; title: string; detail?: string }>, devices: Array<{ id: string; label: string }> = [], outputId = '') => {
      mockApi([])
      Object.assign((window as unknown as { electronAPI: Record<string, unknown> }).electronAPI, {
        tapeRecordings: vi.fn(async () => [{ id: 'r_1', sermonId: 5 }]),
        tapePreflight: vi.fn(async () => ({ recordingId: 'r_1', status: 'ok', checks })),
        tapeDevices: vi.fn(async () => devices),
        tapeSettingsGet: vi.fn(async () => ({ outputDeviceId: outputId, outputDeviceLabel: 'Sanctuary speakers' }))
      })
    }
    it('a ready tape is one passing row', async () => {
      withTape([{ id: 'file', level: 'ok', title: 'The recording is there' }])
      render(<Preflight open queue={migrateQueue([quoteItem])} onClose={() => {}} onRemoveItem={() => {}} />)
      await waitFor(() => expect(screen.getByText(/Tape for “A Sermon”/)).toBeTruthy())
      expect(screen.getByRole('status').textContent).toMatch(/Ready/)
    })
    it('a missing file or no timing is named, and counted as a problem', async () => {
      withTape([{ id: 'file', level: 'fail', title: 'the recording file cannot be found', detail: 'Find it again.' }, { id: 'sync', level: 'warn', title: 'it has no timing yet' }])
      render(<Preflight open queue={migrateQueue([quoteItem])} onClose={() => {}} onRemoveItem={() => {}} />)
      await waitFor(() => expect(screen.getByText(/the recording file cannot be found/)).toBeTruthy())
      expect(screen.getByText(/it has no timing yet/)).toBeTruthy()
      expect(screen.getByRole('status').textContent).toMatch(/1 problem to fix/)
    })
    it('asks the main process whether the chosen sound output is plugged in', async () => {
      withTape([{ id: 'file', level: 'ok', title: 'ok' }], [{ id: 'other', label: 'Headphones' }], 'spk')
      render(<Preflight open queue={migrateQueue([quoteItem])} onClose={() => {}} onRemoveItem={() => {}} />)
      await waitFor(() => expect(screen.getByText(/Tape for/)).toBeTruthy())
      const api = (window as unknown as { electronAPI: { tapePreflight: ReturnType<typeof vi.fn> } }).electronAPI
      expect(api.tapePreflight).toHaveBeenCalledWith('r_1', { outputDevice: { present: false, label: 'Sanctuary speakers' } })
    })
    it('a queue with no sermon, or an app without the tape API, shows no tape rows and still works', async () => {
      mockApi([])
      render(<Preflight open queue={migrateQueue([song])} onClose={() => {}} onRemoveItem={() => {}} />)
      await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())
      expect(screen.queryByText(/Tape for/)).toBeNull()
    })
  })
})
