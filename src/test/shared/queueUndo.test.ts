import { describe, it, expect } from 'vitest'
import { reinsertAt, removeById, moveBackTo, mergeRestore } from '../../renderer/src/queueUndo'
import type { QueueItem } from '../../renderer/src/types'

const it_ = (id: string): QueueItem =>
  ({ kind: 'song', id, songId: 1, title: id, slides: [{ text: id }] }) as QueueItem
const ids = (q: QueueItem[]): string[] => q.map((x) => x.id)

describe('queue undo helpers', () => {
  it('reinsertAt puts a removed item back at its index and leaves later additions alone', () => {
    const current = [it_('a'), it_('c'), it_('NEW')]
    expect(ids(reinsertAt(current, it_('b'), 1))).toEqual(['a', 'b', 'c', 'NEW'])
  })

  it('reinsertAt clamps and never duplicates', () => {
    expect(ids(reinsertAt([it_('a')], it_('z'), 99))).toEqual(['a', 'z'])
    const cur = [it_('a'), it_('b')]
    expect(reinsertAt(cur, it_('b'), 0)).toBe(cur)
  })

  it('removeById undoes an add without touching anything else, and is a no-op if already gone', () => {
    const cur = [it_('a'), it_('x'), it_('b')]
    expect(ids(removeById(cur, 'x'))).toEqual(['a', 'b'])
    expect(removeById(cur, 'nope')).toBe(cur)
  })

  it('moveBackTo returns one item to where it was, keeping the rest in their current order', () => {
    // 'c' was moved from index 2 to 0; meanwhile 'NEW' was appended
    const current = [it_('c'), it_('a'), it_('b'), it_('NEW')]
    expect(ids(moveBackTo(current, 'c', 2))).toEqual(['a', 'b', 'c', 'NEW'])
  })

  it('moveBackTo ignores an item that has since been removed', () => {
    const cur = [it_('a'), it_('b')]
    expect(moveBackTo(cur, 'gone', 0)).toBe(cur)
  })

  it('mergeRestore brings the old queue back and keeps what was added since', () => {
    const snapshot = [it_('a'), it_('b')]
    const current = [it_('n1'), it_('n2')]
    expect(ids(mergeRestore(snapshot, current))).toEqual(['a', 'b', 'n1', 'n2'])
  })

  it('mergeRestore does not duplicate items present in both', () => {
    const snapshot = [it_('a'), it_('b')]
    const current = [it_('b'), it_('n')]
    expect(ids(mergeRestore(snapshot, current))).toEqual(['a', 'b', 'n'])
  })
})
