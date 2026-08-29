/**
 * queueNav.ts — pure two-axis navigation over a service queue.
 * Position = (itemIndex, slideIndex). Advancing past the last slide of an item
 * moves to the first slide of the next item; retreating past slide 0 moves to
 * the last slide of the previous item.
 */

export interface Position {
  itemIndex: number
  slideIndex: number
}

interface HasSlides {
  slides: unknown[]
}

/** Clamp a position into a valid slot for the given queue. Returns null for an empty queue. */
export function clampPosition(queue: HasSlides[], pos: Position | null): Position | null {
  if (queue.length === 0) return null
  if (!pos) return { itemIndex: 0, slideIndex: 0 }
  const itemIndex = Math.max(0, Math.min(pos.itemIndex, queue.length - 1))
  const slideCount = Math.max(1, queue[itemIndex].slides.length)
  const slideIndex = Math.max(0, Math.min(pos.slideIndex, slideCount - 1))
  return { itemIndex, slideIndex }
}

/** Next slide, spilling into the next item. Stops at the very end. */
export function stepForward(queue: HasSlides[], pos: Position | null): Position | null {
  if (queue.length === 0) return null
  if (!pos) return { itemIndex: 0, slideIndex: 0 }
  const cur = clampPosition(queue, pos)!
  const slideCount = Math.max(1, queue[cur.itemIndex].slides.length)
  if (cur.slideIndex < slideCount - 1) {
    return { itemIndex: cur.itemIndex, slideIndex: cur.slideIndex + 1 }
  }
  if (cur.itemIndex < queue.length - 1) {
    return { itemIndex: cur.itemIndex + 1, slideIndex: 0 }
  }
  return cur // already at the end
}

/** Previous slide, spilling into the previous item. Stops at the very start. */
export function stepBack(queue: HasSlides[], pos: Position | null): Position | null {
  if (queue.length === 0) return null
  if (!pos) return { itemIndex: 0, slideIndex: 0 }
  const cur = clampPosition(queue, pos)!
  if (cur.slideIndex > 0) {
    return { itemIndex: cur.itemIndex, slideIndex: cur.slideIndex - 1 }
  }
  if (cur.itemIndex > 0) {
    const prevItem = cur.itemIndex - 1
    const prevSlides = Math.max(1, queue[prevItem].slides.length)
    return { itemIndex: prevItem, slideIndex: prevSlides - 1 }
  }
  return cur // already at the start
}
