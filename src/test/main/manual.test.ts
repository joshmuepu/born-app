import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Point the manual at a throwaway folder: docs/manual/v1 (the manual) next to docs/manual/v1-private (a sibling that
// merely starts with the same characters — it must stay out of reach).
const root = mkdtempSync(join(tmpdir(), 'born-manual-'))
vi.mock('electron', () => ({ app: { getAppPath: () => root } }))

beforeAll(() => {
  mkdirSync(join(root, 'docs', 'manual', 'v1'), { recursive: true })
  mkdirSync(join(root, 'docs', 'manual', 'v1-private'), { recursive: true })
  writeFileSync(join(root, 'docs', 'manual', 'v1', 'manifest.json'), JSON.stringify({ version: 'v1', sections: [] }))
  writeFileSync(join(root, 'docs', 'manual', 'v1', 'page.md'), '# Page')
  writeFileSync(join(root, 'docs', 'manual', 'v1-private', 'secret.md'), 'secret')
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('manual file access stays inside the manual folder', () => {
  it('reads a page of the manual', async () => {
    const { readManualPage } = await import('../../main/manual')
    expect(readManualPage('page.md')).toBe('# Page')
  })
  it('refuses ../ out of the manual', async () => {
    const { readManualPage } = await import('../../main/manual')
    expect(readManualPage('../../../package.json')).toBeNull()
  })
  it('refuses a sibling folder whose name starts with the same characters', async () => {
    const { readManualPage } = await import('../../main/manual')
    expect(readManualPage('../v1-private/secret.md')).toBeNull()
  })
})
