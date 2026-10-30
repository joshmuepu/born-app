/**
 * The phone remote on small and sideways screens (found by scripts/qa/remote-viewports.cjs, which loads the real page in WebKit and
 * Chromium at 7 phone and tablet sizes). These pin the CSS that keeps it usable; the script is the full check.
 */
import { describe, it, expect } from 'vitest'
import { APP_CSS } from '../../main/remoteAssets'

const css = APP_CSS.replace(/\r\n/g, '\n')
const block = (head: string): string => {
  const i = css.indexOf(head)
  if (i < 0) return ''
  let depth = 0
  for (let j = css.indexOf('{', i); j < css.length; j++) {
    if (css[j] === '{') depth++
    else if (css[j] === '}' && --depth === 0) return css.slice(i, j + 1)
  }
  return ''
}

describe('a narrow phone (iPhone SE or a small Android at 150% page zoom)', () => {
  it('Prev, Next and Blank share the width instead of pushing Blank off the edge', () => {
    expect(block('.transport button{')).toMatch(/min-width:0/)
    const narrow = block('@media (max-width: 340px)')
    expect(narrow).toMatch(/\.transport\{[^}]*gap:/)
    expect(narrow).toMatch(/\.transport button svg\{display:none\}/)
  })
})

describe('a phone held sideways (phone layout, under 768px wide and under 500px tall)', () => {
  it('the bars give back height so the song list is more than a sliver', () => {
    const land = block('@media (max-width: 767px) and (max-height: 500px) and (orientation: landscape)')
    expect(land).toMatch(/\.transport button\{[^}]*min-height:44px/)
    expect(land).toMatch(/\.tab\{[^}]*flex-direction:row/)
    expect(land).toMatch(/\.searchbox\{[^}]*padding:/)
    expect(land).toMatch(/\.songlist\{[^}]*overflow:visible/)
  })

  // an iPhone SE held upright at 150% page zoom is 250x445: under 500px tall too, but upright. With the sideways layout its tabs put
  // each icon beside its label, the four no longer fit and Songs sat off the right edge
  it('only applies sideways, so an upright small phone at 150% keeps all four tabs on screen', () => {
    expect(css).not.toMatch(/@media \(max-width: 767px\) and \(max-height: 500px\)\{/)
  })
})

describe('a notched iPhone held sideways', () => {
  // the page asks for the whole screen (viewport-fit=cover), so the left and right insets have to be kept clear by the page itself
  it('the app, the bottom sheets and the Home Screen sheet stay clear of the notch on both sides', () => {
    for (const sel of ['#app{', '.sheet-overlay{', '.a2hs-overlay{']) {
      expect(block(sel)).toMatch(/padding-left:env\(safe-area-inset-left,0px\)/)
      expect(block(sel)).toMatch(/padding-right:env\(safe-area-inset-right,0px\)/)
    }
  })
})

describe('tap targets', () => {
  // measured under 44px by the viewport sweep: book chips 39, song rows 39, My list 34, recent chips 36, scope pill 29,
  // Clear / View all 19, Skip for now 23, Go 31 wide at 150% zoom, Prev/Next 36 on a sideways phone in the two-column layout
  it('every one is at least 44px tall', () => {
    for (const sel of ['.book-chip{', '.song-row{', '.draft-pill{', '.recent-item{', '.scope-pill{', '.recent-clear{', '.qstrip-row .viewall{', '.a2hs .btn-skip,.role-banner-card .btn-skip{']) {
      expect(block(sel), sel).toMatch(/min-height:44px/)
    }
    expect(block('.gobtn{')).toMatch(/flex-shrink:0/)
    expect(block('.gobtn{')).toMatch(/min-height:44px/) // Go was 37px tall on a sideways phone, where the search box is slimmer
    expect(block('@media (min-width: 768px) and (max-height: 500px)')).toMatch(/\.transport-inline button\{[^}]*min-height:44px/)
  })
})
