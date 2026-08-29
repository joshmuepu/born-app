// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBar from '../../renderer/src/components/SearchBar'

// window.electronAPI is mocked in src/test/setup.ts

const PLACEHOLDER = /Search for a word or phrase/i

beforeEach(() => {
  vi.clearAllMocks()
  window.electronAPI.searchSermons = vi.fn(() => Promise.resolve([]))
  window.electronAPI.getAutocompleteSuggestions = vi.fn(() => Promise.resolve([]))
})

describe('SearchBar', () => {
  it('renders the search input and Search button', () => {
    render(<SearchBar onResults={vi.fn()} />)
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDefined()
    expect(screen.getByRole('button', { name: /^search$/i })).toBeDefined()
  })

  it('Search button is disabled when input is empty', () => {
    render(<SearchBar onResults={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /^search$/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Search button enables after typing', async () => {
    const user = userEvent.setup()
    render(<SearchBar onResults={vi.fn()} />)
    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'faith')
    const btn = screen.getByRole('button', { name: /^search$/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('calls searchSermons and onResults with the query when Search is clicked', async () => {
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

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'faith')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() => expect(onResults).toHaveBeenCalledWith(mockResults, 'faith'))
  })

  it('calls searchSermons on Enter key press', async () => {
    const onResults = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar onResults={onResults} />)

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'grace{Enter}')

    await waitFor(() =>
      expect(window.electronAPI.searchSermons).toHaveBeenCalledWith('grace', expect.any(Object))
    )
  })

  it('reports searching state through onSearchingChange', async () => {
    const onSearchingChange = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar onResults={vi.fn()} onSearchingChange={onSearchingChange} />)

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'grace{Enter}')

    await waitFor(() => expect(onSearchingChange).toHaveBeenCalledWith(true))
    await waitFor(() => expect(onSearchingChange).toHaveBeenCalledWith(false))
  })

  it('shows the Filters panel when Filters is clicked', async () => {
    const user = userEvent.setup()
    render(<SearchBar onResults={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /filters/i }))
    expect(screen.getByPlaceholderText(/^From$/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/^To$/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/whose title contains/i)).toBeDefined()
  })

  it('passes filter values to searchSermons', async () => {
    const user = userEvent.setup()
    render(<SearchBar onResults={vi.fn()} />)

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'holy')
    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.type(screen.getByPlaceholderText(/^From$/i), '1960')
    await user.type(screen.getByPlaceholderText(/^To$/i), '1965')
    await user.type(screen.getByPlaceholderText(/whose title contains/i), 'Spirit')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() =>
      expect(window.electronAPI.searchSermons).toHaveBeenCalledWith('holy', {
        yearFrom: '1960',
        yearTo: '1965',
        titleFilter: 'Spirit',
        forceTokens: false
      })
    )
  })

  it('switches to "Any of these words" mode', async () => {
    const user = userEvent.setup()
    render(<SearchBar onResults={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('button', { name: /any of these words/i }))
    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'faith hope')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() =>
      expect(window.electronAPI.searchSermons).toHaveBeenCalledWith(
        'faith hope',
        expect.objectContaining({ forceTokens: true })
      )
    )
  })

  it('shows a Clear filters button once a filter is set', async () => {
    const user = userEvent.setup()
    render(<SearchBar onResults={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /filters/i }))
    expect(screen.queryByRole('button', { name: /clear filters/i })).toBeNull()
    await user.type(screen.getByPlaceholderText(/^From$/i), '1960')
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeDefined()

    await user.click(screen.getByRole('button', { name: /clear filters/i }))
    expect((screen.getByPlaceholderText(/^From$/i) as HTMLInputElement).value).toBe('')
  })

  it('shows autocomplete suggestions after typing 2+ chars', async () => {
    window.electronAPI.getAutocompleteSuggestions = vi.fn(() =>
      Promise.resolve(['faith', 'faithful', 'faithfully'])
    )

    render(<SearchBar onResults={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'fa' } })

    await waitFor(() => expect(screen.queryByText('faith')).not.toBeNull(), { timeout: 2000 })
  })

  it('does not request suggestions for a single character', async () => {
    render(<SearchBar onResults={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'f' } })

    await new Promise((r) => setTimeout(r, 500))
    expect(window.electronAPI.getAutocompleteSuggestions).not.toHaveBeenCalled()
  })

  it('handles a getAutocompleteSuggestions error gracefully (no crash)', async () => {
    window.electronAPI.getAutocompleteSuggestions = vi.fn(() => Promise.reject(new Error('IPC error')))

    render(<SearchBar onResults={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'ho' } })

    await new Promise((r) => setTimeout(r, 500))
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDefined()
  })

  it('applies a suggestion on click', async () => {
    window.electronAPI.getAutocompleteSuggestions = vi.fn(() => Promise.resolve(['faithful']))

    render(<SearchBar onResults={vi.fn()} />)
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement

    fireEvent.change(input, { target: { value: 'fa' } })
    await waitFor(() => expect(screen.queryByText('faithful')).not.toBeNull(), { timeout: 2000 })
    fireEvent.mouseDown(screen.getByText('faithful'))

    await waitFor(() => expect(input.value).toContain('faithful'))
  })

  it('closes suggestions on Escape', async () => {
    window.electronAPI.getAutocompleteSuggestions = vi.fn(() => Promise.resolve(['faith', 'faithful']))

    render(<SearchBar onResults={vi.fn()} />)
    const input = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(input, { target: { value: 'fa' } })
    await waitFor(() => expect(screen.queryByText('faith')).not.toBeNull(), { timeout: 2000 })
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByText('faith')).toBeNull())
  })

  it('only replaces the last word when a suggestion is applied', async () => {
    window.electronAPI.getAutocompleteSuggestions = vi.fn(() => Promise.resolve(['spirit']))
    render(<SearchBar onResults={vi.fn()} />)
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement

    fireEvent.change(input, { target: { value: 'holy spi' } })
    await waitFor(() => expect(screen.queryByText('spirit')).not.toBeNull(), { timeout: 2000 })
    fireEvent.mouseDown(screen.getByText('spirit'))

    await waitFor(() => expect(input.value).toBe('holy spirit '))
  })

  it('ignores a stale suggestion response that resolves after a newer keystroke', async () => {
    let resolveFirst: (v: string[]) => void = () => {}
    window.electronAPI.getAutocompleteSuggestions = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string[]>((r) => (resolveFirst = r)))
      .mockImplementationOnce(() => Promise.resolve(['newer']))

    render(<SearchBar onResults={vi.fn()} />)
    const input = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(input, { target: { value: 'ab' } })
    await new Promise((r) => setTimeout(r, 300))
    fireEvent.change(input, { target: { value: 'abc' } })
    await waitFor(() => expect(screen.queryByText('newer')).not.toBeNull(), { timeout: 2000 })

    resolveFirst(['stale'])
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('stale')).toBeNull()
    expect(screen.queryByText('newer')).not.toBeNull()
  })
})
