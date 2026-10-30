import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
const ROOT = join(__dirname, '..', '..', '..')

describe('the series list is bundled, so Browse > Series works offline', () => {
  const f = JSON.parse(readFileSync(join(ROOT, 'resources', 'series.json'), 'utf8')) as { series: Array<{ i: number; n: string; s: number[] }> }
  it('holds the series with their sermon ids, including the Church Ages and Hebrews', () => {
    expect(f.series.length).toBeGreaterThanOrEqual(10)
    for (const s of f.series) { expect(typeof s.n).toBe('string'); expect(s.s.length).toBeGreaterThan(0) }
    const names = f.series.map((s) => s.n)
    expect(names).toContain('An Exposition Of The Seven Church Ages')
    expect(names).toContain('The Book Of Hebrews')
  })
  it('is packed into the installer next to the other libraries', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    expect(JSON.stringify(pkg.build.extraResources)).toMatch(/series\.json/)
  })
  it('the app falls back to it when The Table does not answer (desktop and phone remote)', () => {
    const src = readFileSync(join(ROOT, 'src', 'main', 'index.ts'), 'utf8')
    expect(src.match(/online\.length > 0 \? online : loadBundledSeries\(\)/g)?.length).toBe(2)
  })
})
