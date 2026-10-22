// @vitest-environment jsdom
/**
 * Phone-remote page behaviour that the real APP_JS / APP_CSS source must keep (evaluated the same way remoteCmd.test.ts does).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { APP_JS, APP_CSS } from '../../main/remoteAssets'

const css = APP_CSS.replace(/\r\n/g, '\n')
const rule = (sel: string): string => {
  const i = css.indexOf('\n' + sel + '{')
  return i < 0 ? '' : css.slice(i, css.indexOf('}', i) + 1)
}

describe('remote search boxes', () => {
  it('show a visible focus ring when the cursor is in them', () => {
    expect(css).toMatch(/\.searchbox:focus-within\{[^}]*box-shadow:/)
  })
  it('use 16px text so a phone does not zoom in on focus', () => {
    expect(rule('.searchbox input')).toMatch(/font-size:16px/)
  })
})

describe('remote A–Z strip', () => {
  it('has letters an easy 44px touch target', () => {
    const b = rule('.azstrip button')
    expect(b).toMatch(/width:44px/)
    expect(b).toMatch(/height:44px/)
  })
})
