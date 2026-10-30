// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BrowsePanel from '../../renderer/src/components/BrowsePanel'

// Browse: open sermon A (its paragraphs slow to arrive, e.g. a translation fetched online), go back, open sermon B. When A's answer
// arrived last it replaced B's paragraphs, so A's paragraphs showed under B's title (and + Queue / Project used them).
describe('Browse shows the paragraphs of the sermon that is open', () => {
  it('a slow answer for a sermon no longer open is dropped', async () => {
    window.electronAPI.getBrowseSeries = vi.fn(() => Promise.resolve([{ i: 1, n: 'Placeholder Series', s: [10, 11] }]))
    window.electronAPI.getSermonsByIds = vi.fn(() => Promise.resolve([
      { id: 10, date_code: '99-0101M', title: 'Sermon Alpha', para_count: 1, duration_min: 1, is_book: 0 },
      { id: 11, date_code: '99-0202E', title: 'Sermon Bravo', para_count: 1, duration_min: 1, is_book: 0 }
    ]))
    let releaseAlpha: (v: unknown) => void = () => {}
    window.electronAPI.getSermonParagraphs = vi.fn((id: number) => id === 10
      ? new Promise((r) => { releaseAlpha = r })
      : Promise.resolve([{ text: 'Bravo placeholder paragraph', sermonTitle: 'Sermon Bravo', dateCode: '99-0202E', sermonId: 11, paragraphIndex: 0, paragraphRef: '1' }])) as never
    window.electronAPI.getRecentSermons = vi.fn(() => Promise.resolve([]))
    window.electronAPI.getBrowseDateTree = vi.fn(() => Promise.resolve({ years: [], undatedIds: [] })) as never
    const user = userEvent.setup()
    render(<BrowsePanel visible onAddToQueue={vi.fn()} onSendToProjection={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Series/ }))
    await user.click(await screen.findByText('Placeholder Series'))
    await user.click(await screen.findByText('Sermon Alpha'))
    await user.click(screen.getAllByRole('button', { name: /back/i })[0])
    await user.click(await screen.findByText('Sermon Bravo'))
    await screen.findByText('Bravo placeholder paragraph')
    await act(async () => { releaseAlpha([{ text: 'Alpha placeholder paragraph', sermonTitle: 'Sermon Alpha', dateCode: '99-0101M', sermonId: 10, paragraphIndex: 0, paragraphRef: '1' }]) })
    await waitFor(() => expect(screen.queryByText('Alpha placeholder paragraph')).toBeNull())
    expect(screen.getByText('Bravo placeholder paragraph')).toBeDefined()
  })
})
