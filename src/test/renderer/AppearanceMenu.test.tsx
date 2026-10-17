// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppearanceMenu from '../../renderer/src/components/AppearanceMenu'

afterEach(cleanup)
const props = () => ({ theme: 'dark' as const, onTheme: vi.fn(), contrast: false, onContrast: vi.fn(), uiScale: 'auto' as const, onUiScale: vi.fn(), clickShows: false, onClickShows: vi.fn(), onHelp: vi.fn(), onShortcuts: vi.fn() })

describe('the ⚙ menu: appearance, interface size, Help (P-01 / P-11)', () => {
  it('is one button with a name, closed until pressed', () => {
    render(<AppearanceMenu {...props()} />)
    const b = screen.getByRole('button', { name: 'Settings and help' })
    expect(b.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('sets the theme, contrast and interface size, and says which is on', async () => {
    const p = props()
    const user = userEvent.setup()
    render(<AppearanceMenu {...p} theme="light" contrast />)
    await user.click(screen.getByRole('button', { name: 'Settings and help' }))
    expect(screen.getByRole('dialog', { name: 'Appearance and help' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'High' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Dark' }))
    expect(p.onTheme).toHaveBeenCalledWith('dark')
    await user.click(screen.getByRole('button', { name: 'Normal' }))
    expect(p.onContrast).toHaveBeenCalledWith(false)
    await user.selectOptions(screen.getByLabelText('Interface size'), '1.5')
    expect(p.onUiScale).toHaveBeenCalledWith(1.5)
    await user.selectOptions(screen.getByLabelText('Interface size'), 'auto')
    expect(p.onUiScale).toHaveBeenCalledWith('auto')
  })
  it('offers every interface size the app has, with Automatic first', async () => {
    const user = userEvent.setup()
    render(<AppearanceMenu {...props()} />)
    await user.click(screen.getByRole('button', { name: 'Settings and help' }))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Automatic for this screen', '100 %', '125 %', '150 %', '175 %'])
  })
  it('opens the manual and the shortcuts, and closes itself', async () => {
    const p = props()
    const user = userEvent.setup()
    render(<AppearanceMenu {...p} />)
    await user.click(screen.getByRole('button', { name: 'Settings and help' }))
    await user.click(screen.getByRole('button', { name: /Open the manual/ }))
    expect(p.onHelp).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Settings and help' }))
    await user.click(screen.getByRole('button', { name: /Keyboard shortcuts/ }))
    expect(p.onShortcuts).toHaveBeenCalledOnce()
  })
  it('Esc closes it and gives the focus back to the button', async () => {
    const user = userEvent.setup()
    render(<AppearanceMenu {...props()} />)
    const b = screen.getByRole('button', { name: 'Settings and help' })
    await user.click(b)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(b)
  })
  it('has the "A single click shows it" setting for people who want how earlier versions worked', async () => {
    const p = props()
    const user = userEvent.setup()
    render(<AppearanceMenu {...p} />)
    await user.click(screen.getByRole('button', { name: 'Settings and help' }))
    const box = screen.getByRole('checkbox', { name: /A single click shows it/ }) as HTMLInputElement
    expect(box.checked).toBe(false)
    await user.click(box)
    expect(p.onClickShows).toHaveBeenCalledWith(true)
  })
})
