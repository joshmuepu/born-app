import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { serializeQueue, videoToItem, mediaToItem, slideshowToItem } from '../../shared/queueItem'

/**
 * A v2 file with picture and VIDEO items must open in the v1 build without crashing (the v1.13.x checkout next to this
 * one, when present — the test is skipped on a machine that has no v1 folder). The compat shell is quote-shaped, so v1 shows a
 * harmless row and keeps the data under `ext`.
 */
const v1Path = resolve(__dirname, '../../../../born-v1/src/shared/queueItem.ts')
describe.skipIf(!existsSync(v1Path))("v1's own queue reader opens a v2 file that has video", () => {
  it('does not throw, drops nothing, and keeps the video data', async () => {
    const v1 = (await import(/* @vite-ignore */ v1Path)) as { migrateQueue: (raw: unknown) => Array<Record<string, unknown>> }
    const queue = serializeQueue([
      mediaToItem({ id: 'm_aaaaaaaaaaaa', name: 'Welcome' }),
      videoToItem({ id: 'm_bbbbbbbbbbbb', name: 'Testimony' }, { loop: true }),
      slideshowToItem([{ id: 'm_cccccccccccc', name: 'A' }, { id: 'm_dddddddddddd', name: 'B' }])
    ])
    const saved = JSON.parse(JSON.stringify(queue))
    const items = v1.migrateQueue(saved)
    expect(items).toHaveLength(3)
    for (const it of items) expect(it.kind).toBe('quote')
    expect(JSON.stringify(items[1])).toContain('"mediaKind":"video"')
  })
})
