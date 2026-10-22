import { describe, it, expect } from 'vitest'
import { popoverFit } from '../../renderer/src/popoverFit'

describe('popoverFit keeps a popover inside the window', () => {
  it('leaves a popover that already fits exactly where it is', () => {
    expect(popoverFit({ left: 100, top: 80, right: 420 }, 1280, 800)).toEqual({ dx: 0, maxHeight: 712 })
  })
  it('pulls one that runs off the left edge back in (the Filters popover in a narrow left panel at 150% scale)', () => {
    expect(popoverFit({ left: -32, top: 180, right: 288 }, 693, 427).dx).toBe(40)
  })
  it('pulls one that runs off the right edge back in', () => {
    expect(popoverFit({ left: 500, top: 80, right: 820 }, 800, 600).dx).toBe(-28)
  })
  it('caps the height to the room below it, so its last button can be reached by scrolling', () => {
    expect(popoverFit({ left: 10, top: 200, right: 330 }, 693, 427).maxHeight).toBe(219)
  })
  it('never asks for a uselessly small height', () => {
    expect(popoverFit({ left: 10, top: 400, right: 330 }, 693, 427).maxHeight).toBe(120)
  })
})
