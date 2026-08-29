import { describe, it, expect } from 'vitest'
import {
  reorder,
  remapActiveIndexAfterReorder,
  remapActiveIndexAfterRemove
} from '../../renderer/src/queueUtils'

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
