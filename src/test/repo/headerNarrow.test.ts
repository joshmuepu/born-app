import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(__dirname, '../../renderer/src/App.css'), 'utf8')
const block = (re: RegExp): string => (css.match(re) ?? [''])[0]

describe('the header on a small laptop with the screens live (1040 px wide)', () => {
  const narrow = block(/@media \(max-width: 1100px\) \{[\s\S]*?\n\}/)
  it('keeps the search button from being squeezed to nothing (it was 22 px wide and drew empty)', () => {
    expect(narrow).toMatch(/\.palette-trigger \{[^}]*min-width: 34px[^}]*flex-shrink: 0/)
  })
  it('drops the wordmark text (the logo mark stays) so the header does not overlap itself', () => {
    expect(narrow).toMatch(/\.app-logo-word \{ display: none; \}/)
  })
})
