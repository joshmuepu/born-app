// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, cleanup } from '@testing-library/react'
import { installApi, renderApp } from './appHarness'

// Three ways the queue could lose or regain items when two things happened at nearly the same moment:
//  - a phone re-sending its list worked out which item to keep (the one on screen, the ones already shown) from the moment the list
//    arrived, not from after its songs and passages had been looked up; an item put on screen in between could be removed;
//  - items added while the saved queue was still being read at start were replaced by it;
//  - after New service from the phone, an item added before the screen had redrawn brought the cleared items back.
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const song = (id: string, title: string, deviceId?: string): Record<string, unknown> =>
  ({ kind: 'song', id, songId: 0, title, slides: [{ text: `Verse of ${title}` }], ...(deviceId ? { source: { deviceId, label: 'Song leader' } } : {}) })
const tick = (ms = 20): Promise<void> => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const invented = { id: 9, title: 'Invented Song C', slides: [{ text: 'Verse of Invented Song C' }] }
type Batch = (b: { items: unknown[]; contributor: { deviceId: string; label: string } }) => Promise<void>
const lastSaved = (api: Record<string, ReturnType<typeof vi.fn>>): string[] =>
  ((api.saveQueue.mock.calls.at(-1)?.[0] ?? []) as Array<{ title: string }>).map((i) => i.title)

describe('a phone re-sends its list while one of its items goes on screen', () => {
  it('the item on screen stays in the queue', async () => {
    let batch: Batch = async () => {}
    let project: (id: string) => void = () => {}
    let songArrives: (s: unknown) => void = () => {}
    const api = installApi({
      loadQueue: vi.fn(() => Promise.resolve([song('a', 'Invented Song A', 'phone-1')])),
      openProjection: vi.fn(() => Promise.resolve()),
      saveQueue: vi.fn(),
      getSong: vi.fn((id: number) => (id === 5 ? new Promise((r) => { songArrives = r }) : Promise.resolve(null))),
      onWebRemoteQueueBatch: vi.fn((cb: Batch) => { batch = cb; return () => {} }),
      onWebRemoteProject: vi.fn((cb: (id: string) => void) => { project = cb; return () => {} })
    })
    await renderApp()
    await tick()
    let pending!: Promise<void>
    await act(async () => { pending = batch({ items: [{ kind: 'song', payload: { songId: 5 } }], contributor: { deviceId: 'phone-1', label: 'Song leader' } }) })
    await act(async () => { project('a') })
    await tick()
    await act(async () => { songArrives({ id: 5, title: 'Invented Song B', slides: [{ text: 'Verse of Invented Song B' }] }); await pending })
    await tick()
    expect(lastSaved(api)).toEqual(['Invented Song A', 'Invented Song B'])
  })
})

describe('an item added while the saved queue is still being read', () => {
  it('is kept, after the saved items', async () => {
    let batch: Batch = async () => {}
    let loaded: (q: unknown[]) => void = () => {}
    const api = installApi({
      loadQueue: vi.fn(() => new Promise((r) => { loaded = r })),
      saveQueue: vi.fn(),
      getSong: vi.fn(() => Promise.resolve(invented)),
      onWebRemoteQueueBatch: vi.fn((cb: Batch) => { batch = cb; return () => {} })
    })
    await renderApp()
    await act(async () => { await batch({ items: [{ kind: 'song', payload: { songId: 9 } }], contributor: { deviceId: 'phone-1', label: 'Phone' } }) })
    await act(async () => { loaded([song('s', 'Saved Invented Song')]) })
    await tick()
    expect(lastSaved(api)).toEqual(['Saved Invented Song', 'Invented Song C'])
  })
})

describe('New service from the phone, then an item added straight away', () => {
  it('starts from the empty queue, not the cleared one', async () => {
    let batch: Batch = async () => {}
    let newService: () => void = () => {}
    const api = installApi({
      loadQueue: vi.fn(() => Promise.resolve([song('a', 'Old Invented Song A'), song('b', 'Old Invented Song B')])),
      saveQueue: vi.fn(),
      getSong: vi.fn(() => Promise.resolve(invented)),
      onWebRemoteQueueBatch: vi.fn((cb: Batch) => { batch = cb; return () => {} }),
      onWebRemoteNewService: vi.fn((cb: () => void) => { newService = cb; return () => {} })
    })
    await renderApp()
    await tick()
    await act(async () => {
      newService()
      await batch({ items: [{ kind: 'song', payload: { songId: 9 } }], contributor: { deviceId: 'phone-1', label: 'Phone' } })
    })
    await tick()
    expect(lastSaved(api)).toEqual(['Invented Song C'])
  })
})
