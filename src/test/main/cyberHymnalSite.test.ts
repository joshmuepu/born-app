import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchCyberHymnalHymn, searchCyberHymnal } from '../../main/cyberHymnal'

// The hymn site's pages are read only when they really came from the site (a redirect elsewhere is refused) and are of a sane size.

vi.mock('../../main/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))
const realFetch = global.fetch
afterEach(() => { global.fetch = realFetch })
const page = (body: string, url: string, headers: Record<string, string> = {}): Response => {
  const r = new Response(body, { status: 200, headers })
  Object.defineProperty(r, 'url', { value: url })
  return r
}
const HYMN = '<title>Invented Hymn</title><meta name="description" content="Public Domain"><p>Placeholder line one<br>Placeholder line two</p>'

describe('the online hymn site', () => {
  it('a hymn page redirected to another host is refused', async () => {
    global.fetch = vi.fn(() => Promise.resolve(page(HYMN, 'https://elsewhere.example/hymn.htm'))) as unknown as typeof fetch
    expect(await fetchCyberHymnalHymn('http://www.hymntime.com/tch/htm/i/n/v/invented.htm')).toEqual({ ok: false, reason: 'not-found' })
  })
  it('a page far too large is refused', async () => {
    global.fetch = vi.fn(() => Promise.resolve(page('x', 'http://www.hymntime.com/tch/htm/i/n/v/invented.htm', { 'content-length': String(50_000_000) }))) as unknown as typeof fetch
    expect(await fetchCyberHymnalHymn('http://www.hymntime.com/tch/htm/i/n/v/invented.htm')).toEqual({ ok: false, reason: 'not-found' })
  })
  it('a title list redirected to another host gives no candidates', async () => {
    global.fetch = vi.fn(() => Promise.resolve(page('<a href="/tch/htm/i/n/v/invented.htm">Invented Hymn</a>', 'https://elsewhere.example/ttl-i.htm'))) as unknown as typeof fetch
    expect(await searchCyberHymnal('Invented')).toEqual([])
  })
})
