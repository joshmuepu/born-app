// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { REGIONS, cycleRegion, currentRegion, focusRegion } from '../../renderer/src/regions'
import SkipLinks from '../../renderer/src/components/SkipLinks'

afterEach(() => { cleanup(); document.body.innerHTML = '' })

const shell = (): void => {
  document.body.innerHTML = `
    <div class="app">
      <header class="app-header"><button id="h1">Help</button><button id="h2">Screens</button></header>
      <nav class="app-rail"><button id="r1">Sermons</button></nav>
      <div id="main-content" tabindex="-1"><input id="c1"></div>
      <div id="queue-pane" tabindex="-1"><button id="q1">File</button></div>
      <footer class="status-bar"><button id="s1">App info</button></footer>
    </div>`
  // jsdom has no layout: make everything count as visible
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 10 })
}

describe('landmarks and F6 (P-10)', () => {
  it('has the five regions, in the order F6 walks them', () => {
    expect(REGIONS.map((r) => r.id)).toEqual(['header', 'rail', 'content', 'queue', 'dock'])
  })
  it('focusRegion puts focus on the first control in the region', () => {
    shell()
    expect(focusRegion('#queue-pane')).toBe(true)
    expect(document.activeElement?.id).toBe('q1')
  })
  it('a region with nothing to press takes the focus itself', () => {
    shell()
    document.getElementById('queue-pane')!.innerHTML = '<p>Empty</p>'
    focusRegion('#queue-pane')
    expect(document.activeElement?.id).toBe('queue-pane')
  })
  it('F6 walks header → sections → content → queue → status bar and wraps; Shift+F6 goes back', () => {
    shell()
    document.getElementById('h1')!.focus()
    expect(currentRegion(document.activeElement)).toBe(0)
    const seen = [cycleRegion(1), cycleRegion(1), cycleRegion(1), cycleRegion(1), cycleRegion(1)]
    expect(seen).toEqual(['rail', 'content', 'queue', 'dock', 'header'])
    expect(cycleRegion(-1)).toBe('dock')
  })
  it('F6 skips a region that is not there (no queue pane on a narrow window)', () => {
    shell()
    document.getElementById('queue-pane')!.remove()
    document.getElementById('c1')!.focus()
    expect(cycleRegion(1)).toBe('dock')
  })
})

describe('skip links (P-10)', () => {
  it('are the first thing in the page: Skip to content, the queue and the live controls', () => {
    render(<SkipLinks />)
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Skip to content', 'Skip to the queue', 'Skip to the live controls'])
  })
  it('Skip to content moves focus into the content', () => {
    shell()
    render(<SkipLinks />)
    fireEvent.click(screen.getByRole('link', { name: 'Skip to content' }))
    expect(document.activeElement?.id).toBe('c1')
  })
})
