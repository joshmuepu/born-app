import { describe, it, expect } from 'vitest'
import { searchCyberHymnal, extractSlides, extractAuthor } from '../../main/cyberHymnal'

describe('searchCyberHymnal', () => {
  it('returns nothing for an empty query without making a request', async () => {
    expect(await searchCyberHymnal('')).toEqual([])
  })
})

// Real markup fetched from http://www.hymntime.com/tch/htm/a/m/a/z/amazing_grace.htm
// while researching this feature — a plain hymn, no chorus, and (unlike
// Hymnary) no verse numbers at all in the text itself.
const AMAZING_GRACE_HTML = `
<div class="lyrics-text mc-medium">
<p>Amazing grace! How sweet the sound<br>
That saved a wretch like me!<br>
I once was lost, but now am found;<br>
Was blind, but now I see.</p>
<p>’Twas grace that taught my heart to fear,<br>
And grace my fears re­lieved;<br>
How pre­cious did that grace ap­pear<br>
The hour I first be­lieved!</p>
</div>
</section>
`

// Real markup fetched from
// http://www.hymntime.com/tch/htm/b/l/e/s/s/e/blesseda.htm — exercises the
// bare "Refrain" repeat-marker convention: the chorus text is written out
// once, then every later occurrence is just the word "Refrain" in a
// class="chorus" <p>, meaning the real chorus text has to be remembered and
// re-inserted, not the literal word "Refrain" put on screen.
const BLESSED_ASSURANCE_HTML = `
<div class="lyrics-text mc-medium">
<p>Blessèd as­sur­ance, Je­sus is mine!<br>
O what a fore­taste of glo­ry di­vine!</p>
<p class="chorus">Refrain</p>
<p class="chorus">This is my sto­ry, this is my song,<br>
Praising my Sav­ior, all the day long;</p>
<p>Perfect sub­mis­sion, per­fect de­light,<br>
Visions of rap­ture now burst on my sight;</p>
<p class="chorus">Refrain</p>
</div>
</section>
`

describe('extractSlides', () => {
  it('collapses the site\'s literal \\r\\n after every <br> instead of leaving a doubled blank line between every lyric line', () => {
    // Confirmed live on the real Amazing Grace page: hymntime.com's own HTML
    // source has a literal CRLF right after every <br>, which — left alone —
    // lands directly behind the \n the <br>-to-newline conversion already
    // inserted, doubling into \n\n between every single line rather than
    // just between verses.
    const html = '<div class="lyrics-text mc-medium">\n<p>Line one<br>\r\nLine two<br>\r\nLine three</p>\n</div>\n</section>\n'
    const slides = extractSlides(html)
    expect(slides).toHaveLength(1)
    expect(slides[0].text).toBe('Line one\nLine two\nLine three')
  })

  it('splits plain, unnumbered stanzas into sequential verse slides', () => {
    const slides = extractSlides(AMAZING_GRACE_HTML)
    expect(slides).toHaveLength(2)
    expect(slides[0]).toEqual({ label: 'Verse 1', text: expect.stringContaining('Amazing grace') })
    expect(slides[1].label).toBe('Verse 2')
    // The site's own soft-hyphen line-wrap hints must never leak into the text.
    expect(slides[0].text).not.toMatch(/­/)
  })

  it('turns the first "Refrain" marker into the real chorus, and expands every later bare repeat', () => {
    const slides = extractSlides(BLESSED_ASSURANCE_HTML)
    const labels = slides.map((s) => s.label)
    expect(labels).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Chorus'])
    expect(slides[1].text).toContain('This is my story')
    expect(slides[3].text).toBe(slides[1].text) // the expanded repeat matches the original chorus verbatim
    expect(slides[1].text).not.toBe('Refrain') // the bare marker word itself never becomes slide text
  })

  it('returns no slides when the lyrics section is missing', () => {
    expect(extractSlides('<html><body>nothing here</body></html>')).toEqual([])
  })
})

describe('extractAuthor', () => {
  it('reads the author out of the real <meta name="description"> shape', () => {
    expect(extractAuthor('Words: Fanny Crosby, 1873. Music: Phoebe Knapp.')).toBe('Fanny Crosby')
    expect(extractAuthor('Words: John Newton, 1779. Music: 19th Century American tune.')).toBe('John Newton')
  })

  it('is undefined when there is no "Words:" credit', () => {
    expect(extractAuthor('Music: Traditional.')).toBeUndefined()
  })
})
