import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// The last places where the phone, the app and the Help pages used different words for the same thing.
const root = join(__dirname, '../../..')
const read = (p: string): string => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n')
const phone = read('src/main/remoteAssets.ts')
const app = read('src/renderer/src/App.tsx')
const manual = readdirSync(join(root, 'docs/manual/v1'), { recursive: true }).filter((f) => String(f).endsWith('.md')).map((f) => read(join('docs/manual/v1', String(f)))).join('\n')

describe('one set of words', () => {
  it('the phone marks the live item "On screen" and a hidden one "Hidden from screen", like the app', () => {
    expect(phone).not.toContain('ON SCREEN NOW')
    expect(phone).not.toContain("(blanked ? 'HIDDEN' :")
    expect(phone).not.toContain('send this live')
  })
  it('the phone calls its recent lists Recently Played and its Save "Save this service", like the app', () => {
    expect(phone).not.toContain('<span>Recent</span>')
    expect(phone).not.toContain('<span>RECENT</span>')
    expect(phone).not.toContain('Save this queue')
  })
  it('the update links are capitalised like every other button, and there is no Linux text', () => {
    expect(app).not.toMatch(/`restart to update to|`update to \$|>\s*check for updates\s*</)
    expect(app).not.toContain('AppImage')
  })
  it('the remote connection check says "no answer" the same way on screen and in the copied text', () => {
    expect(read('src/renderer/src/components/RemotePanel.tsx')).not.toContain('NO ANSWER')
  })
  it('Help names the Service Queue panel the way its heading does, and uses no term the app never shows', () => {
    expect(manual).not.toMatch(/Service queue\b/)
    expect(manual).not.toMatch(/[Cc]onfidence[ -]monitor/)
    expect(manual).toContain('Restart here')
  })
})
