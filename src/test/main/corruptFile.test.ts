import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { readJsonQuarantining } from '../../main/corruptFile'

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
