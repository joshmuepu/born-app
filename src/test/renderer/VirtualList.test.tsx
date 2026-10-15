// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import VirtualList, { type VirtualListHandle } from '../../renderer/src/components/VirtualList'

const many = Array.from({ length: 5000 }, (_, i) => ({ id: i, label: `Row ${i}` }))

describe('VirtualList', () => {
  it('mounts only a window of a very long list', () => {
    render(
      <VirtualList
        items={many}
        estimateSize={50}
        itemKey={(r) => r.id}
        renderItem={(r) => <div className="vrow">{r.label}</div>}
      />
    )
    const mounted = document.querySelectorAll('.vrow').length
    expect(mounted).toBeGreaterThan(0)
    expect(mounted).toBeLessThan(100)
    expect(screen.getByText('Row 0')).toBeDefined()
    expect(screen.queryByText('Row 4999')).toBeNull()
  })

  it('reserves the full scroll height so the scrollbar reflects the whole list', () => {
    const { container } = render(
      <VirtualList items={many} estimateSize={50} renderItem={(r) => <div>{r.label}</div>} />
    )
    const spacer = container.firstElementChild!.firstElementChild as HTMLElement
    expect(parseInt(spacer.style.height, 10)).toBe(5000 * 50)
  })

  it('scrolls to a requested row (focusIndex and the imperative handle)', () => {
    const scrollTo = vi.fn()
    const ref = createRef<VirtualListHandle>()
    const { container } = render(
      <VirtualList
        ref={ref}
        items={many}
        estimateSize={50}
        focusIndex={1200}
        renderItem={(r) => <div>{r.label}</div>}
      />
    )
    const scroller = container.firstElementChild as HTMLElement & { scrollTo: typeof scrollTo }
    scroller.scrollTo = scrollTo
    ref.current!.scrollToIndex(2500, { align: 'start' })
    expect(scrollTo).toHaveBeenCalled()
  })

  it('renders an empty list without error', () => {
    const { container } = render(<VirtualList items={[]} estimateSize={50} renderItem={() => null} />)
    expect(container.firstElementChild).not.toBeNull()
  })

  it('reports the first visible row', () => {
    const onFirstVisible = vi.fn()
    render(
      <VirtualList items={many} estimateSize={50} onFirstVisible={onFirstVisible} renderItem={(r) => <div>{r.label}</div>} />
    )
    expect(onFirstVisible).toHaveBeenCalledWith(0)
  })
})

describe('VirtualList (fully mounted, below the threshold)', () => {
  const rowsOf = (n: number): Array<{ id: number }> => Array.from({ length: n }, (_, i) => ({ id: i }))

  // jsdom has no layout: give each row a 40px height at index*40 so the scroll
  // maths in the component has something to read.
  function layOut(container: HTMLElement, rowH = 40, viewport = 200): void {
    const scroller = container.firstElementChild as HTMLElement
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: viewport })
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 50 * rowH })
    scroller.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => {
      const i = Number(el.dataset.index)
      Object.defineProperty(el, 'offsetTop', { configurable: true, value: i * rowH })
      Object.defineProperty(el, 'offsetHeight', { configurable: true, value: rowH })
    })
  }

  it('mounts every row and scrolls a requested row exactly to the top (align start)', () => {
    const ref = createRef<VirtualListHandle>()
    const { container } = render(
      <VirtualList ref={ref} items={rowsOf(50)} estimateSize={40} threshold={100} renderItem={(r) => <div>row {r.id}</div>} />
    )
    expect(container.querySelectorAll('[data-index]').length).toBe(50)
    layOut(container)
    const scrollTo = vi.fn()
    ;(container.firstElementChild as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo
    ref.current!.scrollToIndex(12, { align: 'start' })
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 12 * 40 }))
  })

  it('centres a row when asked to', () => {
    const ref = createRef<VirtualListHandle>()
    const { container } = render(
      <VirtualList ref={ref} items={rowsOf(50)} estimateSize={40} threshold={100} renderItem={(r) => <div>{r.id}</div>} />
    )
    layOut(container, 40, 200)
    const scrollTo = vi.fn()
    ;(container.firstElementChild as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo
    ref.current!.scrollToIndex(20, { align: 'center' })
    // row top 800, minus (viewport 200 - row 40) / 2 = 80
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 800 - 80 }))
  })

  it('reports the first visible row from the scroll position, and whether it is at the end', async () => {
    const onFirstVisible = vi.fn()
    const { container } = render(
      <VirtualList items={rowsOf(50)} estimateSize={40} threshold={100} onFirstVisible={onFirstVisible} renderItem={(r) => <div>{r.id}</div>} />
    )
    layOut(container)
    const scroller = container.firstElementChild as HTMLElement
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    scroller.scrollTop = 410 // row 10 spans 400-440, so it is the first one still on screen
    scroller.dispatchEvent(new Event('scroll'))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    expect(onFirstVisible).toHaveBeenLastCalledWith(10, false)
    scroller.scrollTop = 50 * 40 - 200 // the very end
    scroller.dispatchEvent(new Event('scroll'))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    expect(onFirstVisible).toHaveBeenLastCalledWith(45, true)
  })
})
