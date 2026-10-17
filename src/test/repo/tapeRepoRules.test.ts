import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const root = join(__dirname, '../../..')
const tracked = (): string[] => {
  try { return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean) } catch { return [] }
}
const files = tracked()
const hasGit = files.length > 0

describe('what must never be in the repository (tape service)', () => {
  it.skipIf(!hasGit)('no audio, recordings or speech models are tracked', () => {
    // the tiny placeholder fixtures of the media tests (a few bytes, not sound) are the one exception: anything under src/test/fixtures must stay under 4 KB
    const isAudio = (f: string): boolean => /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|wma|aiff?|caf)$/i.test(f) || /(^|\/)ggml-[^/]*\.bin$/i.test(f) || /\.(gguf|onnx)$/i.test(f)
    const bad = files.filter((f) => isAudio(f) && !(f.startsWith('src/test/fixtures/') && statSync(join(root, f)).size < 4096))
    expect(bad).toEqual([])
  })
  it.skipIf(!hasGit)('nothing under docs/commercial is tracked', () => {
    // Two files were committed BEFORE the tape work (dependency-audit.md, licenses.csv — see the progress report: the owner decides what to do about them).
    // The tape work adds none.
    const preExisting = new Set(['docs/commercial/dependency-audit.md', 'docs/commercial/licenses.csv'])
    expect(files.filter((f) => f.startsWith('docs/commercial') && !preExisting.has(f))).toEqual([])
  })
  it.skipIf(!hasGit)('no database files are tracked (the sermon text lives in a bundled archive that already existed, not in new files)', () => {
    const bad = files.filter((f) => /\.(db|sqlite3?)(-wal|-shm)?$/i.test(f))
    expect(bad).toEqual([])
  })
  it.skipIf(!hasGit)('screenshots added for the manual stay small (under 300 KB each) and few (at most 12 tape ones)', () => {
    const tape = files.filter((f) => /^docs\/manual\/v2\/images\/tape-[^/]+\.png$/.test(f))
    expect(tape.length).toBeLessThanOrEqual(12)
    for (const f of tape) expect(statSync(join(root, f)).size).toBeLessThan(300 * 1024)
  })
  it.skipIf(!hasGit)('no timing file, recording or whisper output was committed by accident', () => {
    const bad = files.filter((f) => /\.born-sync\.json$/i.test(f) || /(^|\/)tape-[^/]*\.(json|wav)$/i.test(f) && !f.startsWith('src/'))
    expect(bad).toEqual([])
  })
})

describe('the v2 identity and the release gate are unchanged', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string; build: { appId: string; productName: string } }
  it('version, app id and product name', () => {
    expect(pkg.version).toMatch(/^2\.0\.0-dev\.\d+$/)
    expect(pkg.build.appId).toBe('com.joshmuepu.born.v2dev')
    expect(pkg.build.productName).toBe('Branham or Nothing (v2 dev)')
  })
  it('the release workflow still accepts only v1.x.x tags, and v2 tags fail the gate', () => {
    const wf = readFileSync(join(root, '.github/workflows/release.yml'), 'utf8')
    expect(wf).toContain('^v1\\.[0-9]+\\.[0-9]+$')
    const gate = /^v1\.[0-9]+\.[0-9]+$/
    for (const ok of ['v1.13.1', 'v1.0.0']) expect(gate.test(ok)).toBe(true)
    for (const no of ['v2.0.0', 'v2.0.0-dev.1', 'v2.0.0-dev.1-tape', 'v1.13.1-tape', 'v1.13']) expect(gate.test(no)).toBe(false)
  })
  it('the v2 dev build workflow is manual only and read only', () => {
    const wf = readFileSync(join(root, '.github/workflows/v2-dev-build.yml'), 'utf8')
    expect(wf).toMatch(/workflow_dispatch:/)
    expect(wf).not.toMatch(/^\s*push:/m)
    expect(wf).not.toMatch(/^\s*tags:/m)
    expect(wf).toMatch(/contents:\s*read/)
    expect(wf).not.toMatch(/contents:\s*write/)
  })
})

describe('colours in the tape screens of the OPERATOR app come from tokens', () => {
  const dir = join(root, 'src/renderer/src/components')
  const operator = ['TapeAttach.css', 'TapeBar.css', 'TapeSyncEditor.css', 'TapeScreenControls.css', 'TapeLanguageNotice.css', 'TapeSettingsPanel.css']
  it.each(operator)('%s uses var(--token) colours only (no hex, rgb() or named colours)', (f) => {
    const css = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const bad = css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []
    expect(bad).toEqual([])
  })
  it('every token those files use exists in the app stylesheet', () => {
    const app = readFileSync(join(root, 'src/renderer/src/App.css'), 'utf8')
    const defined = new Set([...app.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]))
    // a token used with a fallback — var(--x, …) — is allowed to be missing; one used bare must exist
    const used = new Set(operator.flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/var\((--[a-z0-9-]+)\s*\)/g)].map((m) => m[1])))
    const missing = [...used].filter((t) => !defined.has(t))
    expect(missing).toEqual([])
  })
})
