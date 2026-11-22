// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { useRef } from 'react'
import { useAutoFitFontSize } from '../../renderer/src/useAutoFitFontSize'

// The projector fits each slide's text to the screen. (1) The fit ran a frame later, so every new slide was first drawn at the previous
// slide's size and then jumped. (2) While the screen was hidden the text is not on the page, so a text size change (or a projector
// resolution change) made then was never applied: after Show screen the slide came back at the old size. (3) The screen's font loads
// only once text first uses it, so the first slide was fitted with the system font; the screen's wider font then wrapped more lines and
// the slide was cut at both ends. It is fitted again when a font finishes loading.

// jsdom has no layout: a box 100px tall whose text is 30px per rem, on 4 lines
let lines = 4
const proto = HTMLElement.prototype as unknown as Record<string, unknown>
Object.defineProperty(proto, 'clientHeight', { configurable: true, get() { return 100 } })
Object.defineProperty(proto, 'scrollHeight', { configurable: true, get(this: HTMLElement) { const rem = parseFloat(this.parentElement?.style.fontSize || '1'); return rem * 30 * lines } })
afterEach(() => cleanup())

// like the projector: the slide stays the same while the screen is hidden, but its text is not on the page
function Box({ content, base, hidden = false, onSize }: { content: unknown; base: number; hidden?: boolean; onSize: (n: number) => void }): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)
  const size = useAutoFitFontSize(ref, content, base, 0.1)
  onSize(size)
  return hidden ? null : <div ref={ref} style={{ fontSize: `${size}rem` }}><div>text</div></div>
}

// jsdom has no FontFaceSet: a stand-in that can say a font has finished loading
const fontListeners = new Set<() => void>()
Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener: (_: string, f: () => void) => fontListeners.add(f), removeEventListener: (_: string, f: () => void) => fontListeners.delete(f) } })

describe('auto-fit', () => {
  it('a new slide is fitted before it is drawn (no frame at the old size)', async () => {
    const seen: number[] = []
    lines = 1
    const r = render(<Box content="short" base={2} onSize={(n) => seen.push(n)} />)
    lines = 4
    await act(async () => { r.rerender(<Box content="a long slide" base={2} onSize={(n) => seen.push(n)} />) })
    // with no animation frame allowed to run, the size is already the fitted one
    expect(seen[seen.length - 1]).toBeLessThan(1)
  })
  it('a size change made while hidden is applied when the slide comes back', async () => {
    lines = 1
    let last = 0
    const r = render(<Box content="slide" base={2} onSize={(n) => (last = n)} />)
    await act(async () => { r.rerender(<Box content="slide" hidden base={2} onSize={(n) => (last = n)} />) })
    await act(async () => { r.rerender(<Box content="slide" hidden base={3} onSize={(n) => (last = n)} />) })
    await act(async () => { r.rerender(<Box content="slide" base={3} onSize={(n) => (last = n)} />) })
    expect(last).toBe(3)
  })
  it('a slide is fitted again when the screen\'s font finishes loading', async () => {
    let last = 0
    lines = 1
    render(<Box content="slide" base={2} onSize={(n) => (last = n)} />)
    expect(last).toBe(2)
    // the wider font wraps the same slide onto more lines
    lines = 4
    await act(async () => { fontListeners.forEach((f) => f()) })
    expect(last).toBeLessThan(1)
  })
  it('the font listener is removed with the slide', () => {
    const r = render(<Box content="slide" base={2} onSize={() => {}} />)
    expect(fontListeners.size).toBe(1)
    r.unmount()
    expect(fontListeners.size).toBe(0)
  })
})
