import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

// Every tracked file is public. None may name another product line, a folder on a developer's own computer or its branches.
// The words are built from parts so this file does not name them itself.
const root = join(__dirname, '../../..')
const TEXT = /\.(ts|tsx|js|cjs|mjs|json|md|css|html|yml|yaml|txt|sh|ps1)$|^[^.]+$/
// song files name their verses by letter and number, and a GitHub action is pinned by its major version (after an @)
const SKIP = /^src\/test\/fixtures\/|^package-lock\.json$/
const FORBIDDEN: Array<[string, RegExp]> = [
  ['another major line', new RegExp('(^|[^@\\w])' + 'v' + '2' + '(?![\\w.])', 'i')],
  ['its branch', new RegExp('v' + '2-channels')],
  ['its name', new RegExp('Born ' + 'Again|born-' + 'again')],
  ['a developer folder', new RegExp('My' + 'Projects|/Users/' + 'joshmuepu')]
]

function tracked(): string[] {
  try {
    return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
  } catch {
    return []
  }
}

describe('public files name nothing outside this product', () => {
  const files = tracked().filter((f) => TEXT.test(f.split('/').pop() ?? '') && !SKIP.test(f))
  it('finds the tracked files', () => {
    if (files.length === 0) return // not a git checkout (a source archive): nothing to check
    expect(files.length).toBeGreaterThan(100)
  })
  it('no tracked file names another product line, its branch, or a developer folder', () => {
    const hits: string[] = []
    for (const f of files) {
      let text: string
      try {
        text = readFileSync(join(root, f), 'utf8')
      } catch {
        continue
      }
      text.split('\n').forEach((line, i) => {
        for (const [what, re] of FORBIDDEN) if (re.test(line)) hits.push(`${f}:${i + 1} (${what})`)
      })
    }
    expect(hits).toEqual([])
  })
})
