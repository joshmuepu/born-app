import { describe, it, expect } from 'vitest'
import { cursorsFor } from '../../renderer/src/liveNav'
import type { QueueItem } from '../../shared/queueItem'

describe('cursorsFor', () => {
  it('seeds a quote cursor from its paragraph ref, tail at the last page', () => {
    const item: QueueItem = {
      kind: 'quote',
      id: 'q1',
      quote: {
        text: '26 ...',
        sermonTitle: 'Perfect Faith',
        dateCode: '63-0825E',
        sermonId: 986,
        paragraphIndex: 0,
        paragraphRef: '26',
        language: 'en'
      },
      slides: [{ text: 'page one' }, { text: 'page two' }, { text: 'page three' }]
    }
    expect(cursorsFor(item)).toEqual({
      head: { kind: 'quote', sermonId: 986, language: 'en', paragraphRef: '26', page: 0 },
      tail: { kind: 'quote', sermonId: 986, language: 'en', paragraphRef: '26', page: 2 }
    })
  })

  it('spans a Bible cursor from verseStart to verseEnd', () => {
    const item: QueueItem = {
      kind: 'bible',
      id: 'b1',
      translation: 'KJV',
      reference: 'John 3:16–18',
      bookNum: 43,
      chapter: 3,
      verseStart: 16,
      verseEnd: 18,
      slides: [{ text: 'a' }, { text: 'b' }, { text: 'c' }]
    }
    const c = cursorsFor(item)
    expect(c.head).toEqual({ kind: 'bible', translation: 'KJV', bookNum: 43, chapter: 3, verse: 16 })
    expect(c.tail).toEqual({ kind: 'bible', translation: 'KJV', bookNum: 43, chapter: 3, verse: 18 })
  })

  it('gives songs no cursor — they do not flow past their slides', () => {
    const item: QueueItem = {
      kind: 'song',
      id: 's1',
      songId: 1,
      title: 'Amazing Grace',
      slides: [{ text: 'v1' }]
    }
    expect(cursorsFor(item)).toEqual({})
  })

  it('defaults a missing quote language to en', () => {
    const item: QueueItem = {
      kind: 'quote',
      id: 'q2',
      quote: {
        text: 't',
        sermonTitle: 'S',
        dateCode: 'd',
        sermonId: 1,
        paragraphIndex: 0,
        paragraphRef: '1'
      },
      slides: [{ text: 't' }]
    }
    expect(cursorsFor(item).head).toMatchObject({ language: 'en', page: 0 })
  })
})
