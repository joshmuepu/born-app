// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBar from '../../renderer/src/components/SearchBar'

// window.electronAPI is mocked in src/test/setup.ts

beforeEach(() => {
  vi.clearAllMocks()
  // Default: searchSermons returns empty array
  window.electronAPI.searchSermons = vi.fn(() => Promise.resolve([]))
  window.electronAPI.getAutocompleteSuggestions = vi.fn(() => Promise.resolve([]))
  window.electronAPI.getHitsCountPreview = vi.fn(() => Promise.resolve(0))
})

describe('SearchBar', () => {
  it('renders the search input and Search button', () => {
    render(<SearchBar onResults={vi.fn()} />)
    expect(screen.getByPlaceholderText(/Search sermons/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /search/i })).toBeDefined()
  })

  it('Search button is disabled when input is empty', () => {
    render(<SearchBar onResults={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /search/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Search button enables after typing', async () => {
    const user = userEvent.setup()
    render(<SearchBar onResults={vi.fn()} />)
    await user.type(screen.getByPlaceholderText(/Search sermons/i), 'faith')
    const btn = screen.getByRole('button', { name: /search/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('calls searchSermons and onResults when Search button clicked', async () => {
    const mockResults = [
      {
        text: 'By faith Abraham obeyed',
        sermonTitle: 'Come Follow Me',
        dateCode: '63-0901M',
        sermonId: 1,
        paragraphIndex: 1,
        paragraphRef: 'p1'
      }
    ]
    window.electronAPI.searchSermons = vi.fn(() => Promise.resolve(mockResults))
    const onResults = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar onResults={onResults} />)

    await user.type(screen.getByPlaceholderText(/Search sermons/i), 'faith')
    await user.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => expect(onResults).toHaveBeenCalledWith(mockResults))
  })

  it('calls searchSermons on Enter key press', async () => {
    const onResults = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar onResults={onResults} />)

    await user.type(screen.getByPlaceholderText(/Search sermons/i), 'grace{Enter}')

    await waitFor(() => expect(window.electronAPI.searchSermons).toHaveBeenCalledWith('grace', expect.any(Object)))
  })

  it('shows Filters panel when Filters button is clicked', async () => {
    const user = userEvent.setup()
    render(<SearchBar onResults={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /filters/i }))
    expect(screen.getByPlaceholderText(/From/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/To/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/Filter by sermon title/i)).toBeDefined()
  })

  it('passes filter values to searchSermons', async () => {
    const user = userEvent.setup()
    render(<SearchBar onResults={vi.fn()} />)

    await user.type(screen.getByPlaceholderText(/Search sermons/i), 'holy')
    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.type(screen.getByPlaceholderText(/From/i), '1960')
    await user.type(screen.getByPlaceholderText(/To/i), '1965')
    await user.type(screen.getByPlaceholderText(/Filter by sermon title/i), 'Spirit')
    await user.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() =>
      expect(window.electronAPI.searchSermons).toHaveBeenCalledWith('holy', {
        yearFrom: '1960',
        yearTo: '1965',
        titleFilter: 'Spirit',
        forceTokens: false
      })
    )
  })

  it('switches to All words mode', async () => {
    const user = userEvent.setup()
    render(<SearchBar onResults={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('button', { name: /all words/i }))
    await user.type(screen.getByPlaceholderText(/Search sermons/i), 'faith hope')
    await user.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() =>
      expect(window.electronAPI.searchSermons).toHaveBeenCalledWith('faith hope', expect.objectContaining({
        forceTokens: true
      }))
    )
  })

  it('shows autocomplete suggestions after typing 2+ chars', async () => {
    window.electronAPI.getAutocompleteSuggestions = vi.fn(() =>
      Promise.resolve(['faith', 'faithful', 'faithfully'])
    )

    render(<SearchBar onResults={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/Search sermons/i), { target: { value: 'fa' } })

    // Wait for 300ms debounce + promise resolution
    await waitFor(() => expect(screen.queryByText('faith')).not.toBeNull(), { timeout: 2000 })
  })

  it('does not show suggestions for single character', async () => {
    render(<SearchBar onResults={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/Search sermons/i), { target: { value: 'f' } })

    // Wait longer than the 300ms debounce to ensure it didn't fire
    await new Promise((r) => setTimeout(r, 500))
    expect(window.electronAPI.getAutocompleteSuggestions).not.toHaveBeenCalled()
  })

  it('handles getAutocompleteSuggestions error gracefully (no crash)', async () => {
    window.electronAPI.getAutocompleteSuggestions = vi.fn(() => Promise.reject(new Error('IPC error')))

    render(<SearchBar onResults={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/Search sermons/i), { target: { value: 'ho' } })

    // Wait for debounce + promise rejection to settle
    await new Promise((r) => setTimeout(r, 500))

    // Should not crash — input still present
    expect(screen.getByPlaceholderText(/Search sermons/i)).toBeDefined()
  })

  it('handles getHitsCountPreview error gracefully (no crash)', async () => {
    window.electronAPI.getHitsCountPreview = vi.fn(() => Promise.reject(new Error('IPC error')))

    render(<SearchBar onResults={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/Search sermons/i), { target: { value: 'ho' } })

    await new Promise((r) => setTimeout(r, 600))

    expect(screen.getByPlaceholderText(/Search sermons/i)).toBeDefined()
  })

  it('applies suggestion on click', async () => {
    window.electronAPI.getAutocompleteSuggestions = vi.fn(() =>
      Promise.resolve(['faithful'])
    )

    render(<SearchBar onResults={vi.fn()} />)
    const input = screen.getByPlaceholderText(/Search sermons/i) as HTMLInputElement

    fireEvent.change(input, { target: { value: 'fa' } })

    await waitFor(() => expect(screen.queryByText('faithful')).not.toBeNull(), { timeout: 2000 })

    fireEvent.mouseDown(screen.getByText('faithful'))

    await waitFor(() => expect(input.value).toContain('faithful'))
  })

  it('navigates suggestions with arrow keys', async () => {
    window.electronAPI.getAutocompleteSuggestions = vi.fn(() =>
      Promise.resolve(['faith', 'faithful'])
    )

    render(<SearchBar onResults={vi.fn()} />)
    const input = screen.getByPlaceholderText(/Search sermons/i)

    fireEvent.change(input, { target: { value: 'fa' } })

    await waitFor(() => expect(screen.queryByText('faith')).not.toBeNull(), { timeout: 2000 })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const items = screen.getAllByText(/faith/)
    expect(items.length).toBeGreaterThan(0)
  })

  it('closes suggestions on Escape', async () => {
    window.electronAPI.getAutocompleteSuggestions = vi.fn(() =>
      Promise.resolve(['faith', 'faithful'])
    )

    render(<SearchBar onResults={vi.fn()} />)
    const input = screen.getByPlaceholderText(/Search sermons/i)

    fireEvent.change(input, { target: { value: 'fa' } })

    await waitFor(() => expect(screen.queryByText('faith')).not.toBeNull(), { timeout: 2000 })
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByText('faith')).toBeNull())

    vi.useRealTimers()
  })
})
