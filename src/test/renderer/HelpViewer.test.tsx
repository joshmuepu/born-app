// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HelpViewer from '../../renderer/src/components/HelpViewer'

// window.electronAPI is mocked in src/test/setup.ts

const manifest = {
  version: 'v2',
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
