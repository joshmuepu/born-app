import { describe, it, expect } from 'vitest'
import { libraryStatus, sortLibrary } from '../../shared/tapeLibrary'

describe('how the library describes a recording', () => {
  it('a ready, timed recording is OK and says how many paragraphs have a time', () => {
    expect(libraryStatus({ status: 'ok', timed: 363 })).toMatchObject({ tone: 'ok', label: 'Timed', detail: '363 paragraphs have a time.' })
    expect(libraryStatus({ status: 'ok', timed: 1 }).detail).toBe('1 paragraph has a time.')
  })
  it('a recording with no timing needs it (amber), because the text cannot follow it', () => {
    expect(libraryStatus({ status: 'ok', timed: 0 })).toMatchObject({ tone: 'warn', label: 'Needs timing' })
  })
  it('file problems come first and are red or amber with the reason in plain words', () => {
    expect(libraryStatus({ status: 'missing', timed: 5 })).toMatchObject({ tone: 'bad', label: 'File missing' })
    expect(libraryStatus({ status: 'offline', timed: 5 })).toMatchObject({ tone: 'bad', label: 'Drive not connected' })
    expect(libraryStatus({ status: 'unreadable', timed: 5 })).toMatchObject({ tone: 'bad', label: 'Cannot read the file' })
    expect(libraryStatus({ status: 'changed', timed: 5 })).toMatchObject({ tone: 'warn', label: 'File was changed' })
  })
  it('sorts problems, then recordings needing timing, then ready ones; newest first within a group', () => {
    const l = [
      { id: 'ready-old', status: 'ok' as const, timed: 9, createdAt: '2026-01-01' },
      { id: 'needs', status: 'ok' as const, timed: 0, createdAt: '2026-02-01' },
      { id: 'missing', status: 'missing' as const, timed: 9, createdAt: '2025-01-01' },
      { id: 'ready-new', status: 'ok' as const, timed: 9, createdAt: '2026-03-01' }
    ]
    expect(sortLibrary(l).map((x) => x.id)).toEqual(['missing', 'needs', 'ready-new', 'ready-old'])
    expect(l[0].id).toBe('ready-old') // the input is not changed
  })
})
