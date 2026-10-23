// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import BiblePanel from '../../renderer/src/components/BiblePanel'

const chapter = {
  translation: 'KJV',
  verses: [1, 2, 3].map((v) => ({ verse: v, text: `Placeholder verse ${v}.` })),
  slideStarts: [0, 1, 2],
  slides: []
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  const api = window.electronAPI as unknown as Record<string, unknown>
  api.getBibleTranslations = vi.fn(() => Promise.resolve([{ code: 'KJV', name: 'King James' }]))
  api.getRecentBibleRefs = vi.fn(() => Promise.resolve([]))
  api.lookupPassage = vi.fn(() => Promise.resolve(chapter))
})

describe('BiblePanel — hiding the screen', () => {
  it('keeps the chapter open at the same verse when the projected verse goes away', async () => {
    const props = { visible: true, onAddPassage: vi.fn(), onProjectPassage: vi.fn() }
    const { rerender, container } = render(<BiblePanel {...props} onScreen={{ bookNum: 43, chapter: 3, verse: 2 }} />)
    await waitFor(() => expect(container.querySelector('.bible-verse--live, .bible-verse')).not.toBeNull())
    const rows = (): number => container.querySelectorAll('[class*="verse"]').length
    const before = rows()
    expect(before).toBeGreaterThan(0)
    rerender(<BiblePanel {...props} onScreen={null} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(rows()).toBe(before)
  })
})
