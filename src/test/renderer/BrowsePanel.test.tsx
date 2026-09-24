// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BrowsePanel from '../../renderer/src/components/BrowsePanel'

// window.electronAPI is mocked in src/test/setup.ts

beforeEach(() => {
  vi.clearAllMocks()
  window.electronAPI.getBrowseSeries = vi.fn(() =>
    Promise.resolve([
      { i: 1, n: 'Church Age Book', s: [10, 11, 12] },
      { i: 2, n: 'Seals Series', s: [20, 21] }
    ])
  )
  window.electronAPI.getBrowseLocation = vi.fn(() =>
    Promise.resolve([
      {
        id: 1,
        name: 'Indiana',
        cities: [{ id: 5, name: 'Jeffersonville', sermonIds: [40, 41] }]
      }
    ])
  )
  window.electronAPI.getBrowseDateGroups = vi.fn(() =>
    Promise.resolve([
      { label: '1960s', sermonIds: [30, 31] }
    ])
  )
  window.electronAPI.getBrowseDateTree = vi.fn(() =>
    Promise.resolve({
      years: [
        {
          year: 1960,
          count: 2,
          unknownMonthIds: [],
          months: [
            {
              month: 1,
              count: 2,
              unknownDayIds: [],
              days: [
                { day: 1, ids: [30] },
                { day: 5, ids: [31] }
              ]
            }
          ]
        }
      ],
      undatedIds: []
    })
  )
  window.electronAPI.getSermonsByIds = vi.fn(() =>
    Promise.resolve([
      { id: 10, date_code: '60-0101', title: 'Sermon One', para_count: 50, duration_min: 60, is_book: 0 }
    ])
  )
  window.electronAPI.getSermonParagraphs = vi.fn(() =>
    Promise.resolve([
      { text: 'In the beginning', sermonTitle: 'Sermon One', dateCode: '60-0101', sermonId: 10, paragraphIndex: 1, paragraphRef: 'p1' }
    ])
  )
  window.electronAPI.getRecentSermons = vi.fn(() => Promise.resolve([]))
  window.electronAPI.clearRecentSermons = vi.fn(() => Promise.resolve())
})

