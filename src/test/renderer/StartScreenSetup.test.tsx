// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StartScreen, { type SetupSunday } from '../../renderer/src/components/StartScreen'

afterEach(cleanup)
const setup = (over: Partial<SetupSunday> = {}): SetupSunday => ({ projectionOpen: false, screensChosen: false, onScreens: vi.fn(), onTemplate: vi.fn(), onGo: vi.fn(), onDismiss: vi.fn(), ...over })
const base = { recents: [], onOpen: vi.fn(), onOpenRecent: vi.fn() }

describe('the first-run "Set up Sunday" checklist (P-12)', () => {
  it('is the start screen of a new profile: three steps and the three plans', () => {
    render(<StartScreen {...base} setup={setup()} />)
    expect(screen.getByRole('heading', { name: 'Set up Sunday' })).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('button', { name: /Sunday morning/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Midweek/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Funeral or memorial/ })).toBeTruthy()
  })
  it('each step does the real thing', async () => {
    const s = setup()
    const user = userEvent.setup()
    render(<StartScreen {...base} setup={s} />)
    await user.click(screen.getByRole('button', { name: 'Open the Screens menu' }))
    expect(s.onScreens).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: /Sunday morning/ }))
    expect(s.onTemplate).toHaveBeenCalledWith('sunday')
    await user.click(screen.getByRole('button', { name: 'Songs' }))
    await user.click(screen.getByRole('button', { name: 'Bible' }))
    await user.click(screen.getByRole('button', { name: 'Sermons' }))
    expect(s.onGo.mock.calls.map((c) => c[0])).toEqual(['songs', 'bible', 'sermons'])
    await user.click(screen.getByRole('button', { name: 'Hide this checklist' }))
    expect(s.onDismiss).toHaveBeenCalledOnce()
  })
  it('ticks the screens step once the screens are chosen', () => {
    const { container } = render(<StartScreen {...base} setup={setup({ screensChosen: true })} />)
    expect(container.querySelector('li.is-done')).toBeTruthy()
  })
  it('without the checklist it is the plain start screen, unchanged', () => {
    render(<StartScreen {...base} setup={null} />)
    expect(screen.getByRole('heading', { name: 'New service' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Hide this checklist' })).toBeNull()
    expect(screen.getByRole('button', { name: /Open a saved service/ })).toBeTruthy()
  })
})
