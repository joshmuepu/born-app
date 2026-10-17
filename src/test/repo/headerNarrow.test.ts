import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { widthClass } from '../../renderer/src/uiScale'

const css = readFileSync(join(__dirname, '../../renderer/src/App.css'), 'utf8')

describe('the header on a small laptop, live (1040 px) and at a large interface scale', () => {
  it('keeps the search button from being squeezed to nothing (it was 22 px wide and drew empty)', () => {
    expect(css).toMatch(/html\[data-cssw='narrow'\] \.palette-trigger, html\[data-cssw='tight'\] \.palette-trigger \{ min-width: 34px; flex-shrink: 0;/)
  })
  it('drops the wordmark text (the logo mark stays) so the header does not overlap itself', () => {
    expect(css).toMatch(/\.app-logo-word \{ display: none; \}/)
  })
  it('wraps instead of cutting the header off the left edge when it is tight', () => {
    expect(css).toMatch(/html\[data-cssw='tight'\] \.app-header \{ flex-wrap: wrap;/)
    expect(css).toMatch(/html\[data-cssw='tight'\] \.nav-history, html\[data-cssw='tight'\] \.header-shortcuts \{ display: none; \}/)
  })
  it('is keyed to the width after the interface scale, not a media query (which sees the window, not the scaled page)', () => {
    expect(widthClass(1366)).toBe('wide')
    expect(widthClass(1100)).toBe('narrow')
    expect(widthClass(1040)).toBe('narrow')
    expect(widthClass(1040 / 1.5)).toBe('tight') // a 1040 px window at 150 %
    expect(widthClass(1366 / 1.75)).toBe('tight')
    expect(widthClass(1366 / 1.25)).toBe('narrow')
  })
})
