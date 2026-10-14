// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SongImportReview, { type SongImportReviewRow } from '../../renderer/src/components/SongImportReview'

const newRow: SongImportReviewRow = {
  groupId: 'g1',
  title: 'A Brand New Song',
  author: 'Some Leader',
  preview: 'Verse one of a song not yet in the library',
  kind: 'new'
}

const conflictRow: SongImportReviewRow = {
  groupId: 'g2',
  title: 'Amazing Grace',
  preview: 'Our own rewritten version of this song',
  kind: 'conflict',
  existingTitle: 'Amazing Grace'
}

describe('SongImportReview', () => {
  it('defaults every new song to checked and every conflict to "add as a separate song"', () => {
    const onResolve = vi.fn()
    render(<SongImportReview rows={[newRow, conflictRow]} onResolve={onResolve} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByLabelText('Add as a separate song')).toBeChecked()
    expect(screen.getByLabelText('Use my existing version')).not.toBeChecked()
    expect(screen.getByText('Add all 2 songs and import')).toBeInTheDocument()
  })

  it('unchecking a new song updates the primary button\'s own label to match', () => {
    render(<SongImportReview rows={[newRow]} onResolve={vi.fn()} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText('Add 0 songs and import')).toBeInTheDocument()
  })

  it('choosing "Use my existing version" for a conflict is reflected in the proceed decision', () => {
    const onResolve = vi.fn()
    render(<SongImportReview rows={[conflictRow]} onResolve={onResolve} />)
    fireEvent.click(screen.getByLabelText('Use my existing version'))
    fireEvent.click(screen.getByText(/Import without adding/))
    // "Import without adding" is also reachable as the dedicated secondary
    // button when nothing is selected — assert via the actual onResolve call.
    expect(onResolve).toHaveBeenCalledWith({ action: 'import-without-adding' })
  })

  it('never defaults a conflict to "use existing" — only an explicit choice can do that', () => {
    const onResolve = vi.fn()
    render(<SongImportReview rows={[conflictRow]} onResolve={onResolve} />)
    fireEvent.click(screen.getByText('Add this song and import'))
    expect(onResolve).toHaveBeenCalledWith({
      action: 'proceed',
      decisions: new Map([['g2', 'add']])
    })
  })

  it('Cancel resolves with action "cancel", not a partial import', () => {
    const onResolve = vi.fn()
    render(<SongImportReview rows={[newRow]} onResolve={onResolve} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onResolve).toHaveBeenCalledWith({ action: 'cancel' })
  })

  it('Esc cancels, matching every other dialog in the app', () => {
    const onResolve = vi.fn()
    render(<SongImportReview rows={[newRow]} onResolve={onResolve} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onResolve).toHaveBeenCalledWith({ action: 'cancel' })
  })

  it('clicking outside the dialog (the overlay) also cancels', () => {
    const onResolve = vi.fn()
    const { container } = render(<SongImportReview rows={[newRow]} onResolve={onResolve} />)
    fireEvent.click(container.querySelector('.modal-overlay')!)
    expect(onResolve).toHaveBeenCalledWith({ action: 'cancel' })
  })

  it('the primary button disables, rather than duplicating the secondary one\'s label, when nothing is selected', () => {
    render(<SongImportReview rows={[newRow]} onResolve={vi.fn()} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText('Add 0 songs and import')).toBeDisabled()
    expect(screen.getByText('Import without adding')).not.toBeDisabled()
  })

  it('shows the real existing title in the conflict note', () => {
    render(<SongImportReview rows={[conflictRow]} onResolve={vi.fn()} />)
    expect(screen.getByText(/Already in your library as.*Amazing Grace.*different lyrics/)).toBeInTheDocument()
  })
})
