import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Both update-banner buttons open the same release download page; one said "Get it from the website", which it is not.
describe('the update banner names its download button one way', () => {
  it('Open download page, both times', () => {
    const app = readFileSync(join(__dirname, '../../../src/renderer/src/App.tsx'), 'utf8')
    expect(app).not.toMatch(/Get it from the website/)
    expect(app.match(/Open download page/g)?.length).toBe(2)
  })
})
