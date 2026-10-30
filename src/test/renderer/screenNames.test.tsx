// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// The congregation's screen is the "Congregation screen" everywhere it is named (the Screens panel, the shortcuts list, the
// glossary, the stage monitor's own Stage | Congregation switch). The Message dialog and the queue's preview switch called it
// "Main screen", a name the glossary does not have. The same Copy diagnostics button had two labels, and Browse wrote
// "Recently played" under its own "Recently Played" card.
const src = (f: string): string => readFileSync(join(__dirname, '../../renderer/src', f), 'utf8')

describe('one name for each thing', () => {
  it('no "Main screen" in the operator window', () => {
    for (const f of ['App.tsx', 'components/ServiceQueue.tsx']) expect(src(f)).not.toMatch(/main screen/i)
  })
  it('the Message dialog offers Stage monitor / Congregation screen / Both', () => {
    expect(src('App.tsx')).toMatch(/'Stage monitor' : t === 'congregation' \? 'Congregation screen' : 'Both'/)
  })
  it('Copy diagnostics is called that in both places', () => {
    expect(src('components/ScreensMenu.tsx')).not.toMatch(/Copy diagnostic info/)
    expect(src('components/ScreensMenu.tsx')).toMatch(/Copy diagnostics/)
  })
  it('Recently Played is written the same way in Browse', () => {
    expect(src('components/BrowsePanel.tsx')).not.toMatch(/Recently played/)
  })
})
