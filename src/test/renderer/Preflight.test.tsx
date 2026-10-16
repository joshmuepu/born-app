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
})
