import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { hitBody } from '../../shared/sermonHit'
import { APP_JS } from '../../main/remoteAssets'

// The phone's sermon results began with the paragraph number ("75 Well, He can't…") right under "¶75";
// the desktop drops it. Both now use the same rule.
describe('sermon result text without its paragraph number', () => {
  it('hitBody drops a leading number or range only', () => {
    expect(hitBody('75 Well, He can’t')).toBe('Well, He can’t')
    expect(hitBody('183-211 And so')).toBe('And so')
    expect(hitBody('183–211 And so')).toBe('And so')
    expect(hitBody('Well, 75 people')).toBe('Well, 75 people')
  })
  it('the phone search results are highlighted from the text without the number', () => {
    const src = readFileSync(join(__dirname, '../../main/index.ts'), 'utf8')
    expect(src).toMatch(/highlightedText: highlightToHtml\(hitBody\(r\.text\)/)
  })
  it('the phone Recently Played list drops it too', () => {
    const line = APP_JS.split('\n').find((l) => l.includes('rsnippet') && l.includes('q.text') && l.includes('.replace('))
    expect(line).toBeDefined()
    const m = line!.match(/\.replace\((\/[^/]+\/), ''\)/)
    expect(m).not.toBeNull()
    const re = eval(m![1]) as RegExp
    expect('75 Well, He'.replace(re, '')).toBe('Well, He')
    expect('183-211 And so'.replace(re, '')).toBe('And so')
  })
})
