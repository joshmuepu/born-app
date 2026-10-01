import { describe, it, expect } from 'vitest'
import { sermonIndexRow } from '../../main/indexer'
import type { SermonIndexEntry } from '../../main/tableApi'

describe('sermonIndexRow', () => {
  it('maps a complete entry straight through', () => {
    const e: SermonIndexEntry = {
      i: 1, p: '63-0901M', t: 'Come Follow Me', c: 120, m: 90, cab: false, ct: 'S'
    }
    expect(sermonIndexRow(e)).toEqual([1, '63-0901M', 'Come Follow Me', 120, 90, 0])
  })

  it('flags ct "B" as is_book = 1', () => {
    const e: SermonIndexEntry = {
      i: 1388, p: '', t: 'Chapter 3 - The Ephesian Church Age', c: 1, m: 0, cab: true, ct: 'B'
    }
    expect(sermonIndexRow(e)[5]).toBe(1)
  })

  // Reproduces exactly what was found live: table.branham.org's allSermons
  // returned a brand-new sermon (62-1030X, "Vision From The Lord", id 5089)
  // with no `m` field at all. Binding `undefined` for duration_min (NOT
  // NULL) via INSERT OR IGNORE doesn't throw — it silently no-ops the
  // entire row, indistinguishable from "already present" without directly
  // checking. This coalescing is what stops one incomplete upstream entry
  // from silently blocking itself out of the index forever.
  it('coalesces a missing duration (m) to 0 rather than passing undefined through', () => {
    const e = { i: 5089, p: '62-1030X', t: 'Vision From The Lord', c: 21, cab: false, ct: 'S' } as SermonIndexEntry
    const row = sermonIndexRow(e)
    expect(row).toEqual([5089, '62-1030X', 'Vision From The Lord', 21, 0, 0])
    expect(row.every((v) => v !== undefined)).toBe(true)
  })

  it('coalesces a missing paragraph count (c) to 0', () => {
    const e = { i: 1, p: '63-0901M', t: 'Test', m: 30, cab: false, ct: 'S' } as SermonIndexEntry
    expect(sermonIndexRow(e)[3]).toBe(0)
  })

  it('coalesces missing date code and title to empty strings, never undefined', () => {
    const e = { i: 1, c: 1, m: 1, cab: false, ct: 'S' } as SermonIndexEntry
    const row = sermonIndexRow(e)
    expect(row[1]).toBe('')
    expect(row[2]).toBe('')
    expect(row.every((v) => v !== undefined)).toBe(true)
  })
})
