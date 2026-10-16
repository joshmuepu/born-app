import { describe, it, expect } from 'vitest'
import { pickable, MAX_PICKER_OPTIONS } from '../../renderer/src/components/MediaBackgrounds'
import type { MediaRecord } from '../../shared/media'

const rec = (i: number): MediaRecord => ({ id: `m_${i}` } as MediaRecord)
describe('background pickers on a very large library', () => {
  it('small libraries list everything', () => {
    const items = Array.from({ length: 50 }, (_, i) => rec(i))
    expect(pickable(items)).toBe(items)
  })
  it('large libraries list the newest, always including the picture in use', () => {
    const items = Array.from({ length: 5000 }, (_, i) => rec(i))
    expect(pickable(items)).toHaveLength(MAX_PICKER_OPTIONS)
    const withCur = pickable(items, 'm_4000')
    expect(withCur).toHaveLength(MAX_PICKER_OPTIONS + 1)
    expect(withCur.some((r) => r.id === 'm_4000')).toBe(true)
    expect(pickable(items, 'm_5')).toHaveLength(MAX_PICKER_OPTIONS)
  })
})
