// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SongKeyPicker from '../../renderer/src/components/SongKeyPicker'

describe('SongKeyPicker', () => {
  it('Esc closes the open picker and puts focus back on the key button', async () => {
    ;(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI.getRecentKeys = vi.fn(() => Promise.resolve([]))
    render(<SongKeyPicker songKey="G" onChange={() => {}} />)
    const btn = screen.getByRole('button', { name: /key of g/i })
    await act(async () => { fireEvent.click(btn) })
    expect(document.querySelector('.song-key-popover')).not.toBeNull()
    await act(async () => { fireEvent.keyDown(document.body, { key: 'Escape' }) })
    expect(document.querySelector('.song-key-popover')).toBeNull()
    expect(document.activeElement).toBe(btn)
  })
})
