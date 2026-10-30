import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// The Help page says the in-app list (press ?) is "the same list". Keys the app handles were missing from one or both:
// Shift+Esc (in the Help page only), Page Down / Page Up (what a presentation clicker sends) and ⌘/Ctrl+F (jump to search).
const root = join(__dirname, '../../..')
const app = readFileSync(join(root, 'src/renderer/src/App.tsx'), 'utf8')
const dialog = app.slice(app.indexOf('Keyboard shortcuts</h3>'), app.indexOf('</dl>', app.indexOf('Keyboard shortcuts</h3>')))
const manual = readFileSync(join(root, 'docs/manual/v1/operators/shortcuts.md'), 'utf8')

describe('the shortcuts list in the app and the Help page', () => {
  for (const [what, re] of [
    ['Shift+Esc', /<kbd>Shift<\/kbd>\+<kbd>Esc<\/kbd>/],
    ['Page Down', /<kbd>Page Down<\/kbd>/],
    ['Page Up', /<kbd>Page Up<\/kbd>/],
    ['⌘/Ctrl+F', /<kbd>⌘\/Ctrl<\/kbd>\+<kbd>F<\/kbd>/]
  ] as const) {
    it(`both list ${what}`, () => {
      expect(dialog).toMatch(re)
      expect(manual).toMatch(re)
    })
  }
  it('the app handles those keys', () => {
    expect(app).toMatch(/case 'PageDown':/)
    expect(app).toMatch(/case 'PageUp':/)
    expect(app).toMatch(/mod && e\.key\.toLowerCase\(\) === 'f'/)
  })
  it('the modifier is written ⌘/Ctrl, as in the app', () => {
    expect(manual).not.toMatch(/Ctrl\/⌘/)
  })
})
