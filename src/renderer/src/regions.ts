/** The main regions of the window, in the order F6 walks them (and the skip links jump to them). */
export const REGIONS = [
  { id: 'header', selector: '.app-header', name: 'the header' },
  { id: 'rail', selector: '.app-rail', name: 'the sections' },
  { id: 'content', selector: '#main-content', name: 'the content' },
  { id: 'queue', selector: '#queue-pane', name: 'the service queue' },
  { id: 'dock', selector: '.status-bar, .now-dock', name: 'the status bar' }
] as const

export const SECTION_NAMES: Record<string, string> = { sermons: 'Sermons', bible: 'Bible', songs: 'Songs', media: 'Media', tape: 'Tape' }

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** On the page and focusable: laid out, not `visibility: hidden` (a closed queue pane keeps its width but cannot take focus), not inert. */
const visible = (el: HTMLElement): boolean => {
  if (el.closest('[inert]')) return false
  const cv = (el as HTMLElement & { checkVisibility?: (o?: { visibilityProperty?: boolean }) => boolean }).checkVisibility
  if (typeof cv === 'function') return cv.call(el, { visibilityProperty: true })
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
}

/** Move focus into a region: its first visible control, or the region itself when it has none. */
export function focusRegion(selector: string, root: ParentNode = document): boolean {
  const region = root.querySelector<HTMLElement>(selector)
  if (!region) return false
  const first = Array.from(region.querySelectorAll<HTMLElement>(FOCUSABLE)).find(visible)
  const target = first ?? region
  if (target === region && region.tabIndex < 0 && !region.hasAttribute('tabindex')) region.setAttribute('tabindex', '-1')
  target.focus()
  return true
}

/** Which region holds the focused element (index into REGIONS), or -1. */
export function currentRegion(active: Element | null, root: ParentNode = document): number {
  if (!active) return -1
  return REGIONS.findIndex((r) => Array.from(root.querySelectorAll(r.selector)).some((el) => el.contains(active)))
}

/** F6 / Shift+F6: the next region that exists and has something to focus. */
export function cycleRegion(dir: 1 | -1, root: ParentNode = document): string | null {
  const here = currentRegion(document.activeElement, root)
  for (let step = 1; step <= REGIONS.length; step++) {
    const i = (((here < 0 ? (dir === 1 ? -1 : 0) : here) + dir * step) % REGIONS.length + REGIONS.length) % REGIONS.length
    const r = REGIONS[i]
    const el = root.querySelector<HTMLElement>(r.selector)
    if (el && visible(el) && focusRegion(r.selector, root)) return r.id
  }
  return null
}
