import { describe, it, expect } from 'vitest'
import { nextFollowSermon, type FollowSermon } from '../../renderer/src/queueUtils'
import type { Quote } from '../../renderer/src/types'

const quote = (sermonId: number, paragraphRef: string): Quote => ({
  text: 'placeholder',
  sermonTitle: 'placeholder',
  dateCode: '63-0825E',
  sermonId,
  paragraphIndex: 0,
  paragraphRef
})

describe('nextFollowSermon', () => {
  it('starts a fresh sermon with no carried-over query/matchType', () => {
    expect(nextFollowSermon(null, quote(1, '1a'))).toEqual({ sermonId: 1, anchorRef: '1a' })
  })

  it('drops a previous search query/matchType when opening a different sermon', () => {
    // Reproduces the reported bug: searching "faith", then opening an
    // unrelated sermon via Browse or the queue, must not keep highlighting
    // "faith" there.
    const prev: FollowSermon = { sermonId: 1, anchorRef: '26a', query: 'faith', matchType: 'all' }
    expect(nextFollowSermon(prev, quote(2, '1a'))).toEqual({ sermonId: 2, anchorRef: '1a' })
  })

  it('preserves query/matchType when staying on the sermon already being followed', () => {
    // "Restart here" on another paragraph of the same sermon (still inside
    // the follow view opened from a real search) should keep highlighting.
    const prev: FollowSermon = { sermonId: 1, anchorRef: '26a', query: 'faith', matchType: 'all' }
    expect(nextFollowSermon(prev, quote(1, '27a'))).toEqual({
      sermonId: 1,
      anchorRef: '27a',
      query: 'faith',
      matchType: 'all'
    })
  })
})
