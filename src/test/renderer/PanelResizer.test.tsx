// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import PanelResizer from '../../renderer/src/components/PanelResizer'

function Harness({ start = 360, onCommit = vi.fn() }: { start?: number; onCommit?: (n: number) => void }): JSX.Element {
  const [w, setW] = useState(start)
  return (
    <div>
      <span data-testid="w">{w}</span>
      <PanelResizer label="Resize the queue" width={w} min={280} max={560} defaultWidth={360} onChange={setW} onCommit={onCommit} />
    </div>
  )
}
const handle = (): HTMLElement => screen.getByRole('separator', { name: 'Resize the queue' })
const width = (): number => Number(screen.getByTestId('w').textContent)

describe('PanelResizer', () => {
  it('exposes itself as a vertical separator with its limits and value', () => {
    render(<Harness />)
    expect(handle().getAttribute('aria-orientation')).toBe('vertical')
    expect(handle().getAttribute('aria-valuemin')).toBe('280')
    expect(handle().getAttribute('aria-valuemax')).toBe('560')
    expect(handle().getAttribute('aria-valuenow')).toBe('360')
    expect(handle().tabIndex).toBe(0)
  })

  it('resizes with the arrow keys (left grows a right-hand panel), Shift for big steps', () => {
    const onCommit = vi.fn()
    render(<Harness onCommit={onCommit} />)
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' })
    expect(width()).toBe(376)
    fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    expect(width()).toBe(344)
    fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true })
    expect(width()).toBe(408)
    expect(onCommit).toHaveBeenLastCalledWith(408)
  })

  it('never goes past its limits', () => {
    render(<Harness start={290} />)
    fireEvent.keyDown(handle(), { key: 'ArrowRight', shiftKey: true })
    expect(width()).toBe(280)
    fireEvent.keyDown(handle(), { key: 'End' })
    expect(width()).toBe(560)
    fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true })
    expect(width()).toBe(560)
    fireEvent.keyDown(handle(), { key: 'Home' })
    expect(width()).toBe(280)
  })

  it('resets to the default on Enter and on double-click', () => {
    render(<Harness start={500} />)
    fireEvent.keyDown(handle(), { key: 'Enter' })
    expect(width()).toBe(360)
    fireEvent.keyDown(handle(), { key: 'End' })
    fireEvent.doubleClick(handle())
    expect(width()).toBe(360)
  })

  it('drags with the pointer and commits once on release', () => {
    const onCommit = vi.fn()
    render(<Harness onCommit={onCommit} />)
    const h = handle()
    h.setPointerCapture = vi.fn()
    h.releasePointerCapture = vi.fn()
    fireEvent.pointerDown(h, { clientX: 1000, button: 0, pointerId: 1 })
    fireEvent.pointerMove(h, { clientX: 940, pointerId: 1 }) // dragged 60px left → 60px wider
    expect(width()).toBe(420)
    fireEvent.pointerMove(h, { clientX: 100, pointerId: 1 }) // far past the limit
    expect(width()).toBe(560)
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.pointerUp(h, { pointerId: 1 })
    expect(onCommit).toHaveBeenCalledOnce()
    expect(onCommit).toHaveBeenCalledWith(560)
    // moving after release does nothing
    fireEvent.pointerMove(h, { clientX: 1100, pointerId: 1 })
    expect(width()).toBe(560)
  })

  it('does not leak resize keys to the operator shortcuts', () => {
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    render(<Harness />)
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' })
    expect(onWindowKey).not.toHaveBeenCalled()
    window.removeEventListener('keydown', onWindowKey)
  })
})
