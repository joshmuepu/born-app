// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ResultsList from '../../renderer/src/components/ResultsList'
import type { Quote } from '../../renderer/src/types'

const quote: Quote = {
  text: '26 Now, we want to speak now upon faith',
  sermonTitle: 'Perfect Faith',
  dateCode: '63-0825E',
  sermonId: 1,
  paragraphIndex: 0,
  paragraphRef: '26'
} as Quote

const noop = (): void => {}

describe('ResultsList — queue button label', () => {
  it('reads "+ Queue", matching every other panel\'s add-to-queue button', () => {
    render(
      <ResultsList
        results={[quote]}
        searched
        onAddToQueue={noop}
        onSendToProjection={noop}
        onOpenSermon={noop}
        onQuickSearch={noop}
        onJumpToSermon={noop}
      />
    )
    expect(screen.getByText('+ Queue')).toBeInTheDocument()
    expect(screen.queryByText('Add to Queue')).not.toBeInTheDocument()
  })

  it('still calls onAddToQueue with the right quote when clicked', () => {
    const onAddToQueue = vi.fn()
    render(
      <ResultsList
        results={[quote]}
        searched
        onAddToQueue={onAddToQueue}
        onSendToProjection={noop}
        onOpenSermon={noop}
        onQuickSearch={noop}
        onJumpToSermon={noop}
      />
    )
    fireEvent.click(screen.getByText('+ Queue'))
    expect(onAddToQueue).toHaveBeenCalledWith(quote)
  })
})
