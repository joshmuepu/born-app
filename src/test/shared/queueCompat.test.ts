import { describe, it, expect } from 'vitest'
import {
  migrateQueue,
  serializeQueue,
  serializeItem,
  itemTitle,
  isProjectable,
  NEWER_VERSION_LABEL,
  UNREADABLE_LABEL,
  EXT_VERSION,
  type QueueItem,
  type MediaItem,
  type UnknownItem
} from '../../shared/queueItem'
import { stepForward } from '../../shared/queueNav'

const song = { kind: 'song', id: 's1', songId: 7, title: 'Amazing Grace', slides: [{ text: 'Amazing grace' }, { text: 'How sweet' }] }
const bible = { kind: 'bible', id: 'b1', translation: 'KJV', reference: 'John 3:16', bookNum: 43, chapter: 3, verseStart: 16, verseEnd: 16, slides: [{ text: 'For God so loved' }] }
const quote = {
  kind: 'quote',
  id: 'q1',
  quote: { text: 'Hello', sermonTitle: 'T', dateCode: '47-0412', sermonId: 12, paragraphIndex: 1, paragraphRef: '5' },
  slides: [{ text: 'Hello' }]
}
const media = (over: Record<string, unknown> = {}): MediaItem => ({
  kind: 'media',
  id: 'm1',
  slides: [],
  mediaId: 'm_abc',
  mediaKind: 'image',
  name: 'Welcome slide',
  ...over
})

/** The migrateQueue shipped in v1.11–v1.13 and v2 before this change, verbatim, as "an older BORN". */
function olderBornMigrate(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (entry && typeof entry === 'object' && 'kind' in entry && Array.isArray((entry as { slides: unknown }).slides)) return entry as Record<string, unknown>
      if (entry && typeof entry === 'object' && 'text' in entry && 'sermonId' in entry) return { kind: 'quote', legacy: true }
      return null
    })
    .filter((x): x is Record<string, unknown> => x !== null)
}

describe('queue compat: known items are untouched', () => {
  it('opens files with sermon, Bible and song items exactly as before, unknown fields included', () => {
    const withExtras = { ...song, futureField: { a: 1 }, source: { deviceId: 'd', label: 'Song Leader' } }
    const out = migrateQueue([quote, bible, withExtras])
    expect(out.map((i) => i.kind)).toEqual(['quote', 'bible', 'song'])
    expect(out[2]).toEqual(withExtras) // same object content, nothing stripped
    expect(serializeQueue(out)).toEqual([quote, bible, withExtras])
  })

  it('still migrates the oldest format (a bare Quote[]) and assigns ids', () => {
    const legacy = { text: 'A line', sermonTitle: 'T', dateCode: '47-0412', sermonId: 3, paragraphIndex: 0, paragraphRef: '1' }
    const out = migrateQueue([legacy])
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('quote')
    expect(out[0].id).toBeTruthy()
  })

  it('gives an id to a known item that has none', () => {
    const { id: _id, ...noId } = song
    expect(migrateQueue([noId])[0].id).toMatch(/^song-/)
  })

  it('returns [] for a non-array file instead of throwing', () => {
    expect(migrateQueue(null)).toEqual([])
    expect(migrateQueue({ items: [] })).toEqual([])
    expect(migrateQueue('nope')).toEqual([])
  })
})

describe('queue compat: unknown and malformed items never crash and never vanish', () => {
  const newerKind = { kind: 'video', id: 'v1', slides: [{ text: 'x' }], clip: { path: 'a.mp4' } }
  const newerNoSlides = { kind: 'youtube', id: 'y1', videoId: 'dQw4w9WgXcQ' }
  const malformed: unknown[] = [null, 42, 'text', [], {}, { kind: 'song' }, { kind: 'quote', slides: 'no' }, { kind: 'bible', slides: [{ text: 'x' }] }, { kind: 'song', slides: [{ nope: 1 }], songId: 1, title: 't' }]

  it('keeps every entry of a mixed file, in order', () => {
    const file = [song, newerKind, bible, null, newerNoSlides, quote, { kind: 'song' }]
    const out = migrateQueue(file)
    expect(out).toHaveLength(file.length)
    expect(out.map((i) => i.kind)).toEqual(['song', 'unknown', 'bible', 'unknown', 'unknown', 'quote', 'unknown'])
    const reasons = out.filter((i): i is UnknownItem => i.kind === 'unknown').map((i) => i.reason)
    expect(reasons).toEqual(['newer', 'malformed', 'newer', 'malformed'])
  })

  it('labels them clearly and makes them non-projectable with no slides', () => {
    const [n, m] = migrateQueue([newerKind, null]) as UnknownItem[]
    expect(n.label).toBe(NEWER_VERSION_LABEL)
    expect(m.label).toBe(UNREADABLE_LABEL)
    expect(itemTitle(n)).toBe(NEWER_VERSION_LABEL)
    expect(isProjectable(n)).toBe(false)
    expect(n.slides).toEqual([])
  })

  it('writes every unknown or malformed entry back exactly as it was read', () => {
    const file = [song, newerKind, ...malformed, newerNoSlides]
    const roundTrip = serializeQueue(migrateQueue(file))
    expect(roundTrip[0]).toEqual(song)
    expect(roundTrip.slice(1)).toEqual(file.slice(1))
  })

  it.each(malformed.map((m, i) => [i, m]))('malformed entry #%i becomes a safe, labelled item', (_i, entry) => {
    const [item] = migrateQueue([entry])
    expect(item.kind).toBe('unknown')
    expect((item as UnknownItem).reason).toBe('malformed')
  })

  it('stepping through a queue with unknown items does not throw', () => {
    const q = migrateQueue([song, newerKind, null, bible])
    let pos = { itemIndex: 0, slideIndex: 0 } as ReturnType<typeof stepForward>
    for (let i = 0; i < 10; i++) pos = stepForward(q, pos)
    expect(pos).not.toBeNull()
  })

  it('keeps the contributor tag of an unknown item so grouping still works', () => {
    const [item] = migrateQueue([{ ...newerKind, source: { deviceId: 'd1', label: 'Song Leader' } }])
    expect(item.source).toEqual({ deviceId: 'd1', label: 'Song Leader' })
  })
})

