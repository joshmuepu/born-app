import { describe, it, expect } from 'vitest'
import { addSummary } from '../../shared/tapeAdd'
import type { TapeImportResult } from '../../shared/tape'

const ok = (name: string, sermonId: number, id: string, duplicate = false): TapeImportResult => ({ ok: true, file: { name } as never, recording: { id, sermonId } as never, duplicate, warnings: [] })
const bad: TapeImportResult = { ok: false, path: '/x.m4a', reason: 'unsupported', message: 'This computer cannot play that kind of file.' }
const title = (id: number): string => (id === 5 ? '65-0418M · It Is' : 'the sermon')

describe('what "Add a recording…" tells the operator', () => {
  it('names the file and the sermon it went to, and says where to land', () => {
    const s = addSummary({ added: [ok('65-0418M It Is', 5, 'r1')], pending: [] }, title)
    expect(s.message).toBe('Added “65-0418M It Is” to 65-0418M · It Is.')
    expect(s.recordingId).toBe('r1')
    expect(s.problems).toEqual([])
  })
  it('says when it was already in BORN', () => {
    expect(addSummary({ added: [ok('a', 5, 'r1', true)], pending: [] }, title).message).toContain('already in BORN')
  })
  it('several files: a count, and lands on the first', () => {
    const s = addSummary({ added: [ok('a', 5, 'r1'), ok('b', 6, 'r2')], pending: [] }, title)
    expect(s.message).toBe('Added 2 recordings.')
    expect(s.recordingId).toBe('r1')
  })
  it('files it could not place are said plainly; failures keep their own words', () => {
    const s = addSummary({ added: [ok('a', 5, 'r1'), bad], pending: [{ path: '/p', name: 'p', bytes: 1, candidates: [] }] }, title)
    expect(s.message).toMatch(/1 file needs you to say which sermon it is\.$/)
    expect(s.problems).toEqual(['This computer cannot play that kind of file.'])
  })
  it('nothing added, nothing pending: no message', () => {
    expect(addSummary({ added: [], pending: [] }, title)).toEqual({ message: null, recordingId: null, problems: [] })
  })
})
