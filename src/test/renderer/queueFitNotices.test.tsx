// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ServiceQueue from '../../renderer/src/components/ServiceQueue'
import type { QueueItem } from '../../renderer/src/types'

// A very long song page and a very long verse page, as measured by the congregation screen: the operator sees "Text is very small" or "Text is
// cut" on the queue row before the item is live, and on the live preview while that slide is on screen. Before, nothing was said.
const longSong = Array.from({ length: 24 }, (_, i) => `Placeholder line ${i + 1} of a very long song page`).join('\n')
const longVerse = 'And it came to pass, '.repeat(30) + 'that the placeholder verse ended.'
const song = { kind: 'song', id: 's1', songId: 1, title: 'Morning Song', slides: [{ text: 'Short verse' }, { text: longSong, label: 'Verse 2' }] } as QueueItem
const verse = { kind: 'bible', id: 'b1', translation: 'KJV', reference: 'Placeholder 1:1', bookNum: 1, chapter: 1, verseStart: 1, verseEnd: 1, slides: [{ text: longVerse, marker: '1' }] } as QueueItem
const plain = { kind: 'song', id: 's2', songId: 2, title: 'Evening Song', slides: [{ text: 'Short verse' }] } as QueueItem

const noop = (): void => {}
const base = {
  playedIds: new Set<string>(), readingAhead: false, activeIndex: null, activeSlide: 0, onScreen: null, projectionOpen: true, stageOpen: false,
  blanked: false, onProject: noop, onSelect: noop, onRemove: noop, onPrev: async () => false, onNext: async () => false, onReorder: noop,
  onNewService: noop, onOpenService: noop, onImportService: noop, onSaveService: noop, recents: [], onOpenRecent: noop
}

describe('the queue says when a slide is very small or cut on the congregation screen', () => {
  it('marks the rows before they are live', () => {
    render(<ServiceQueue {...base} queue={[song, verse, plain]} fitNotices={{ s1: [null, 'small'], b1: ['cut'], s2: [null] }} />)
    expect(screen.getByText('Text is very small')).toBeInTheDocument()
    expect(screen.getByText('Text is cut')).toBeInTheDocument()
    expect(screen.getAllByText(/Text is (very small|cut)/)).toHaveLength(2)
  })
  it('marks the live preview only while the small slide itself is on screen', () => {
    const live = (slide: number): void => {
      render(<ServiceQueue {...base} queue={[song]} activeIndex={0} activeSlide={slide} onScreen={{ text: song.slides[slide].text }} fitNotices={{ s1: [null, 'small'] }} />)
    }
    live(1)
    expect(document.querySelector('.live-now-hidden-badge--warn')?.textContent).toBe('Text is very small')
    document.body.innerHTML = ''
    live(0)
    expect(document.querySelector('.live-now-hidden-badge--warn')).toBeNull()
  })
  it('says nothing when the screen is closed and nothing was measured', () => {
    render(<ServiceQueue {...base} projectionOpen={false} queue={[song, verse]} />)
    expect(screen.queryByText(/Text is (very small|cut)/)).toBeNull()
  })
})
