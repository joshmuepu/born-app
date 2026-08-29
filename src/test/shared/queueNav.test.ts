import { describe, it, expect } from 'vitest'
import { stepForward, stepBack, clampPosition } from '../../shared/queueNav'

// queue of 3 items with 1, 3, and 2 slides
const q = [{ slides: [0] }, { slides: [0, 1, 2] }, { slides: [0, 1] }]

describe('stepForward', () => {
  it('null → first slide of first item', () => {
    expect(stepForward(q, null)).toEqual({ itemIndex: 0, slideIndex: 0 })
  })
  it('advances within an item', () => {
    expect(stepForward(q, { itemIndex: 1, slideIndex: 0 })).toEqual({ itemIndex: 1, slideIndex: 1 })
  })
  it('spills into the next item at slide 0', () => {
    expect(stepForward(q, { itemIndex: 1, slideIndex: 2 })).toEqual({ itemIndex: 2, slideIndex: 0 })
    expect(stepForward(q, { itemIndex: 0, slideIndex: 0 })).toEqual({ itemIndex: 1, slideIndex: 0 })
  })
  it('stops at the very end', () => {
    expect(stepForward(q, { itemIndex: 2, slideIndex: 1 })).toEqual({ itemIndex: 2, slideIndex: 1 })
  })
  it('empty queue → null', () => {
    expect(stepForward([], null)).toBeNull()
  })
})

describe('stepBack', () => {
  it('retreats within an item', () => {
    expect(stepBack(q, { itemIndex: 1, slideIndex: 2 })).toEqual({ itemIndex: 1, slideIndex: 1 })
  })
  it('spills into the previous item at its last slide', () => {
    expect(stepBack(q, { itemIndex: 2, slideIndex: 0 })).toEqual({ itemIndex: 1, slideIndex: 2 })
    expect(stepBack(q, { itemIndex: 1, slideIndex: 0 })).toEqual({ itemIndex: 0, slideIndex: 0 })
  })
  it('stops at the very start', () => {
    expect(stepBack(q, { itemIndex: 0, slideIndex: 0 })).toEqual({ itemIndex: 0, slideIndex: 0 })
  })
})

describe('clampPosition', () => {
  it('clamps an out-of-range position', () => {
    expect(clampPosition(q, { itemIndex: 9, slideIndex: 9 })).toEqual({ itemIndex: 2, slideIndex: 1 })
  })
  it('empty queue → null', () => {
    expect(clampPosition([], { itemIndex: 0, slideIndex: 0 })).toBeNull()
  })
})
