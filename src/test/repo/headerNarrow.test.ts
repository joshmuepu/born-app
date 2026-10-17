import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { widthClass, widthTokens } from '../../renderer/src/uiScale'

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
    expect(css).toMatch(/html\[data-cssw='tight'\] \.nav-history \{ display: none; \}/)
  })
  it('is keyed to the width after the interface scale, not a media query (which sees the window, not the scaled page)', () => {
    expect(widthClass(1366)).toBe('wide')
    expect(widthClass(1100)).toBe('narrow')
    expect(widthClass(1040)).toBe('narrow')
    expect(widthClass(1040 / 1.5)).toBe('tight') // a 1040 px window at 150 %
    expect(widthClass(1366 / 1.75)).toBe('tight')
    expect(widthClass(1366 / 1.25)).toBe('narrow')
  })
  it('every other breakpoint is keyed the same way (no @media width rules left, which ignore the interface scale)', () => {
    expect(widthTokens(1500)).toBe('')
    expect(widthTokens(1366)).toBe('1440')
    expect(widthTokens(1210)).toBe('1440 1240')
    expect(widthTokens(1150)).toBe('1440 1240 1180')
    expect(widthTokens(1040)).toBe('1440 1240 1180 1060')
    expect(widthTokens(1040 / 1.5)).toBe('1440 1240 1180 1060 820 720')
    for (const f of ['App.css', 'components/GlobalTapeBar.css', 'components/TapePlace.css', 'components/TapeAttach.css']) {
      const t = readFileSync(join(__dirname, '../../renderer/src', f), 'utf8')
      expect(t, f).not.toMatch(/@media \((max|min)-width/)
    }
  })
})

describe('the left rail on a short window', () => {
  it('scrolls, so Saved, Open and Queue never fall off the bottom (at 150 % on a 1040x640 window the rail is 404 px in a 345 px column)', () => {
    expect(css).toMatch(/\.app-rail \{[^}]*overflow-y: auto/)
  })
})

describe('dialogs on a short window', () => {
  it('scroll inside the window (the shortcuts list is 1021 px tall: at 640 px its title and bottom rows were off screen and unreachable)', () => {
    expect(css).toMatch(/\n\.modal \{[^}]*max-height: calc\(90vh \/ var\(--ui-zoom, 1\)\);[^}]*overflow-y: auto/)
  })
})
