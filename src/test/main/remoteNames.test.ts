/**
 * The phone remote uses the same names as the desktop app and the Help pages for the same controls:
 * Hide screen / Show screen (it said Blank / Restore), Back (Prev), + Queue (Add to Queue), My list (My List).
 */
import { describe, it, expect } from 'vitest'
import { APP_JS, buildAppBody } from '../../main/remoteAssets'

const body = buildAppBody()
const btn = (id: string): string => (body.match(new RegExp(`<button[^>]*id="${id}"[^>]*>([\\s\\S]*?)</button>`)) || [])[1] || ''

describe('remote control names', () => {
  it('the hide button says Hide screen, and Show screen while hidden', () => {
    expect(btn('blank-p')).toBe('Hide screen')
    expect(btn('blank-t')).toBe('Hide screen')
    expect(APP_JS).toMatch(/state\.qs\.blanked \? 'Show screen' : 'Hide screen'/)
    expect(APP_JS).not.toMatch(/'Restore'/)
  })
  it('the back button says Back', () => {
    expect(btn('prev-p')).toMatch(/<span>Back<\/span>/)
    expect(APP_JS).not.toMatch(/>Prev</)
  })
  it('the add buttons say + Queue and Add to My list', () => {
    expect(APP_JS).not.toMatch(/Add to Queue/)
    expect(APP_JS).toMatch(/\+ Queue<\/button>/)
    expect(APP_JS).toMatch(/Add to My list<\/button>/)
  })
  it('both "could not reach BORN" messages are written the same way', () => {
    expect(APP_JS).not.toMatch(/reach BORN - /)
  })
})