describe('BrowsePanel', () => {
  it('renders the four hub cards', () => {
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^Date/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /^Series/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /^Location/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /^Recently Played/ })).toBeDefined()
  })

  it('loads the Date tab (year grid) by default — the most common live-service need', async () => {
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('1960')).toBeDefined())
    expect(window.electronAPI.getBrowseDateTree).toHaveBeenCalledOnce()
  })

  it('switches to Series tab and loads the series list', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Series/ }))
    await waitFor(() => expect(screen.getByText('Church Age Book')).toBeDefined())
    expect(screen.getByText('Seals Series')).toBeDefined()
    expect(window.electronAPI.getBrowseSeries).toHaveBeenCalledOnce()
  })

  it('shows series sermon count', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Series/ }))
    await waitFor(() => screen.getByText('Church Age Book'))
    expect(screen.getByText('3 sermons')).toBeDefined()
  })

  it('switches to Location tab and loads the state list', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Location/ }))
    await waitFor(() => expect(screen.getByText('Indiana')).toBeDefined())
    expect(window.electronAPI.getBrowseLocation).toHaveBeenCalledOnce()
  })

  it('does not reload series when switching back to Series tab', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Series/ }))
    await waitFor(() => screen.getByText('Church Age Book'))

    await user.click(screen.getByRole('button', { name: /^Location/ }))
    await user.click(screen.getByRole('button', { name: /^Series/ }))

    // getBrowseSeries should still only be called once (lazy-loaded and cached)
    expect(window.electronAPI.getBrowseSeries).toHaveBeenCalledOnce()
  })

  it('drills into a series to show sermon list', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Series/ }))
    await waitFor(() => screen.getByText('Church Age Book'))

    await user.click(screen.getByText('Church Age Book'))

    await waitFor(() => expect(screen.getByText('Sermon One')).toBeDefined())
    expect(window.electronAPI.getSermonsByIds).toHaveBeenCalledWith([10, 11, 12])
  })

  it('drills into a sermon to show paragraphs', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Series/ }))
    await waitFor(() => screen.getByText('Church Age Book'))
    await user.click(screen.getByText('Church Age Book'))
    await waitFor(() => screen.getByText('Sermon One'))
    await user.click(screen.getByText('Sermon One'))

    await waitFor(() => expect(screen.getByText('In the beginning')).toBeDefined())
    expect(window.electronAPI.getSermonParagraphs).toHaveBeenCalledWith(10, 'en')
  })

  it('shows + Queue and Project buttons on paragraphs', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Series/ }))
    await waitFor(() => screen.getByText('Church Age Book'))
    await user.click(screen.getByText('Church Age Book'))
    await waitFor(() => screen.getByText('Sermon One'))
    await user.click(screen.getByText('Sermon One'))
    await waitFor(() => screen.getByText('In the beginning'))

    expect(screen.getByRole('button', { name: '+ Queue' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Project' })).toBeDefined()
  })

  it('calls onAddToQueue when + Queue clicked', async () => {
    const onAddToQueue = vi.fn()
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={onAddToQueue} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Series/ }))
    await waitFor(() => screen.getByText('Church Age Book'))
    await user.click(screen.getByText('Church Age Book'))
    await waitFor(() => screen.getByText('Sermon One'))
    await user.click(screen.getByText('Sermon One'))
    await waitFor(() => screen.getByText('In the beginning'))
    await user.click(screen.getByRole('button', { name: '+ Queue' }))

    expect(onAddToQueue).toHaveBeenCalledOnce()
    expect(onAddToQueue).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'In the beginning' })
    )
  })

  it('calls onSendToProjection when Project clicked', async () => {
    const onSendToProjection = vi.fn()
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={onSendToProjection} />)
    await user.click(screen.getByRole('button', { name: /^Series/ }))
    await waitFor(() => screen.getByText('Church Age Book'))
    await user.click(screen.getByText('Church Age Book'))
    await waitFor(() => screen.getByText('Sermon One'))
    await user.click(screen.getByText('Sermon One'))
    await waitFor(() => screen.getByText('In the beginning'))
    await user.click(screen.getByRole('button', { name: 'Project' }))

    expect(onSendToProjection).toHaveBeenCalledOnce()
  })

  it('shows Back button in sermon list and returns to group list', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Series/ }))
    await waitFor(() => screen.getByText('Church Age Book'))
    await user.click(screen.getByText('Church Age Book'))
    await waitFor(() => screen.getByText('Sermon One'))

    await user.click(screen.getByRole('button', { name: /Back/i }))
    await waitFor(() => expect(screen.getByText('Church Age Book')).toBeDefined())
  })

  it('renders empty series list without crashing when getBrowseSeries returns empty array', async () => {
    window.electronAPI.getBrowseSeries = vi.fn(() => Promise.resolve([]))
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Series/ }))
    await waitFor(() => expect(window.electronAPI.getBrowseSeries).toHaveBeenCalledOnce())
    expect(screen.queryByText('Church Age Book')).toBeNull()
  })

  it('drills Date: year → month → day', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await waitFor(() => screen.getByText('1960'))

    await user.click(screen.getByText('1960'))
    await waitFor(() =>
      expect(window.electronAPI.getSermonsByIds).toHaveBeenCalledWith([30, 31])
    )

    // the calendar is now visible; click day 1 to narrow to that day
    await waitFor(() => screen.getByText('January 1960'))
    await user.click(screen.getByText('1', { selector: '.browse-cal-day' }))
    await waitFor(() =>
      expect(window.electronAPI.getSermonsByIds).toHaveBeenCalledWith([30])
    )
  })

  it('drills Location: state → city → sermons', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Location/ }))
    await waitFor(() => screen.getByText('Indiana'))
    await user.click(screen.getByText('Indiana'))
    await waitFor(() => expect(screen.getByText('Jeffersonville')).toBeDefined())
    await user.click(screen.getByText('Jeffersonville'))
    await waitFor(() =>
      expect(window.electronAPI.getSermonsByIds).toHaveBeenCalledWith([40, 41])
    )
  })

  it('Recently Played tab shows an empty hint with nothing recent', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Recently Played/ }))
    await waitFor(() => expect(window.electronAPI.getRecentSermons).toHaveBeenCalledOnce())
    expect(screen.getByText(/show up here/i)).toBeDefined()
  })

  it('Recently Played tab lists past quotes and can project one', async () => {
    window.electronAPI.getRecentSermons = vi.fn(() =>
      Promise.resolve([
        {
          text: 'By faith Abraham obeyed',
          sermonTitle: 'Come Follow Me',
          dateCode: '63-0901M',
          sermonId: 1,
          paragraphIndex: 1,
          paragraphRef: 'p1'
        }
      ])
    )
    const onSendToProjection = vi.fn()
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={onSendToProjection} />)
    await user.click(screen.getByRole('button', { name: /^Recently Played/ }))
    await waitFor(() => expect(screen.getByText(/Come Follow Me/)).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Project' }))
    expect(onSendToProjection).toHaveBeenCalledWith(
      expect.objectContaining({ sermonTitle: 'Come Follow Me' }),
      0
    )
  })

  it('Recently Played tab clears with the Clear button', async () => {
    window.electronAPI.getRecentSermons = vi.fn(() =>
      Promise.resolve([
        {
          text: 'By faith Abraham obeyed',
          sermonTitle: 'Come Follow Me',
          dateCode: '63-0901M',
          sermonId: 1,
          paragraphIndex: 1,
          paragraphRef: 'p1'
        }
      ])
    )
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Recently Played/ }))
    await waitFor(() => expect(screen.getByText(/Come Follow Me/)).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(window.electronAPI.clearRecentSermons).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByText(/show up here/i)).toBeDefined())
  })
})
