// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SermonFollowView from '../../renderer/src/components/SermonFollowView'
import type { Quote } from '../../renderer/src/types'

// window.electronAPI is mocked in src/test/setup.ts

const LONG_PARA_1 =
  'Our Heavenly Father, that is our intention tonight. We have assembled together to only believe, ' +
  'just believe the Lord Jesus. There are those here, tonight, who are sick and afflicted, and we have ' +
  'dedicated our service tonight to the healing of the sick and broken body. Now, as the singer just sang ' +
  'that beautiful hymn, may You come on the scene for us tonight, Lord, and heal all that is afflicted, ' +
  'and there will not be a feeble person in our midst tonight. Grant it, Lord, and help us as we look to ' +
  'the Word now to find faith sufficient for this hour. We ask it in Jesus Name. Amen.'

const paras: Quote[] = [
  {
    text: 'Perfect Faith 63-0825e Jeffersonville Indiana U.S.A.',
    sermonTitle: 'Perfect Faith',
    dateCode: '63-0825E',
    sermonId: 986,
    paragraphIndex: 0,
    paragraphRef: 'header'
  },
  {
    text: `1 ${LONG_PARA_1}`,
    sermonTitle: 'Perfect Faith',
    dateCode: '63-0825E',
    sermonId: 986,
    paragraphIndex: 1,
    paragraphRef: '1'
  }
]

beforeEach(() => {
  vi.clearAllMocks()
  window.electronAPI.getSermonParagraphs = vi.fn(() => Promise.resolve(paras))
  // jsdom doesn't implement scrollIntoView; the component calls it to keep
  // the live/focused paragraph in view.
  Element.prototype.scrollIntoView = vi.fn()
})

describe('SermonFollowView — on-screen marking', () => {
  it('marks only the header paragraph as on-screen when the header is live', async () => {
    render(
      <SermonFollowView
        sermonId={986}
        anchorRef="header"
        liveRef="header"
        onBack={vi.fn()}
        onProject={vi.fn()}
        onAddToQueue={vi.fn()}
      />
    )
    await waitFor(() => expect(screen.getByText('Title')).toBeInTheDocument())

    // Reproduces a real bug: the header's projected slide has no third
    // " · "-separated paragraph segment, and the caller used to fall back to
    // the sermon's *date code* ("63-0825E") as the live paragraph ref —
    // which parses as the numeric range [63, 825] and spuriously overlaps
    // almost every real paragraph number in the sermon. Only the header
    // itself must be marked here.
    const onScreenTags = screen.getAllByText('On screen')
    expect(onScreenTags).toHaveLength(1)
    expect(onScreenTags[0].closest('.follow-para')?.textContent).toContain('Title')
  })

  it('marks only the specific page live, not every page of the same paginated paragraph', async () => {
    render(
      <SermonFollowView
        sermonId={986}
        anchorRef="1"
        liveRef="1b"
        onBack={vi.fn()}
        onProject={vi.fn()}
        onAddToQueue={vi.fn()}
      />
    )
    await waitFor(() => expect(screen.getByText('¶1b')).toBeInTheDocument())

    // Paragraph 1 is long enough to paginate into 1a/1b/1c…; refsOverlap
    // strips the letter suffix and numeric-matches all of them, which
    // previously marked every page "on screen" when only 1b was live.
    const onScreenTags = screen.getAllByText('On screen')
    expect(onScreenTags).toHaveLength(1)
    expect(onScreenTags[0].closest('.follow-para')?.textContent).toContain('¶1b')
  })
})

describe('SermonFollowView — where the reader stays', () => {
  const mk = (n: number): Quote => ({
    text: `${n} Placeholder paragraph number ${n}.`,
    sermonTitle: 'Placeholder',
    dateCode: '00-0000',
    sermonId: 5,
    paragraphIndex: n,
    paragraphRef: String(n)
  })
  const props = { sermonId: 5, onBack: vi.fn(), onProject: vi.fn(), onAddToQueue: vi.fn() }
  const scrolledTo = (): string[] =>
    (Element.prototype.scrollIntoView as unknown as { mock: { contexts: Element[] } }).mock.contexts.map(
      (el) => el.querySelector('.follow-para-ref')?.textContent ?? ''
    )

  beforeEach(() => {
    window.electronAPI.getSermonParagraphs = vi.fn(() => Promise.resolve([5, 6, 7, 8, 9].map(mk)))
  })

  it('opens a queued range at its first paragraph, not its last', async () => {
    render(<SermonFollowView {...props} anchorRef="6-8" liveRef={null} />)
    await waitFor(() => expect(screen.getByText('¶8')).toBeInTheDocument())
    expect(scrolledTo()).toEqual(['¶6'])
  })

  it('keeps its place when the screen is hidden (the live paragraph goes away)', async () => {
    const { rerender } = render(<SermonFollowView {...props} anchorRef="6-8" liveRef="7" />)
    await waitFor(() => expect(screen.getByText('¶8')).toBeInTheDocument())
    const before = scrolledTo().length
    rerender(<SermonFollowView {...props} anchorRef="6-8" liveRef={null} />)
    await waitFor(() => expect(screen.getByText('¶8')).toBeInTheDocument())
    expect(scrolledTo().length).toBe(before)
    const marked = [...document.querySelectorAll('.follow-para--focus')].map((e) => e.textContent)
    expect(marked).toHaveLength(1)
    expect(marked[0]).toContain('¶7')
  })

  it('follows a new anchor after a hide (a different queue row was clicked)', async () => {
    const { rerender } = render(<SermonFollowView {...props} anchorRef="6" liveRef="7" />)
    await waitFor(() => expect(screen.getByText('¶8')).toBeInTheDocument())
    rerender(<SermonFollowView {...props} anchorRef="6" liveRef={null} />)
    rerender(<SermonFollowView {...props} anchorRef="9" liveRef={null} />)
    await waitFor(() => expect(scrolledTo().at(-1)).toBe('¶9'))
  })
})

describe('SermonFollowView — a paragraph with no number', () => {
  const props = { sermonId: 5, onBack: vi.fn(), onProject: vi.fn(), onAddToQueue: vi.fn() }
  beforeEach(() => {
    window.electronAPI.getSermonParagraphs = vi.fn(() =>
      Promise.resolve([
        { text: 'alpha beta gamma delta. '.repeat(40), sermonTitle: 'P', dateCode: '00-0000', sermonId: 5, paragraphIndex: 0, paragraphRef: '§77' }
      ])
    )
  })
  it('marks one slide at a time, and never shows the internal id', async () => {
    const { container } = render(<SermonFollowView {...props} anchorRef="§77" liveRef="§77#1" />)
    await waitFor(() => expect(container.querySelectorAll('.follow-para').length).toBeGreaterThan(2))
    expect(container.querySelectorAll('.follow-para--on-screen')).toHaveLength(1)
    expect(container.querySelector('.follow-para--on-screen')?.textContent).toContain('Slide 2')
    expect(container.textContent).not.toContain('§')
  })
  it('opening it from the queue marks the first slide only', async () => {
    const { container } = render(<SermonFollowView {...props} anchorRef="§77" liveRef={null} />)
    await waitFor(() => expect(container.querySelectorAll('.follow-para').length).toBeGreaterThan(2))
    const marked = [...container.querySelectorAll('.follow-para--focus')]
    expect(marked).toHaveLength(1)
    expect(marked[0].textContent).toContain('Slide 1')
  })
})
