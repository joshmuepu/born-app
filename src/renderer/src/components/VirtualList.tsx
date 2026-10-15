import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react'
import { observeElementRect, useVirtualizer } from '@tanstack/react-virtual'

/** The window height used when the scroller reports 0 (no layout yet — first
 *  paint, hidden panel, or a test DOM). Large enough that the first screenful
 *  always renders instead of an empty list. */
const FALLBACK_HEIGHT = 900

export interface VirtualListHandle {
  scrollToIndex: (index: number, opts?: { align?: 'start' | 'center' | 'end'; smooth?: boolean }) => void
  scrollToTop: () => void
}

interface Props<T> {
  items: T[]
  /** Only window the list once it has at least this many rows. Below it every
   *  row is mounted and the browser scrolls natively — measured to be
   *  smoother than windowing on slow CPUs, so windowing is reserved for lists
   *  long enough that mounting them all is the bigger cost. */
  threshold?: number
  /** A fair guess at a row's height; real heights are measured as rows mount. */
  estimateSize: number
  /** Space between rows. */
  gap?: number
  overscan?: number
  /** Class on the scroll container (it is the element that scrolls). */
  className?: string
  /** Stable identity per row, so selection/measurement survives re-renders. */
  itemKey?: (item: T, index: number) => string | number
  renderItem: (item: T, index: number) => ReactNode
  /** Keep this row in view: scrolls when it (or the item set) changes. */
  focusIndex?: number | null
  /** Animate focus scrolls after the first jump (the first lands instantly). */
  smoothFocus?: boolean
  paddingStart?: number
  paddingEnd?: number
  /** Called with the first visible row's index whenever it changes (and, for
   *  a fully-mounted list, whether the scroller is at its very end). */
  onFirstVisible?: (index: number, atEnd?: boolean) => void
  /** Extra attributes for the scroller (role, aria-label, data-*). */
  scrollerProps?: React.HTMLAttributes<HTMLDivElement>
}

/**
 * A windowed list: only the rows near the viewport are in the DOM, so a
 * 25,000-hit search, a 1,000-song library or a very long sermon paints in a
 * fraction of the time and memory. Rows keep their natural height (measured),
 * so cards of different lengths just work.
 */
