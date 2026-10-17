import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { RETIRED, TERMS } from '../../shared/glossary'

const SRC = join(__dirname, '../..')
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n)
  if (statSync(p).isDirectory()) return n === 'test' ? [] : files(p)
  return /\.(ts|tsx)$/.test(n) ? [p] : []
})

/** Lines that are comments are not what the operator reads. */
const isComment = (l: string): boolean => /^\s*(\/\/|\*|\/\*)/.test(l)

describe('the glossary: one word per job in everything the operator reads (P-02)', () => {
  it('the terms are the agreed ones', () => {
    expect(TERMS.show).toBe('Show')
    expect(TERMS.showNext).toBe('Show next')
    expect(TERMS.hideScreen).toBe('Hide screen')
  })
  it('no retired word (Project, Take next, Put … on the screen, Blank) is left in operator-facing text', () => {
    const hits: string[] = []
    for (const f of files(SRC)) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (isComment(line)) return
        for (const r of RETIRED) if (r.word.test(line)) hits.push(`${f.replace(SRC + '/', '')}:${i + 1}  ${line.trim().slice(0, 110)}   → ${r.use}`)
      })
    }
    expect(hits).toEqual([])
  })
})
