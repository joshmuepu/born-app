// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HelpViewer from '../../renderer/src/components/HelpViewer'

// window.electronAPI is mocked in src/test/setup.ts

const manifest = {
  version: 'v1',
  sections: [
    {
      id: 'start',
      title: 'Start Here',
      pages: [{ id: 'start-here', title: 'What BORN is', file: 'start-here.md' }]
    }
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom doesn't implement Element.scrollTo — HelpViewer calls it on every
  // successful page render (contentRef.current?.scrollTo(0, 0)) to reset
  // scroll position, which otherwise throws and gets mistaken for a failed
  // page load by the .then()/.catch() chain around it.
  Element.prototype.scrollTo = vi.fn()
})

describe('HelpViewer failure handling', () => {
  it('shows a plain-language error with a Retry button when the manifest request fails, instead of spinning forever', async () => {
    window.electronAPI.getManualManifest = vi.fn(() => Promise.reject(new Error('IPC error')))

    render(<HelpViewer onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/Help couldn.t load/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('recovers after Retry once the manifest request succeeds', async () => {
    const getManifest = vi
      .fn()
      .mockRejectedValueOnce(new Error('IPC error'))
      .mockResolvedValueOnce(manifest)
    window.electronAPI.getManualManifest = getManifest
    window.electronAPI.getManualPage = vi.fn(() => Promise.resolve('# What BORN is\n\nHello.'))

    render(<HelpViewer onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText(/Help couldn.t load/)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'What BORN is' })).toBeInTheDocument())
    expect(getManifest).toHaveBeenCalledTimes(2)
  })

  it('shows the same error state for a single page that fails to load, without breaking the rest of the viewer', async () => {
    window.electronAPI.getManualManifest = vi.fn(() => Promise.resolve(manifest))
    window.electronAPI.getManualPage = vi.fn(() => Promise.reject(new Error('page IPC error')))

    render(<HelpViewer onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/Help couldn.t load/)).toBeInTheDocument())
    // A single page failing is not the same as the whole manual being
    // unavailable — the sidebar (and the page that failed) stay navigable.
    expect(screen.getByRole('button', { name: 'What BORN is' })).toBeInTheDocument()
  })

  it('recovers a failed page after Retry', async () => {
    window.electronAPI.getManualManifest = vi.fn(() => Promise.resolve(manifest))
    const getPage = vi
      .fn()
      .mockRejectedValueOnce(new Error('page IPC error'))
      .mockResolvedValueOnce('# What BORN is\n\nHello there.')
    window.electronAPI.getManualPage = getPage

    render(<HelpViewer onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText(/Help couldn.t load/)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.getByText('Hello there.')).toBeInTheDocument())
    expect(getPage).toHaveBeenCalledTimes(2)
  })

  it('treats a page that resolves to null the same as a request failure, not a silent dead end', async () => {
    window.electronAPI.getManualManifest = vi.fn(() => Promise.resolve(manifest))
    window.electronAPI.getManualPage = vi.fn(() => Promise.resolve(null))

    render(<HelpViewer onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/Help couldn.t load/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})

describe('HelpViewer navigation', () => {
  it('renders every section heading and page from the manifest, and switches pages on click', async () => {
    const twoPageManifest = {
      version: 'v1',
      sections: [
        {
          id: 'start',
          title: 'Start Here',
          pages: [
            { id: 'start-here', title: 'What BORN is', file: 'start-here.md' },
            { id: 'quick-start', title: 'Quick start', file: 'operators/quick-start.md' }
          ]
        }
      ]
    }
    window.electronAPI.getManualManifest = vi.fn(() => Promise.resolve(twoPageManifest))
    const getPage = vi.fn((file: string) =>
      Promise.resolve(file === 'start-here.md' ? '# What BORN is\n\nFirst page.' : '# Quick start\n\nSecond page.')
    )
    window.electronAPI.getManualPage = getPage

    render(<HelpViewer onClose={vi.fn()} />)

    expect(await screen.findByText('Start Here')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('First page.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Quick start' }))

    await waitFor(() => expect(screen.getByText('Second page.')).toBeInTheDocument())
    expect(getPage).toHaveBeenCalledWith('operators/quick-start.md')
  })
})

describe('HelpViewer closing', () => {
  it('calls onClose when Esc is pressed', async () => {
    window.electronAPI.getManualManifest = vi.fn(() => Promise.resolve(manifest))
    window.electronAPI.getManualPage = vi.fn(() => Promise.resolve('# What BORN is\n\nHello.'))
    const onClose = vi.fn()

    render(<HelpViewer onClose={onClose} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'What BORN is' })).toBeInTheDocument())

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the X button is clicked', async () => {
    window.electronAPI.getManualManifest = vi.fn(() => Promise.resolve(manifest))
    window.electronAPI.getManualPage = vi.fn(() => Promise.resolve('# What BORN is\n\nHello.'))
    const onClose = vi.fn()

    render(<HelpViewer onClose={onClose} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'What BORN is' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
