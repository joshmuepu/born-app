import { describe, it, expect } from 'vitest'
import { parseRange } from '../../shared/httpRange'

describe('Range header (video seeking)', () => {
  it('no header means the whole file', () => expect(parseRange(undefined, 1000)).toBeNull())
  it('reads start-end, open end, and suffix ranges', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 })
    expect(parseRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 })
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 })
  })
  it('refuses nonsense and out-of-range requests', () => {
    for (const h of ['bytes=', 'bytes=-', 'bytes=abc-1', 'items=0-5', 'bytes=1000-1005', 'bytes=50-10', 'bytes=0-9,20-29']) expect(parseRange(h, 1000), h).toBe('invalid')
  })
})
