import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'
import {
  youtubeToItem,
  withYouTubeSettings,
  serializeQueue,
  serializeItem,
  migrateQueue,
  itemTitle,
  isProjectable,
  mediaToItem,
  videoToItem,
  mediaIdsInQueue,
  type YouTubeItem
} from '../../shared/queueItem'

const ID = 'dQw4w9WgXcQ'
const roundTrip = (x: unknown): unknown => JSON.parse(JSON.stringify(x))

describe('a YouTube queue item', () => {
  it('stores the id and a few settings — never video, never a thumbnail', () => {
    const it1 = youtubeToItem(ID, { title: 'How Great', label: '', fallback: { blank: true } })
    const saved = JSON.stringify(serializeItem(it1))
    expect(saved).toContain(ID)
    expect(saved).not.toMatch(/ytimg|thumbnail|\.mp4|base64/i)
    expect(saved.length).toBeLessThan(900)
  })
  it('is one slide, projectable, with the name on its card and a playback id that is not a library id', () => {
    const it1 = youtubeToItem(ID, { title: 'How Great' })
    expect(it1.slides).toHaveLength(1)
    expect(it1.slides[0].media).toEqual({ mediaId: 'yt-' + ID, type: 'youtube', youtubeId: ID })
    expect(isProjectable(it1)).toBe(true)
    expect(itemTitle(it1)).toBe('How Great')
  })
  it("the operator's own name wins over the title, and falls back to the id when neither exists", () => {
    expect(itemTitle(youtubeToItem(ID, { title: 'T', label: 'Opening song' }))).toBe('Opening song')
    expect(itemTitle(youtubeToItem(ID))).toBe('YouTube video ' + ID)
    const renamed = withYouTubeSettings(youtubeToItem(ID, { title: 'T' }), { label: 'Mine' })
    expect(renamed.slides[0].text).toBe('Mine')
    expect(withYouTubeSettings(renamed, { label: '' }).slides[0].text).toBe('T')
  })
  it('survives save and open unchanged (including its backup)', () => {
    const a = youtubeToItem(ID, { title: 'T', label: 'L', titleAt: 1700000000000, fallback: { mediaId: 'm_aaaaaaaaaaaa', name: 'Kenya.mp4' } })
    const [b] = migrateQueue(roundTrip(serializeQueue([a]))) as YouTubeItem[]
    expect(b.kind).toBe('youtube')
    expect({ ...b, id: '' }).toEqual({ ...a, id: '' })
    expect(b.id).toBe(a.id)
  })
  it('is written as an ordinary quote-shaped row an older BORN can open', () => {
    const w = serializeItem(youtubeToItem(ID, { title: 'T' })) as { kind: string; slides: Array<{ text: string }>; quote: { sermonId: number; text: string }; ext: { kind: string; v: number; videoId: string } }
    expect(w.kind).toBe('quote')
    expect(w.slides[0].text).toMatch(/YouTube video/)
    expect(w.quote.sermonId).toBe(-1)
    expect(w.ext).toMatchObject({ kind: 'youtube', v: 1, videoId: ID })
  })
  it('keeps fields a newer writer added, and a bad id becomes a visible unreadable row (nothing is dropped)', () => {
    const saved = roundTrip(serializeQueue([youtubeToItem(ID, { title: 'T' })])) as Array<Record<string, any>>
    saved[0].ext.futureThing = { a: 1 }
    saved[0].futureTop = 'x'
    const [b] = migrateQueue(saved) as YouTubeItem[]
    expect(roundTrip(serializeItem(b))).toMatchObject({ futureTop: 'x', ext: { futureThing: { a: 1 }, videoId: ID } })

    const bad = roundTrip(serializeQueue([youtubeToItem(ID)])) as Array<Record<string, any>>
    bad[0].ext.videoId = 'nope'
    const [u] = migrateQueue(bad)
    expect(u.kind).toBe('unknown')
    expect(isProjectable(u)).toBe(false)
    expect(roundTrip(serializeItem(u))).toEqual(bad[0])
  })
  it('adds nothing to the list of library files a service needs (it is a link, not a file)', () => {
    expect(mediaIdsInQueue([youtubeToItem(ID, { fallback: { mediaId: 'm_aaaaaaaaaaaa' } })])).toEqual([])
  })
  it('a newer-than-known ext version is kept as an unknown row, never crashes', () => {
    const saved = roundTrip(serializeQueue([youtubeToItem(ID)])) as Array<Record<string, any>>
    saved[0].ext.v = 99
    expect(migrateQueue(saved)[0].kind).toBe('unknown')
  })
})

/**
 * The real v1.13.x queue reader (the ../born-v1 checkout, when present) must open a file that has YouTube items with no crash,
 * lose nothing, and show a readable row. This runs v1's OWN migrateQueue.
 */
const v1Path = resolve(__dirname, '../../../../born-v1/src/shared/queueItem.ts')
describe.skipIf(!existsSync(v1Path))("v1's own queue reader opens a v2 file that has YouTube items", () => {
  it('does not throw, keeps every row, shows readable text and keeps the video id', async () => {
    const v1 = (await import(/* @vite-ignore */ v1Path)) as { migrateQueue: (raw: unknown) => Array<Record<string, any>>; serializeQueue?: (x: unknown) => unknown }
    const file = roundTrip(serializeQueue([mediaToItem({ id: 'm_aaaaaaaaaaaa', name: 'Welcome' }), youtubeToItem(ID, { title: 'How Great Is Our God' }), videoToItem({ id: 'm_bbbbbbbbbbbb', name: 'Clip' }), youtubeToItem('abc_DEF-123', { label: 'Offering video' })]))
    const items = v1.migrateQueue(file)
    expect(items).toHaveLength(4)
    for (const it of items) {
      expect(it.kind).toBe('quote')
      expect(Array.isArray(it.slides) && it.slides.length > 0).toBe(true)
      expect(typeof it.slides[0].text).toBe('string')
    }
    expect(items[1].slides[0].text).toMatch(/How Great Is Our God — YouTube video/)
    expect(JSON.stringify(items[1])).toContain(ID)
    expect(items[3].slides[0].text).toMatch(/Offering video/)
  })
  it('an old BORN that re-saves the file does not lose the YouTube data', async () => {
    const v1 = (await import(/* @vite-ignore */ v1Path)) as { migrateQueue: (raw: unknown) => Array<Record<string, any>> }
    const file = roundTrip(serializeQueue([youtubeToItem(ID, { title: 'T', fallback: { blank: true } })]))
    const resaved = roundTrip(v1.migrateQueue(file))
    const [back] = migrateQueue(resaved) as YouTubeItem[]
    expect(back.kind).toBe('youtube')
    expect(back.videoId).toBe(ID)
    expect(back.fallback).toEqual({ blank: true })
  })
})
