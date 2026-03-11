// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
  window.electronAPI.getBrowseStates = vi.fn(() =>
    Promise.resolve([
      { i: 1, n: 'Indiana', c: [5] }
    ])
  )
  window.electronAPI.getBrowseCities = vi.fn(() =>
    Promise.resolve([{ i: 5, n: 'Jeffersonville' }])
  )
  window.electronAPI.getBrowseDateGroups = vi.fn(() =>
    Promise.resolve([
      { label: '1960s', sermonIds: [30, 31] }
    ])
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
})

describe('BrowsePanel', () => {
  it('renders the three tab buttons', () => {
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Series' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Location' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Date' })).toBeDefined()
  })

  it('loads and displays series list on mount', async () => {
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Church Age Book')).toBeDefined())
    expect(screen.getByText('Seals Series')).toBeDefined()
    expect(window.electronAPI.getBrowseSeries).toHaveBeenCalledOnce()
  })

  it('shows series sermon count', async () => {
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await waitFor(() => screen.getByText('Church Age Book'))
    expect(screen.getByText('3 sermons')).toBeDefined()
  })

  it('switches to Location tab and loads states', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Location' }))
    await waitFor(() => expect(screen.getByText('Indiana')).toBeDefined())
    expect(window.electronAPI.getBrowseStates).toHaveBeenCalledOnce()
  })

  it('switches to Date tab and loads date groups', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Date' }))
    await waitFor(() => expect(screen.getByText('1960s')).toBeDefined())
    expect(window.electronAPI.getBrowseDateGroups).toHaveBeenCalledOnce()
  })

  it('does not reload series when switching back to Series tab', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await waitFor(() => screen.getByText('Church Age Book'))

    await user.click(screen.getByRole('button', { name: 'Location' }))
    await user.click(screen.getByRole('button', { name: 'Series' }))

    // getBrowseSeries should still only be called once (lazy-loaded and cached)
    expect(window.electronAPI.getBrowseSeries).toHaveBeenCalledOnce()
  })

  it('drills into a series to show sermon list', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await waitFor(() => screen.getByText('Church Age Book'))

    await user.click(screen.getByText('Church Age Book'))

    await waitFor(() => expect(screen.getByText('Sermon One')).toBeDefined())
    expect(window.electronAPI.getSermonsByIds).toHaveBeenCalledWith([10, 11, 12])
  })

  it('drills into a sermon to show paragraphs', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await waitFor(() => screen.getByText('Church Age Book'))
    await user.click(screen.getByText('Church Age Book'))
    await waitFor(() => screen.getByText('Sermon One'))
    await user.click(screen.getByText('Sermon One'))

    await waitFor(() => expect(screen.getByText('In the beginning')).toBeDefined())
    expect(window.electronAPI.getSermonParagraphs).toHaveBeenCalledWith(10, 'en')
  })

  it('shows + Queue and Project buttons on paragraphs', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
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
    render(<BrowsePanel onAddToQueue={onAddToQueue} onSendToProjection={vi.fn()} />)
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
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={onSendToProjection} />)
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
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await waitFor(() => screen.getByText('Church Age Book'))
    await user.click(screen.getByText('Church Age Book'))
    await waitFor(() => screen.getByText('Sermon One'))

    await user.click(screen.getByRole('button', { name: /← Back/i }))
    await waitFor(() => expect(screen.getByText('Church Age Book')).toBeDefined())
  })

  it('renders empty list when getBrowseSeries returns empty array', async () => {
    window.electronAPI.getBrowseSeries = vi.fn(() => Promise.resolve([]))
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    // No series items — component stays empty without crashing
    await waitFor(() => expect(window.electronAPI.getBrowseSeries).toHaveBeenCalledOnce())
    expect(screen.queryByText('Church Age Book')).toBeNull()
  })

  it('drills into Date group to show sermons', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Date' }))
    await waitFor(() => screen.getByText('1960s'))
    await user.click(screen.getByText('1960s'))
    await waitFor(() => expect(screen.getByText('Sermon One')).toBeDefined())
    expect(window.electronAPI.getSermonsByIds).toHaveBeenCalledWith([30, 31])
  })

  it('drills into Location state to show cities', async () => {
    const user = userEvent.setup()
    render(<BrowsePanel onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Location' }))
    await waitFor(() => screen.getByText('Indiana'))
    await user.click(screen.getByText('Indiana'))
    await waitFor(() => expect(screen.getByText('Jeffersonville')).toBeDefined())
  })
})
