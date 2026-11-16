import { describe, it, expect } from 'vitest'
import { CrashGuard } from '../../main/crashGuard'

describe('CrashGuard', () => {
  it('allows three restarts a minute, refuses the fourth stop, and allows again after a reset or a quiet minute', () => {
    let t = 0
    const g = new CrashGuard(3, 60_000, () => t)
    expect([g.crashed(), g.crashed(), g.crashed()]).toEqual([true, true, true])
    expect(g.crashed()).toBe(false)
    g.reset()
    expect(g.crashed()).toBe(true)
    t = 120_000
    expect([g.crashed(), g.crashed(), g.crashed()]).toEqual([true, true, true])
    t = 200_000
    expect(g.crashed()).toBe(true)
  })
})
