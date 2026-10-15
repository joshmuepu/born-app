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
