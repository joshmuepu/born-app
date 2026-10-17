// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TapeSettingsPanel from '../../renderer/src/components/TapeSettingsPanel'
import { TAPE_DEFAULTS } from '../../shared/tape'

beforeEach(() => {
  Object.assign(window.electronAPI, { tapeSettingsGet: vi.fn(async () => ({ ...TAPE_DEFAULTS })), tapeSettingsSet: vi.fn(async () => ({})) })
})

describe('Tape options', () => {
  it('opens on the safe defaults and says every option applies to the next tape', async () => {
    render(<TapeSettingsPanel onClose={() => {}} />)
    await screen.findByRole('radiogroup', { name: 'Esc (blank the screens)' })
    expect(screen.getByRole('radio', { name: 'Tape keeps playing' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Tape pauses' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Pause the tape' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Ask me' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(/never to what is on the screen right now/)).toBeTruthy()
  })
  it('choosing an option saves just that option, at once', async () => {
    render(<TapeSettingsPanel onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Also pauses' }))
    await waitFor(() => expect(window.electronAPI.tapeSettingsSet).toHaveBeenCalledWith({ escRule: 'pause' }))
    expect(screen.getByRole('radio', { name: 'Also pauses' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.change(screen.getByLabelText('Show next paragraph early'), { target: { value: '8' } })
    expect(window.electronAPI.tapeSettingsSet).toHaveBeenCalledWith({ leadSec: 8 })
  })
  it('Escape and the Close button close it', async () => {
    const onClose = vi.fn()
    render(<TapeSettingsPanel onClose={onClose} />)
    await screen.findByRole('dialog', { name: 'Tape options' })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
