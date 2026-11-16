import { describe, it, expect } from 'vitest'
import { fitOperatorWindow } from '../../main/windowFit'

describe('the operator window fits the display it opens on', () => {
  it('on a 960x600 work area its smallest and first sizes are no larger than the work area', () => {
    const f = fitOperatorWindow({ width: 960, height: 600 })
    expect(f.min.width).toBeLessThanOrEqual(960)
    expect(f.min.height).toBeLessThanOrEqual(600)
    expect(f.size).toEqual({ width: 960, height: 600 })
  })
  it('on a large display nothing changes (1040x640 smallest, 1280x800 first)', () => {
    expect(fitOperatorWindow({ width: 1920, height: 1055 })).toEqual({ min: { width: 1040, height: 640 }, size: { width: 1280, height: 800 } })
  })
})
