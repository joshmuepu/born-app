// @vitest-environment jsdom
/**
 * First open of the phone remote on an iPhone: the "Who's this?" prompt and the "Add this to your Home Screen" sheet both opened, the
 * second on top of the first, covering the role buttons. The Home Screen sheet now waits until the prompt has been answered or skipped.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { APP_JS } from '../../main/remoteAssets'

const DOM = '<div id="toast"></div><div id="conn-p"><span class="connLabel"></span></div>' +
  '<div class="a2hs-overlay" id="a2hsOverlay"><div id="a2hsSteps"></div><button id="a2hsPrimary"></button><button id="a2hsSkip"></button></div>' +
  '<div class="role-banner active" id="roleOverlay"><div id="roleGrid"></div><button id="roleSkipBtn"></button></div>'

function load(): { showA2HS: (ios: boolean) => void; chooseRole: (l: string) => void } {
  document.body.innerHTML = DOM
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${APP_JS}\nreturn { showA2HS: showA2HS, chooseRole: chooseRole };`)() as never
}
const a2hsOpen = (): boolean => document.getElementById('a2hsOverlay')!.classList.contains('active')
afterEach(() => vi.useRealTimers())

describe('the Home Screen sheet and the "Who\'s this?" prompt', () => {
  it('the sheet does not open over the prompt, and opens once a role is chosen', () => {
    vi.useFakeTimers()
    const r = load()
    r.showA2HS(true)
    expect(a2hsOpen()).toBe(false)
    try { r.chooseRole('Operator') } catch { /* the rest of the page is not in this test DOM */ }
    vi.advanceTimersByTime(1000)
    expect(a2hsOpen()).toBe(true)
  })
  it('with no prompt showing, the sheet opens as before', () => {
    const r = load()
    document.getElementById('roleOverlay')!.classList.remove('active')
    r.showA2HS(true)
    expect(a2hsOpen()).toBe(true)
  })
})
