import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { testHook } from '../../main/testHooks'

describe('BORN_TEST_* hooks', () => {
  const env = { BORN_TEST_PICK_PDF: 'C:\\x.pdf' } as NodeJS.ProcessEnv
  it('are honoured when not packaged', () => {
    expect(testHook('BORN_TEST_PICK_PDF', false, env)).toBe('C:\\x.pdf')
    expect(testHook('BORN_TEST_NOPE', false, env)).toBe('')
  })
  it('are ignored in a packaged app', () => {
    expect(testHook('BORN_TEST_PICK_PDF', true, env)).toBe('')
  })
  it('no main-process file reads BORN_TEST_* directly', () => {
    for (const f of ['mediaService.ts', 'index.ts', 'webRemote.ts']) {
      const src = readFileSync(join(__dirname, '../../main', f), 'utf8')
      expect(src.replace(/testHook\('BORN_TEST_[A-Z_]+'/g, '')).not.toMatch(/process\.env\.BORN_TEST_/)
    }
  })
})
