import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseSong, detectFormat, titleFromFilename } from '../../main/songParsers'
import { rtfToText } from '../../main/songParsers/rtfToText'

const FX = join(__dirname, '../fixtures/songs')
const read = (f: string) => readFileSync(join(FX, f))

describe('detectFormat', () => {
  it('classifies by extension + content', () => {
    expect(detectFormat('x.pro', '\n\x08\x01\x12')).toBe('propresenter7')
    expect(detectFormat('x.xml', '<?xml?><song xmlns="http://openlyrics.info/">')).toBe('openlyrics')
    expect(detectFormat('x.xml', '<song><title>a</title><lyrics>[V1]\n hi</lyrics></song>')).toBe('opensong')
    expect(detectFormat('x.cho', '{title: A}')).toBe('chordpro')
    expect(detectFormat('x.txt', 'Just some lyrics')).toBe('plaintext')
  })
})

describe('titleFromFilename', () => {
  it('drops a trailing key + the extension', () => {
    expect(titleFromFilename('This Little Light Of Mine - G.pro')).toBe('This Little Light Of Mine')
    expect(titleFromFilename('As We Gather - Eb.pro')).toBe('As We Gather')
    expect(titleFromFilename('Doxology.txt')).toBe('Doxology')
  })
})

describe('rtfToText', () => {
  it('strips control words + tables and keeps line breaks', () => {
    const rtf =
      "{\\rtf1\\ansi{\\fonttbl\\f0\\fswiss Arial;}\\f0\\fs170 \\cf2 This little light of mine,\\\nI'm going to let it shine.\\\n}"
    expect(rtfToText(rtf)).toBe("This little light of mine,\nI'm going to let it shine.")
  })
  it('decodes \\\x27xx escapes', () => {
    expect(rtfToText("{\\rtf1 don\\'92t}")).toBe('don’t')
  })
})

