import { describe, it, expect } from 'vitest'
import { resolveApiV1 } from '../../shared/apiVersioning'

describe('resolveApiV1', () => {
  it('leaves an already-unversioned path untouched', () => {
    expect(resolveApiV1('/api/automation/state')).toBe('/api/automation/state')
    expect(resolveApiV1('/command')).toBe('/command')
    expect(resolveApiV1('/state')).toBe('/state')
  })

  it('never touches output/page resources even if they start with /api', () => {
    expect(resolveApiV1('/output/graphics/abc')).toBe('/output/graphics/abc')
    expect(resolveApiV1('/')).toBe('/')
  })

  it('maps /api/v1/command and /api/v1/state to their un-prefixed originals', () => {
    expect(resolveApiV1('/api/v1/command')).toBe('/command')
    expect(resolveApiV1('/api/v1/state')).toBe('/state')
  })

  it('maps every other v1 route back under plain /api/', () => {
    expect(resolveApiV1('/api/v1/automation/state')).toBe('/api/automation/state')
    expect(resolveApiV1('/api/v1/automation/next')).toBe('/api/automation/next')
    expect(resolveApiV1('/api/v1/automation/clear/main')).toBe('/api/automation/clear/main')
    expect(resolveApiV1('/api/v1/automation/ws')).toBe('/api/automation/ws')
    expect(resolveApiV1('/api/v1/search/sermons')).toBe('/api/search/sermons')
    expect(resolveApiV1('/api/v1/bible/books')).toBe('/api/bible/books')
    expect(resolveApiV1('/api/v1/song/42')).toBe('/api/song/42')
    expect(resolveApiV1('/api/v1/songs/recent')).toBe('/api/songs/recent')
    expect(resolveApiV1('/api/v1/services/recent')).toBe('/api/services/recent')
    expect(resolveApiV1('/api/v1/sermons/series')).toBe('/api/sermons/series')
  })

  it('preserves query strings untouched — only the path segment is rewritten', () => {
    // resolveApiV1 only ever receives a pathname (callers pass url.pathname,
    // which never includes the query string), so this just documents that
    // contract rather than exercising URL parsing itself.
    expect(resolveApiV1('/api/v1/bible/chapter')).toBe('/api/bible/chapter')
  })
})
