import { describe, it, expect } from 'vitest'
import {
  reorder,
  remapActiveIndexAfterReorder,
  remapActiveIndexAfterRemove,
  replaceContributorItems
} from '../../renderer/src/queueUtils'

interface Item {
  id: string
  source?: { deviceId: string }
}
const item = (id: string, deviceId?: string): Item => (deviceId ? { id, source: { deviceId } } : { id })

describe('reorder', () => {
  it('moves an item down', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })
  it('moves an item up', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })
  it('is a no-op for equal / out-of-range indices', () => {
    expect(reorder(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
    expect(reorder(['a', 'b'], 0, 9)).toEqual(['a', 'b'])
  })
})

describe('remapActiveIndexAfterReorder', () => {
  it('follows the moved item when it is the active one', () => {
    expect(remapActiveIndexAfterReorder(0, 0, 3)).toBe(3)
  })
  it('shifts left when an earlier item is moved past it', () => {
    expect(remapActiveIndexAfterReorder(2, 0, 3)).toBe(1)
  })
  it('shifts right when a later item is moved before it', () => {
    expect(remapActiveIndexAfterReorder(1, 3, 0)).toBe(2)
  })
  it('is unchanged when the move does not straddle it', () => {
    expect(remapActiveIndexAfterReorder(5, 1, 2)).toBe(5)
  })
  it('stays null when nothing is active', () => {
    expect(remapActiveIndexAfterReorder(null, 0, 2)).toBeNull()
  })
})

describe('remapActiveIndexAfterRemove', () => {
  it('clears when the active row is removed', () => {
    expect(remapActiveIndexAfterRemove(2, 2)).toBeNull()
  })
  it('shifts left when an earlier row is removed', () => {
    expect(remapActiveIndexAfterRemove(3, 1)).toBe(2)
  })
  it('is unchanged when a later row is removed', () => {
    expect(remapActiveIndexAfterRemove(1, 4)).toBe(1)
  })
})

describe('replaceContributorItems', () => {
  it('replaces a contributor\'s not-yet-played items with a fresh batch', () => {
    const queue = [item('a', 'dev-1'), item('b', 'dev-1'), item('c', 'dev-2')]
    const next = replaceContributorItems(queue, [item('new1', 'dev-1')], 'dev-1', new Set(), null)
    expect(next.map((i) => i.id)).toEqual(['c', 'new1'])
  })

  it('leaves the other contributor and untagged items untouched', () => {
    const queue = [item('a', 'dev-1'), item('b'), item('c', 'dev-2')]
    const next = replaceContributorItems(queue, [item('new1', 'dev-1')], 'dev-1', new Set(), null)
    expect(next.map((i) => i.id)).toEqual(['b', 'c', 'new1'])
  })

  it('never removes an already-played item from this contributor', () => {
    const queue = [item('a', 'dev-1'), item('b', 'dev-1')]
    const next = replaceContributorItems(queue, [item('new1', 'dev-1')], 'dev-1', new Set(['a']), null)
    // 'a' (played) stays; 'b' (not played) is superseded by the new batch,
    // inserted right after the last kept item from this same contributor.
    expect(next.map((i) => i.id)).toEqual(['a', 'new1'])
  })

  it('never removes the item currently on screen, even if not yet marked played', () => {
    const queue = [item('a', 'dev-1'), item('b', 'dev-1')]
    const next = replaceContributorItems(queue, [item('new1', 'dev-1')], 'dev-1', new Set(), 'a')
    expect(next.map((i) => i.id)).toEqual(['a', 'new1'])
  })

  it('appends at the end when nothing from this contributor remains', () => {
    const queue = [item('a', 'dev-2')]
    const next = replaceContributorItems(queue, [item('new1', 'dev-1')], 'dev-1', new Set(), null)
    expect(next.map((i) => i.id)).toEqual(['a', 'new1'])
  })
})
