import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { readJsonQuarantining, readJsonReporting } from '../../main/corruptFile'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'born-corrupt-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('readJsonQuarantining (the saved queue)', () => {
  it('reads a good file as before', () => {
    writeFileSync(join(dir, 'queue.json'), '[{"id":"a"}]')
    expect(readJsonQuarantining(join(dir, 'queue.json'), [])).toEqual([{ id: 'a' }])
    expect(readdirSync(dir)).toEqual(['queue.json'])
  })
  it('a missing file is an empty queue and leaves nothing behind', () => {
    expect(readJsonQuarantining(join(dir, 'queue.json'), [])).toEqual([])
    expect(readdirSync(dir)).toEqual([])
  })
  it('a damaged file gives an empty queue but is kept aside, so the next save cannot destroy it', () => {
    const damaged = '[{"id":"a","slides":[{"text":"Amazing gra'
    writeFileSync(join(dir, 'queue.json'), damaged)
    expect(readJsonQuarantining(join(dir, 'queue.json'), [])).toEqual([])
    const files = readdirSync(dir)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^queue\.corrupt-.*\.json$/)
    expect(readFileSync(join(dir, files[0]), 'utf-8')).toBe(damaged)
  })
})

describe('readJsonReporting (so the operator can be told)', () => {
  it('says a damaged file could not be read and where it was kept', () => {
    writeFileSync(join(dir, 'queue.json'), '[{"id":')
    const r = readJsonReporting(join(dir, 'queue.json'), [])
    expect(r.value).toEqual([])
    expect(r.unreadable).toBe(true)
    expect(r.keptAs).toMatch(/queue\.corrupt-.*\.json$/)
  })
  it('a missing or good file is not a problem', () => {
    expect(readJsonReporting(join(dir, 'queue.json'), []).unreadable).toBe(false)
    writeFileSync(join(dir, 'queue.json'), '[]')
    expect(readJsonReporting(join(dir, 'queue.json'), []).unreadable).toBe(false)
  })
})
