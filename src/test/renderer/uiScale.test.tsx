// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import {
  autoUiScale,
  applyUiZoom,
  currentUiZoom,
  readUiScaleChoice,
  useUiScale
} from '../../renderer/src/uiScale'
import PanelResizer from '../../renderer/src/components/PanelResizer'
import { useContextMenu } from '../../renderer/src/components/ContextMenu'

function setWidth(w: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w })
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<div id="root"></div>'
  document.documentElement.style.removeProperty('--ui-zoom')
})
afterEach(() => {
  vi.useRealTimers()
  setWidth(1024)
})

describe('large-display scaling', () => {
  it('keeps laptops at 100% and steps up for big monitors', () => {
    expect([1280, 1440, 1920, 2199].map(autoUiScale)).toEqual([1, 1, 1, 1])
    expect(autoUiScale(2200)).toBe(1.25)
    expect(autoUiScale(2560)).toBe(1.25)
    expect(autoUiScale(2800)).toBe(1.5)
    expect(autoUiScale(3840)).toBe(1.75)
  })

  it('treats a high OS display scale as already scaled (a 2560 panel at 200% is 1280 css px)', () => {
    expect(autoUiScale(2560 / 2)).toBe(1)
  })

  it('applies the zoom to the app root only, and records it for pointer maths', () => {
    applyUiZoom(1.5)
    expect((document.getElementById('root') as HTMLElement).style.zoom).toBe('1.5')
    expect(currentUiZoom()).toBe(1.5)
    applyUiZoom(1)
    expect((document.getElementById('root') as HTMLElement).style.zoom).toBe('')
    expect(currentUiZoom()).toBe(1)
  })

  it('auto follows the window width, and a chosen size wins and is remembered', () => {
    setWidth(2560)
    const { result } = renderHook(() => useUiScale())
    expect(result.current.factor).toBe(1.25)
    expect((document.getElementById('root') as HTMLElement).style.zoom).toBe('1.25')
    act(() => result.current.setChoice(1))
    expect(result.current.factor).toBe(1)
    expect(localStorage.getItem('born.uiScale')).toBe('1')
    expect(readUiScaleChoice()).toBe(1)
  })

  it('re-evaluates when the window is resized or moved to another monitor', () => {
    vi.useFakeTimers()
    setWidth(1440)
    const { result } = renderHook(() => useUiScale())
    expect(result.current.factor).toBe(1)
    setWidth(3840)
    act(() => {
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(200)
    })
    expect(result.current.factor).toBe(1.75)
  })

  it('ignores a stored value that is not one of the offered sizes', () => {
    localStorage.setItem('born.uiScale', '3.7')
    expect(readUiScaleChoice()).toBe('auto')
  })

  it('never touches anything outside its own document (the projection is another window)', () => {
    // The module has no access to other windows; this asserts the API surface
    // is document-local: no electronAPI zoom calls are made.
    const spy = vi.fn()
    ;(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = { setUiZoom: spy }
    setWidth(3840)
    renderHook(() => useUiScale())
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('pointer maths under zoom', () => {
  it('PanelResizer converts screen-pixel drags into CSS pixels', () => {
    applyUiZoom(1.25)
    const onChange = vi.fn()
    render(<PanelResizer label="r" width={360} min={280} max={560} defaultWidth={360} onChange={onChange} />)
    const h = screen.getByRole('separator')
    h.setPointerCapture = vi.fn()
    h.releasePointerCapture = vi.fn()
    fireEvent.pointerDown(h, { clientX: 1000, button: 0, pointerId: 1 })
    fireEvent.pointerMove(h, { clientX: 900, pointerId: 1 }) // 100 screen px left
    expect(onChange).toHaveBeenLastCalledWith(360 + 80) // 100 / 1.25
  })

  it('a context menu opens at the pointer when the interface is zoomed', () => {
    applyUiZoom(1.5)
    function H(): JSX.Element {
      const ctx = useContextMenu()
      return (
        <div>
          <div data-testid="t" {...ctx.bind([{ id: 'a', label: 'A', onSelect: vi.fn() }])}>
            row
          </div>
          {ctx.element}
        </div>
      )
    }
    const root = document.getElementById('root') as HTMLElement
    render(<H />, { container: root })
    fireEvent.contextMenu(screen.getByTestId('t'), { clientX: 300, clientY: 150 })
    const menu = screen.getByRole('menu') as HTMLElement
    // CSS left/top are multiplied by the zoom when painted: 300/1.5 css px → 300 screen px.
    expect(parseFloat(menu.style.left)).toBeCloseTo(300 / 1.5, 0)
    expect(parseFloat(menu.style.top)).toBeCloseTo(150 / 1.5, 0)
  })
})