describe('queue compat: the shell for newer kinds (media)', () => {
  it('writes a media item as an ordinary quote row an older BORN can open', () => {
    const shell = serializeItem(media({ source: { deviceId: 'd', label: 'Operator' } })) as Record<string, unknown>
    expect(shell.kind).toBe('quote')
    expect(Array.isArray(shell.slides)).toBe(true)
    expect((shell.quote as { sermonTitle: string }).sermonTitle).toContain('needs a newer BORN')
    expect((shell.ext as Record<string, unknown>).kind).toBe('media')
    expect((shell.ext as Record<string, unknown>).v).toBe(EXT_VERSION)
    expect(shell.source).toEqual({ deviceId: 'd', label: 'Operator' })
  })

  it('promotes the shell back to a media item on the same version', () => {
    const [m] = migrateQueue([serializeItem(media())])
    expect(m.kind).toBe('media')
    expect((m as MediaItem).mediaId).toBe('m_abc')
    expect((m as MediaItem).name).toBe('Welcome slide')
    expect(m.id).toBe('m1')
  })

  it('an older BORN (the previous migrateQueue, verbatim) passes it through as a quote and keeps ext on re-save', () => {
    const shell = serializeItem(media())
    const [older] = olderBornMigrate([shell])
    expect(older.kind).toBe('quote')
    const resaved = JSON.parse(JSON.stringify([older]))
    const [back] = migrateQueue(resaved)
    expect(back.kind).toBe('media')
  })

  it('carries unknown ext and shell fields through a load and save', () => {
    const shell = { ...(serializeItem(media()) as object), note: 'top-level extra' } as Record<string, unknown>
    ;(shell.ext as Record<string, unknown>).crop = { x: 1 }
    const [m] = migrateQueue([shell])
    const out = serializeItem(m) as Record<string, unknown>
    expect(out.note).toBe('top-level extra')
    expect((out.ext as Record<string, unknown>).crop).toEqual({ x: 1 })
  })

  it('an ext version newer than this build becomes a labelled unknown item and is written back verbatim', () => {
    const shell = { ...(serializeItem(media()) as object) } as Record<string, unknown>
    ;(shell.ext as Record<string, unknown>).v = EXT_VERSION + 1
    const [item] = migrateQueue([shell])
    expect(item.kind).toBe('unknown')
    expect((item as UnknownItem).reason).toBe('newer')
    expect(serializeItem(item)).toEqual(shell)
  })

  it('an ext kind this build does not know is kept, labelled and written back verbatim', () => {
    const shell = { kind: 'quote', id: 'z', slides: [{ text: 'z' }], quote: { text: 'z' }, ext: { v: 1, kind: 'hologram', payload: 1 } }
    const [item] = migrateQueue([shell])
    expect(item.kind).toBe('unknown')
    expect(serializeItem(item)).toEqual(shell)
  })

  it('a media shell with a damaged payload is flagged malformed, not dropped', () => {
    const shell = { kind: 'quote', id: 'z', slides: [{ text: 'z' }], quote: { text: 'z' }, ext: { v: 1, kind: 'media' } }
    const [item] = migrateQueue([shell])
    expect(item.kind).toBe('unknown')
    expect((item as UnknownItem).reason).toBe('malformed')
    expect(serializeItem(item)).toEqual(shell)
  })

  it('media items are not projectable yet and never become a SlidePayload', () => {
    const [m] = migrateQueue([serializeItem(media())])
    expect(isProjectable(m)).toBe(false)
    expect(itemTitle(m as QueueItem)).toBe('Welcome slide')
  })
})
