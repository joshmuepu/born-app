// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import StageApp from '../../renderer/src/StageApp'

// The stage monitor (what the platform reads) never shrank its text to fit: a five-line song slide at 1920x1080 lost its last line
// and its title, and long sermon pages were cut off at both ends. Its text is now fitted to its box like the projector's, in both the
// Stage and the Congregation view.

// jsdom has no layout: every box is 600px tall and text is 40px per rem on 20 lines (much too tall at the start size)
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return 600 } })
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get(this: HTMLElement) { const rem = parseFloat(this.parentElement?.style.fontSize || '3'); return rem * 40 * 20 } })
afterEach(() => cleanup())

async function show(view: 'stage' | 'congregation'): Promise<HTMLElement> {
  localStorage.setItem('born.stageView', view)
  let push: (d: { current: unknown; next: unknown }) => void = () => {}
  Object.assign(window.electronAPI, {
    onStageUpdate: vi.fn((cb) => { push = cb; return () => {} }), onStageSetBlank: vi.fn(() => () => {}), onStageAlert: vi.fn(() => () => {}), notifyStageReady: vi.fn()
  })
  render(<StageApp />)
  await act(async () => { push({ current: { kind: 'song', label: 'Invented Song', text: Array.from({ length: 20 }, (_, i) => `Placeholder line ${i + 1}`).join('\n') }, next: null }) })
  return document.querySelector(view === 'stage' ? '.stage-current' : '.stage-congregation') as HTMLElement
}

describe('stage monitor text fits its box', () => {
  for (const view of ['stage', 'congregation'] as const) {
    it(`${view} view: a slide too tall at the start size is made smaller`, async () => {
      const box = await show(view)
      const rem = parseFloat(box.style.fontSize)
      expect(rem).toBeGreaterThan(0)
      // the start size is the old fixed one (4.2vw / 6vw of the window width); a slide this tall ends far below it
      const start = Math.min(Math.max((window.innerWidth * (view === 'stage' ? 0.042 : 0.06)) / 16, 2), view === 'stage' ? 5 : 7)
      expect(rem).toBeLessThanOrEqual(start * 0.6)
    })
  }
})