function VirtualListInner<T>(
  {
    items,
    estimateSize,
    gap = 0,
    overscan = 8,
    threshold = 0,
    className,
    itemKey,
    renderItem,
    focusIndex = null,
    smoothFocus = true,
    paddingStart = 0,
    paddingEnd = 0,
    onFirstVisible,
    scrollerProps
  }: Props<T>,
  ref: React.ForwardedRef<VirtualListHandle>
): JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const jumpedOnce = useRef(false)
  const firstVisible = useRef(-1)
  const onFirstVisibleRef = useRef(onFirstVisible)
  onFirstVisibleRef.current = onFirstVisible

  const windowed = items.length >= threshold
  const virtualizer = useVirtualizer({
    enabled: windowed,
    count: items.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => estimateSize,
    overscan,
    gap,
    paddingStart,
    paddingEnd,
    getItemKey: itemKey ? (i) => itemKey(items[i], i) : undefined,
    onChange: (instance) => {
      const start = instance.range?.startIndex ?? 0
      if (start !== firstVisible.current) {
        firstVisible.current = start
        onFirstVisibleRef.current?.(start)
      }
    },
    // A row that measures 0 (hidden panel, no layout) is treated as its
    // estimate — otherwise every row would "fit" in the viewport at once and
    // the whole list would mount, which is exactly what this exists to avoid.
    measureElement: (el, entry) => {
      const h = entry?.borderBoxSize?.[0]?.blockSize ?? el.getBoundingClientRect().height
      return h > 0 ? Math.round(h) : estimateSize
    },
    initialRect: { width: 600, height: FALLBACK_HEIGHT },
    observeElementRect: (instance, cb) =>
      observeElementRect(instance, (rect) =>
        cb(rect.height === 0 ? { width: rect.width || 600, height: FALLBACK_HEIGHT } : rect)
      )
  })

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index, opts) => {
        if (windowed) {
          virtualizer.scrollToIndex(index, {
            align: opts?.align ?? 'center',
            behavior: opts?.smooth ? 'smooth' : 'auto'
          })
          return
        }
        scrollPlainTo(scrollerRef.current, index, opts?.align ?? 'center', !!opts?.smooth)
      },
      scrollToTop: () => {
        if (windowed) virtualizer.scrollToOffset(0)
        else scrollerRef.current?.scrollTo?.({ top: 0 })
      }
    }),
    [virtualizer, windowed]
  )

  useEffect(() => {
    if (focusIndex == null || focusIndex < 0 || focusIndex >= items.length) return
    const smooth = smoothFocus && jumpedOnce.current
    if (windowed) {
      virtualizer.scrollToIndex(focusIndex, { align: 'center', behavior: smooth ? 'smooth' : 'auto' })
    } else {
      scrollPlainTo(scrollerRef.current, focusIndex, 'center', smooth)
    }
    jumpedOnce.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIndex, items.length])

  const rows = windowed ? virtualizer.getVirtualItems() : []
  const start0 = windowed ? (rows.length ? rows[0].index : 0) : 0
  useEffect(() => {
    if (start0 !== firstVisible.current) {
      firstVisible.current = start0
      onFirstVisibleRef.current?.(start0)
    }
  }, [start0])

  // Fully-mounted lists have no virtualizer to say what is at the top, so work
  // it out from the scroll position (rows are in normal flow, so a binary
  // search over their offsets is exact and cheap).
  const rafRef = useRef(0)
  const reportPlainFirstVisible = (): void => {
    const el = scrollerRef.current
    if (!el || windowed || !onFirstVisibleRef.current) return
    const rowsEls = el.querySelectorAll<HTMLElement>('[data-index]')
    if (rowsEls.length === 0) return
    // Not laid out yet (hidden panel / no layout engine): the top row is first.
    const laidOut = rowsEls[rowsEls.length - 1].offsetTop > 0
    const top = el.scrollTop
    let lo = 0
    let hi = laidOut ? rowsEls.length - 1 : 0
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const r = rowsEls[mid]
      if (r.offsetTop + r.offsetHeight > top + 1) hi = mid
      else lo = mid + 1
    }
    const index = Number(rowsEls[lo].dataset.index ?? lo)
    const atEnd = laidOut && el.scrollTop + el.clientHeight >= el.scrollHeight - 2
    const key = atEnd ? -2 - index : index
    if (key !== firstVisible.current) {
      firstVisible.current = key
      onFirstVisibleRef.current(index, atEnd)
    }
  }
  const onPlainScroll = (): void => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(reportPlainFirstVisible)
  }
  useEffect(() => {
    if (!windowed) reportPlainFirstVisible()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowed, items.length])

  const scrollerStyle = { overflowY: 'auto' as const, position: 'relative' as const, ...scrollerProps?.style }
  if (!windowed) {
    return (
      <div
        {...scrollerProps}
        ref={scrollerRef}
        className={className}
        style={scrollerStyle}
        onScroll={onPlainScroll}
      >
        <div style={{ paddingTop: paddingStart, paddingBottom: paddingEnd }}>
          {items.map((item, i) => (
            <div
              key={itemKey ? itemKey(item, i) : i}
              data-index={i}
              style={{ marginBottom: i === items.length - 1 ? 0 : gap }}
            >
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div {...scrollerProps} ref={scrollerRef} className={className} style={scrollerStyle}>
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {rows.map((vr) => (
          <div
            key={vr.key}
            data-index={vr.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vr.start}px)`
            }}
          >
            {renderItem(items[vr.index], vr.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Natural-flow scroll to a row, for lists short enough to be fully mounted. */
function scrollPlainTo(
  scroller: HTMLDivElement | null,
  index: number,
  align: 'start' | 'center' | 'end',
  smooth: boolean
): void {
  const row = scroller?.querySelector<HTMLElement>(`[data-index="${index}"]`)
  if (!scroller || !row) return
  const top =
    align === 'start'
      ? row.offsetTop
      : align === 'end'
        ? row.offsetTop - scroller.clientHeight + row.offsetHeight
        : row.offsetTop - (scroller.clientHeight - row.offsetHeight) / 2
  scroller.scrollTo?.({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
}

const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: Props<T> & { ref?: React.Ref<VirtualListHandle> }
) => JSX.Element

export default VirtualList
