import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// The two output windows' titles (seen in the Windows taskbar and Alt-Tab, and in Mission Control) said "Output" and "Stage View";
// everywhere else they are the Congregation screen and the Stage monitor.
const root = join(__dirname, '../../..')
const read = (f: string): string => readFileSync(join(root, f), 'utf8')

describe('output window titles use the app\'s own names', () => {
  it('projection window: BORN — Congregation screen', () => {
    expect(read('src/renderer/projection.html')).toMatch(/<title>BORN — Congregation screen<\/title>/)
    expect(read('src/main/index.ts')).toMatch(/title: 'BORN — Congregation screen'/)
  })
  it('stage window: BORN — Stage monitor', () => {
    expect(read('src/renderer/stage.html')).toMatch(/<title>BORN — Stage monitor<\/title>/)
    expect(read('src/main/index.ts')).not.toMatch(/Stage View'/)
    expect(read('src/main/index.ts')).not.toMatch(/'BORN — Output'/)
  })
})
