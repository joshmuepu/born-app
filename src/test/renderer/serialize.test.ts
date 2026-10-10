import { describe, it, expect, vi } from 'vitest'
import { newSerialQueue, serialize } from '../../renderer/src/serialize'

/** Resolves on the next microtask tick — lets any already-scheduled .then()
 *  callbacks run before the assertion, without needing real/fake timers. */
const tick = (): Promise<void> => Promise.resolve()

describe('serialize()', () => {
  it('starts a second call only after the first has settled, not immediately', async () => {
    const queue = newSerialQueue()
    const order: string[] = []
    let resolveFirst!: () => void
    const first = serialize(queue, () => {
      order.push('first start')
      return new Promise<void>((resolve) => {
        resolveFirst = () => {
          order.push('first end')
          resolve()
        }
      })
    })

    // The second call is issued immediately, the way two rapid taps (or the
    // remote and the keyboard shortcut firing in the same tick) would.
    const second = serialize(queue, async () => {
      order.push('second start')
    })

    await tick()
    // Second must not have started yet — first is still pending.
    expect(order).toEqual(['first start'])

    resolveFirst()
    await first
    await second

    expect(order).toEqual(['first start', 'first end', 'second start'])
  })

  it('still runs a queued call after an earlier one rejects, instead of leaving the queue stuck', async () => {
    const queue = newSerialQueue()
    const firstResult = serialize(queue, () => Promise.reject(new Error('boom')))
    const secondRan = vi.fn(async () => 'ok')
    const secondResult = serialize(queue, secondRan)

    await expect(firstResult).rejects.toThrow('boom')
    await expect(secondResult).resolves.toBe('ok')
    expect(secondRan).toHaveBeenCalledTimes(1)
  })

  it('returns each call\'s own result to its own caller, independent of the others', async () => {
    const queue = newSerialQueue()
    const a = serialize(queue, async () => 1)
    const b = serialize(queue, async () => 2)
    const c = serialize(queue, async () => 3)

    expect(await Promise.all([a, b, c])).toEqual([1, 2, 3])
  })

  it('reproduces the exact Next/Prev race this exists to prevent, as a minimal repro independent of App.tsx', async () => {
    // Mirrors advance(): read shared state, compute from it, then write it
    // back after an await — the shape that raced before serialize() existed.
    const queue = newSerialQueue()
    let onScreen = 0
    async function tap(): Promise<void> {
      const current = onScreen // read
      await tick() // the awaited work in between (ensureProjectionOpen(), etc.)
      onScreen = current + 1 // write, based on what was read at the start
    }

    // Unserialized: both taps read onScreen=0 before either writes — only
    // one net advance instead of two. This asserts the OLD, buggy shape to
    // make the contrast with the serialized version below explicit.
    onScreen = 0
    await Promise.all([tap(), tap()])
    expect(onScreen).toBe(1)

    // Serialized: the second tap's read only happens after the first tap's
    // write has completed.
    onScreen = 0
    await Promise.all([serialize(queue, tap), serialize(queue, tap)])
    expect(onScreen).toBe(2)
  })
})
