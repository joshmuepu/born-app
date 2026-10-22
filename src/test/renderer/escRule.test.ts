// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { escBlanksScreens, overlayIsOpen, trackEscOverlay } from '../../renderer/src/escRule'

afterEach(() => { document.body.innerHTML = '' })
const esc = { key: 'Escape', shiftKey: false }

describe('Esc closes what is on top before it blanks the screens', () => {
  it('blanks when nothing is open', () => {
    expect(overlayIsOpen()).toBe(false)
    expect(escBlanksScreens(esc, false)).toBe(true)
  })
  it('does not blank when something was open', () => expect(escBlanksScreens(esc, true)).toBe(false))
  it('Shift+Esc is the panic key: it blanks even with a dialog open', () => expect(escBlanksScreens({ key: 'Escape', shiftKey: true }, true)).toBe(true))
  it('other keys never blank', () => expect(escBlanksScreens({ key: 'b', shiftKey: false }, false)).toBe(false))
  for (const html of ['<div class="help-modal modal" role="dialog"></div>', '<div class="remote-popover" role="dialog"></div>', '<div class="screens-popover"></div>', '<div role="menu"></div>', '<div class="song-key-popover"></div>', '<div class="filter-popover"></div>', '<div class="modal"></div>'])
    it(`sees this as open: ${html}`, () => { document.body.innerHTML = html; expect(overlayIsOpen()).toBe(true) })
})

describe('what was open is recorded before the popover closes itself', () => {
  it('a popover that removes itself on Esc (as React does) is still counted as open for the app-wide handler', () => {
    const stop = trackEscOverlay()
    document.body.innerHTML = '<div class="remote-popover" role="dialog"></div>'
    let seen: boolean | null = null
    // the popover's own listener closes it first; the app-wide listener then asks
    document.addEventListener('keydown', () => { document.body.innerHTML = '' })
    document.addEventListener('keydown', (e) => { seen = escBlanksScreens(e) })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    stop()
    expect(seen).toBe(false)
  })
  it('with nothing open the same Esc blanks', () => {
    const stop = trackEscOverlay()
    let seen: boolean | null = null
    document.addEventListener('keydown', (e) => { seen = escBlanksScreens(e) })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    stop()
    expect(seen).toBe(true)
  })
})
