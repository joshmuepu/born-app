import { describe, it, expect } from 'vitest'
import { APP_CSS, APP_JS, buildAppBody } from '../../main/remoteAssets'

// The phone page's tabs and captions were 9 to 11 px. Nothing on it is under 12 px now; its drawn sizes are measured on phones and
// iPads in Chromium and WebKit by scripts/qa/remote-viewports.cjs.
describe('phone page text is at least 12 px', () => {
  it('no font size under 12 px in the page or the parts it draws', () => {
    const sizes = [...`${APP_CSS}\n${buildAppBody()}\n${APP_JS}`.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => parseFloat(m[1]))
    expect(sizes.length).toBeGreaterThan(20)
    expect(sizes.filter((s) => s < 12)).toEqual([])
  })
})
