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
    await waitFor(() => expect(screen.getByText('¶header')).toBeInTheDocument())

    // Reproduces a real bug: the header's projected slide has no third
    // " · "-separated paragraph segment, and the caller used to fall back to
    // the sermon's *date code* ("63-0825E") as the live paragraph ref —
    // which parses as the numeric range [63, 825] and spuriously overlaps
    // almost every real paragraph number in the sermon. Only the header
    // itself must be marked here.
    const onScreenTags = screen.getAllByText('On screen')
    expect(onScreenTags).toHaveLength(1)
    expect(onScreenTags[0].closest('.follow-para')?.textContent).toContain('¶header')
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
