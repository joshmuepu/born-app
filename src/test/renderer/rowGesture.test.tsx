// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { rowGesture, readClickShows, setClickShows, useClickShows } from '../../renderer/src/rowGesture'

beforeEach(() => { try { localStorage.removeItem('born.clickShows') } catch { /* */ } })
afterEach(cleanup)

function Row({ clickShows, show, select }: { clickShows: boolean; show: () => void; select: () => void }): JSX.Element {
  return <div role="button" tabIndex={0} {...rowGesture({ clickShows, show, select })}>row</div>
}

describe('row gesture: click selects, Enter or double-click shows (P-08)', () => {
  it('a single click only selects', () => {
    const show = vi.fn(), select = vi.fn()
    render(<Row clickShows={false} show={show} select={select} />)
    fireEvent.click(screen.getByRole('button'))
    expect(select).toHaveBeenCalledOnce()
    expect(show).not.toHaveBeenCalled()
  })
  it('a double-click shows it (after the click that selected it)', () => {
    const show = vi.fn(), select = vi.fn()
    render(<Row clickShows={false} show={show} select={select} />)
    const r = screen.getByRole('button')
    fireEvent.click(r); fireEvent.click(r); fireEvent.doubleClick(r)
    expect(show).toHaveBeenCalledOnce()
  })
  it('Enter and Space show it', () => {
    const show = vi.fn()
    render(<Row clickShows={false} show={show} select={vi.fn()} />)
    const r = screen.getByRole('button')
    fireEvent.keyDown(r, { key: 'Enter' }); fireEvent.keyDown(r, { key: ' ' })
    expect(show).toHaveBeenCalledTimes(2)
  })
  it('other keys do nothing', () => {
    const show = vi.fn()
    render(<Row clickShows={false} show={show} select={vi.fn()} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'a' })
    expect(show).not.toHaveBeenCalled()
  })
  it('with "A single click shows it" on, a click shows and a double-click does not show twice', () => {
    const show = vi.fn(), select = vi.fn()
    render(<Row clickShows show={show} select={select} />)
    const r = screen.getByRole('button')
    fireEvent.click(r)
    fireEvent.doubleClick(r)
    expect(show).toHaveBeenCalledOnce()
    expect(select).not.toHaveBeenCalled()
  })
  it('a key press on a button INSIDE the row does not show the row', () => {
    const show = vi.fn()
    render(<div role="button" tabIndex={0} {...rowGesture({ clickShows: false, show, select: vi.fn() })}><button>Queue</button></div>)
    fireEvent.keyDown(screen.getAllByRole('button')[1], { key: 'Enter' })
    expect(show).not.toHaveBeenCalled()
  })
})

describe('the setting', () => {
  it('is off by default, remembered, and every row in the window hears about it', () => {
    expect(readClickShows()).toBe(false)
    function Probe(): JSX.Element { return <span>{useClickShows() ? 'on' : 'off'}</span> }
    render(<Probe />)
    expect(screen.getByText('off')).toBeTruthy()
    act(() => setClickShows(true))
    expect(screen.getByText('on')).toBeTruthy()
    expect(readClickShows()).toBe(true)
    act(() => setClickShows(false))
    expect(screen.getByText('off')).toBeTruthy()
  })
})
