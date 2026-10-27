import { describe, it, expect } from 'vitest'
import { quoteMeta } from '../../shared/sermonMeta'

describe('the date and paragraph line of a sermon quote', () => {
  it('a sermon: year, date code and paragraph', () => {
    expect(quoteMeta({ dateCode: '63-0324E', paragraphRef: '233' })).toBe('1963 · 63-0324E · ¶233')
    expect(quoteMeta({ dateCode: '63-0324E', paragraphRef: '233' }, { year: false })).toBe('63-0324E · ¶233')
    expect(quoteMeta({ dateCode: '63-0324E', paragraphRef: '233' }, { code: false })).toBe('1963 · ¶233')
  })
  it('a book chapter (no date code, no paragraph number) says Book, never empty separators or an internal row id', () => {
    expect(quoteMeta({ dateCode: '', paragraphRef: '§12345' })).toBe('Book')
    expect(quoteMeta({ dateCode: '', paragraphRef: '§12345' }, { year: false })).toBe('Book')
    expect(quoteMeta({ dateCode: '', paragraphRef: '§12345' }, { code: false })).toBe('Book')
  })
})

describe('the phone remote says the same', () => {
  it('its result line uses one helper that reads Book for a book chapter', async () => {
    const { APP_JS } = await import('../../main/remoteAssets')
    const js = String(APP_JS)
    expect(js).toMatch(/function qmeta\(q\)/)
    expect(js).not.toMatch(/esc\(q\.dateCode \|\| ''\) \+ ' · ¶'/)
    const qmeta = new Function(`${js.slice(js.indexOf('function qmeta'), js.indexOf('\n', js.indexOf('function qmeta')))}; return qmeta`)()
    expect(qmeta({ dateCode: '', paragraphRef: '§1' })).toBe('Book')
    expect(qmeta({ dateCode: '63-0324E', paragraphRef: '12' })).toBe('63-0324E · ¶12')
  })
})