describe('parseSong — real ProPresenter 7 files', () => {
  it('little-light.pro → clean lyrics, one slide per verse, labelled', () => {
    const r = parseSong('This Little Light Of Mine - G.pro', read('little-light.pro'))
    expect('error' in r).toBe(false)
    if ('error' in r) return
    expect(r.format).toBe('propresenter7')
    expect(r.song.title).toBe('This Little Light Of Mine')
    expect(r.song.slides.length).toBeGreaterThanOrEqual(4)
    // each verse is its own slide, not one merged blob
    expect(r.song.slides[0].text).toContain('This little light of mine')
    expect(r.song.slides[0].text).not.toContain('Hide it under a bushel')
    expect(r.song.slides.map((s) => s.label)).toEqual(
      r.song.slides.map((_, i) => `Verse ${i + 1}`)
    )
    const all = r.song.slides.map((s) => s.text).join('\n').toLowerCase()
    expect(all).not.toMatch(/\\rtf|fonttbl|\\cf\d/)
  })

  it('to-god-be-glory.pro → keeps a named "Chorus" section', () => {
    const r = parseSong('To God Be the Glory - G.pro', read('to-god-be-glory.pro'))
    if ('error' in r) throw new Error(r.error)
    expect(r.song.slides.some((s) => s.label === 'Chorus')).toBe(true)
    expect(r.song.slides[0].label).toBe('Verse 1')
  })

  it('moves the song key out of the lyric text into song.songKey', () => {
    // fixture filenames carry the key: "This Little Light Of Mine - G.pro"
    const r = parseSong('This Little Light Of Mine - G.pro', read('little-light.pro'))
    if ('error' in r) throw new Error(r.error)
    expect(r.song.songKey).toBe('G')
    for (const s of r.song.slides) {
      expect(s.text.trim()).not.toMatch(/(^|\n)\s*[A-G][#b]?m?\s*$/)
    }
    const r2 = parseSong('As We Gather - Eb.pro', read('as-we-gather.pro'))
    if ('error' in r2) throw new Error(r2.error)
    expect(r2.song.songKey).toBe('Eb')
  })

  it('as-we-gather.pro', () => {
    const r = parseSong('As We Gather - Eb.pro', read('as-we-gather.pro'))
    if ('error' in r) throw new Error(r.error)
    expect(r.song.slides.join?.length ?? r.song.slides.length).toBeGreaterThan(0)
    expect(r.song.slides.map((s) => s.text).join(' ').toLowerCase()).toContain('as we gather')
  })
})

describe('parseSong — openLyrics', () => {
  it('amazing-grace.xml', () => {
    const r = parseSong('amazing-grace.xml', read('amazing-grace.xml'))
    if ('error' in r) throw new Error(r.error)
    expect(r.format).toBe('openlyrics')
    expect(r.song.title).toBe('Amazing Grace')
    expect(r.song.author).toBe('John Newton')
    expect(r.song.songKey).toBe('G')
    expect(r.song.ccli).toBe('22025')
    expect(r.song.slides).toHaveLength(3)
    expect(r.song.slides[0].label).toBe('Verse 1')
    expect(r.song.slides[0].text).toBe('Amazing grace how sweet the sound\nThat saved a wretch like me')
    expect(r.song.slides[2].label).toBe('Chorus')
  })
})

describe('parseSong — openSong', () => {
  it('blessed-assurance.xml', () => {
    const r = parseSong('blessed-assurance.xml', read('blessed-assurance.xml'))
    if ('error' in r) throw new Error(r.error)
    expect(r.format).toBe('opensong')
    expect(r.song.title).toBe('Blessed Assurance')
    expect(r.song.author).toBe('Fanny Crosby')
    expect(r.song.slides[0].label).toBe('Verse 1')
    expect(r.song.slides[0].text).toContain('Blessed assurance, Jesus is mine')
    expect(r.song.slides[1].label).toBe('Chorus')
  })
})

describe('parseSong — chordPro', () => {
  it('how-great.cho — strips chords + reads directives', () => {
    const r = parseSong('how-great.cho', read('how-great.cho'))
    if ('error' in r) throw new Error(r.error)
    expect(r.format).toBe('chordpro')
    expect(r.song.title).toBe('How Great Thou Art')
    expect(r.song.author).toBe('Stuart K. Hine')
    expect(r.song.songKey).toBe('Bb')
    expect(r.song.slides[0].label).toBe('Verse 1')
    expect(r.song.slides[0].text).toContain('O Lord my God, when I in awesome wonder')
    expect(r.song.slides[0].text).not.toContain('[')
    expect(r.song.slides[1].label).toBe('Chorus')
  })
})

describe('parseSong — plain text', () => {
  it('doxology.txt — first line is the title', () => {
    const r = parseSong('Doxology.txt', read('doxology.txt'))
    if ('error' in r) throw new Error(r.error)
    expect(r.song.title).toBe('Doxology')
    expect(r.song.slides).toHaveLength(1)
    expect(r.song.slides[0].text).toContain('Praise God from whom all blessings flow')
  })
  it('trust-obey.txt — section labels', () => {
    const r = parseSong('Trust And Obey.txt', read('trust-obey.txt'))
    if ('error' in r) throw new Error(r.error)
    expect(r.song.title).toBe('Trust And Obey')
    expect(r.song.slides[0].label).toBe('Verse 1')
    expect(r.song.slides[1].label).toBe('Chorus')
  })
})

describe('parseSong — full Songs.zip corpus (if present)', () => {
  const corpus = join(__dirname, '../../../resources/songs-source/Songs')
  it('parses ≥95% of the bundled library', () => {
    let files: string[]
    try {
      files = readdirSync(corpus).filter((f) => f.toLowerCase().endsWith('.pro') && !f.startsWith('._'))
    } catch {
      return // corpus not unpacked in this environment — skip
    }
    if (files.length === 0) return
    let ok = 0
    for (const f of files) {
      const r = parseSong(f, readFileSync(join(corpus, f)))
      if (!('error' in r)) ok++
    }
    expect(ok / files.length).toBeGreaterThan(0.95)
  })
})
