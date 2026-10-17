import { describe, it, expect } from 'vitest'
import { looksNewProfile, shouldAutoRun } from '../../renderer/src/runView'

const store = (keys: string[]): Pick<Storage, 'length' | 'key'> => ({ length: keys.length, key: (i: number) => keys[i] ?? null })

describe('Run view: who gets "switch to Run when the screens open" (P-06)', () => {
  it('a profile that has never been used is new', () => {
    expect(looksNewProfile(store([]))).toBe(true)
    expect(looksNewProfile(store(['born.setupSunday', 'born.autoRun', 'born.clickShows']))).toBe(true) // only keys the new features wrote
  })
  it('a profile in use is not (it keeps the old way unless the person turns it on)', () => {
    for (const k of ['born.theme', 'born.queuePanel', 'born.queueWidth', 'born.uiScale', 'born.recentSearches']) expect(looksNewProfile(store([k])), k).toBe(false)
  })
  it('other sites’ keys are not ours', () => {
    expect(looksNewProfile(store(['other.thing']))).toBe(true)
  })
  it('the screens opening switch to Run only with the setting on, from Prepare, when there is a queue', () => {
    const base = { autoRun: true, view: 'prepare' as const, projectionJustOpened: true, queueLength: 3 }
    expect(shouldAutoRun(base)).toBe(true)
    expect(shouldAutoRun({ ...base, autoRun: false })).toBe(false)
    expect(shouldAutoRun({ ...base, view: 'run' })).toBe(false)
    expect(shouldAutoRun({ ...base, projectionJustOpened: false })).toBe(false)
    expect(shouldAutoRun({ ...base, queueLength: 0 })).toBe(false)
  })
})
