import { describe, it, expect } from 'vitest'
import { extractCopyright, extractTitle, extractAuthor, extractSlides, decodeEntities } from '../../main/hymnary'

// Real markup fetched from https://hymnary.org/text/amazing_grace_how_sweet_the_sound
// while researching this feature — a plain, no-chorus hymn, the common case.
const AMAZING_GRACE_HTML = `
<meta property="og:title" content="Amazing grace! (how sweet the sound)" />
<div class='authority_section' id='at_fulltext'><h2 id='fulltexts'>Representative Text</h2><div property='text'><div class="authority_columns"><p>1 Amazing grace (how sweet the sound)<br />
that saved a wretch like me!<br />
I once was lost, but now am found,<br />
was blind, but now I see.<br />
</p><p>2 'Twas grace that taught my heart to fear,<br />
and grace my fears relieved;<br />
how precious did that grace appear<br />
the hour I first believed!<br />
</p><p>Ancient & Modern, 2013</div></div><div class="authority_bottom_bar"><a href="/text/amazing_grace_how_sweet_the_sound/fulltexts">All representative texts</a></div>
<h2 id="Author">Author: <span property="name">John Newton</span></h2>
<tr class="result-row"><td valign="top">
            <span class="hy_infoLabel">Copyright:</span></td>
            <td><span class="hy_infoItem">Public Domain</span></td></tr>
`

// Real markup fetched from https://hymnary.org/text/blessed_assurance_jesus_is_mine —
// exercises the Refrain: block and the [Refrain] inline-repeat marker.
const BLESSED_ASSURANCE_HTML = `
<meta property="og:title" content="Blessed assurance, Jesus is mine!" />
<div class='authority_section' id='at_fulltext'><h2 id='fulltexts'>Representative Text</h2><div property='text'><div class="authority_columns"><p>1 Blessed assurance, Jesus is mine! <br />
O, what a foretaste of glory divine!<br />
Heir of salvation, purchase of God, <br />
born of His Spirit, washed in His blood.<br />
</p><p>Refrain:<br />
This is my story, this is my song, <br />
praising my Savior all the day long;<br />
</p><p>2 Perfect submission, perfect delight, <br />
visions of rapture now burst on my sight; [Refrain]<br />
</p><p>Source: <a href="/hymn/OGRP2022/570">Our Great Redeemer's Praise #570</a></div></div><div class="authority_bottom_bar">
<span class="hy_infoLabel">Copyright:</span></td>
            <td><span class="hy_infoItem">Public Domain</span></td></tr>
`

// A same-shaped fragment for a hymn that ISN'T public domain — this is the
// case the hard filter exists for (confirmed live against a real search hit:
// "Amazing Grace (My Chains Are Gone)" is Chris Tomlin's arrangement and
// shows up in search results for "amazing grace" right alongside the real
// public-domain hymn).
const COPYRIGHTED_HTML = `
<meta property="og:title" content="Amazing Grace (My Chains Are Gone)" />
<div class='authority_section' id='at_fulltext'><h2 id='fulltexts'>Representative Text</h2><div property='text'><div class="authority_columns"><p>1 Amazing grace, how sweet the sound<br />
</p></div></div><div class="authority_bottom_bar">
<span class="hy_infoLabel">Copyright:</span></td>
            <td><span class="hy_infoItem">© 2006 Thankyou Music</span></td></tr>
`

describe('extractCopyright', () => {
  it('reads "Public Domain" from the real field shape', () => {
    expect(extractCopyright(AMAZING_GRACE_HTML)).toBe('Public Domain')
  })
  it('reads a real copyright holder when the hymn is not public domain', () => {
    expect(extractCopyright(COPYRIGHTED_HTML)).toBe('© 2006 Thankyou Music')
  })
  it('returns null when the field is missing entirely', () => {
    expect(extractCopyright('<html><body>no copyright field here</body></html>')).toBeNull()
  })
})

describe('extractTitle / extractAuthor', () => {
  it('reads the title from og:title, decoded', () => {
    expect(extractTitle(AMAZING_GRACE_HTML)).toBe('Amazing grace! (how sweet the sound)')
  })
  it('reads the author name', () => {
    expect(extractAuthor(AMAZING_GRACE_HTML)).toBe('John Newton')
  })
  it('is undefined when there is no author section', () => {
    expect(extractAuthor(BLESSED_ASSURANCE_HTML)).toBeUndefined()
  })
})

describe('extractSlides', () => {
  it('splits numbered verses into labeled slides and drops the trailing citation', () => {
    const slides = extractSlides(AMAZING_GRACE_HTML)
    expect(slides).toHaveLength(2)
    expect(slides[0]).toEqual({ label: 'Verse 1', text: expect.stringContaining('Amazing grace') })
    expect(slides[0].text).not.toMatch(/^1\s/) // the leading verse number is stripped, not left in the text
    expect(slides[1].label).toBe('Verse 2')
    // "Ancient & Modern, 2013" (the hymnal citation) must never become a slide.
    expect(slides.some((s) => /Ancient & Modern/.test(s.text))).toBe(false)
  })

  it('turns a Refrain: block into its own Chorus slide, and expands [Refrain] into the real words again', () => {
    const slides = extractSlides(BLESSED_ASSURANCE_HTML)
    const labels = slides.map((s) => s.label)
    // Verse 1, Chorus, Verse 2, Chorus (expanded from the [Refrain] tag) — a
    // live projection needs the actual chorus words every time, not a
    // bracket only a reader would understand.
    expect(labels).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Chorus'])
    expect(slides[1].text).toContain('This is my story')
    expect(slides[3].text).toBe(slides[1].text) // the expanded repeat matches the original chorus verbatim
    expect(slides[2].text).not.toMatch(/\[Refrain\]/i) // the bracket tag itself never leaks into slide text
    // The trailing "Source: ..." credit must never become a slide.
    expect(slides.some((s) => /Source:/.test(s.text))).toBe(false)
  })

  it('returns no slides when the representative-text section is missing', () => {
    expect(extractSlides('<html><body>nothing here</body></html>')).toEqual([])
  })
})

describe('decodeEntities', () => {
  it('decodes the entities actually seen in real Hymnary.org pages', () => {
    expect(decodeEntities('Grace &amp; Peace')).toBe('Grace & Peace')
    expect(decodeEntities('rock&#39;s')).toBe('rock’s')
    expect(decodeEntities('&hellip;')).toBe('…')
  })
})
