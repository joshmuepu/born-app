import { describe, it, expect } from 'vitest'
import { parseSong } from '../../main/songParsers'
import { parseOpenLyrics } from '../../main/songParsers/openLyrics'
import { parsePlainText } from '../../main/songParsers/plainText'
import { parseProPresenter7 } from '../../main/songParsers/proPresenter7'
import { decodeEntities } from '../../main/hymnary'

// Invented songs only.

describe('OpenLyrics', () => {
  it('reads single-quoted verse names, <line> elements and numeric entities', () => {
    const xml = `<?xml version='1.0' encoding='UTF-8'?>
<song xmlns='http://openlyrics.info/namespace/2009/song' version='0.9'><properties><titles><title>Invented Hymn</title></titles></properties>
<lyrics><verse name='v1'><lines><line>It&#8217;s a placeholder line</line><line>Caf&#xE9; &amp;lt;two&amp;gt;</line></lines></verse>
<verse name="c"><lines>Chorus line one<br/>Chorus line two</lines></verse></lyrics></song>`
    const s = parseOpenLyrics(xml)
    expect(s.slides).toHaveLength(2)
    expect(s.slides[0].text).toBe('It’s a placeholder line\nCafé &lt;two&gt;')
  })
})

describe('entities decode in one pass', () => {
  it('"&amp;#39;" is the text "&#39;", not an apostrophe', () => {
    expect(decodeEntities('Rock &amp;#39; &#39; &amp;amp;')).toBe('Rock &#39; ’ &amp;')
    expect(decodeEntities('&#x2019; &#128512;')).toBe('’ 😀')
  })
})

describe('ProPresenter', () => {
  it('a damaged section falls back to the plain text in the file instead of failing the import', () => {
    // field 13 (a cue) whose bytes are a truncated 64-bit field, then readable RTF text further on
    const cue = Buffer.from([0x09, 0x01, 0x02])
    const rtf = Buffer.from('{\\rtf1\\ansi Placeholder words of a song}')
    const doc = Buffer.concat([Buffer.from([0x6a, cue.length]), cue, Buffer.from([0x6a, rtf.length]), rtf])
    expect(() => parseProPresenter7(doc, 'Invented Song')).not.toThrow()
  })
})

describe('plain text', () => {
  it('a one-line first verse that comes back later is words, not the title', () => {
    const s = parsePlainText('Hallelujah\n\nPlaceholder verse line one\nPlaceholder verse line two\n\nHallelujah', 'invented')
    expect(s.title).toBe('invented')
    expect(s.slides.map((x) => x.text)).toEqual(['Hallelujah', 'Placeholder verse line one\nPlaceholder verse line two', 'Hallelujah'])
  })
  it('a file of one line only is that line as words', async () => {
    const r = await parseSong('Invented Song.txt', Buffer.from('Hallelujah, hallelujah'))
    expect('song' in r && r.song.slides.map((x) => x.text)).toEqual(['Hallelujah, hallelujah'])
  })
  it('a title line followed by verses is still the title', () => {
    expect(parsePlainText('Invented Hymn\n\nPlaceholder verse line one\n\nPlaceholder verse line two').title).toBe('Invented Hymn')
  })
})
