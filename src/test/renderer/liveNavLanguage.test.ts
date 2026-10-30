// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { fetchAdjacentSlide } from '../../renderer/src/liveNav'

// Next/Back keeps a session cache of each sermon's paragraphs. It was keyed by the sermon alone, so after a translated copy of a sermon
// had been used, Next from the English copy (or the other way round) projected the other language's paragraph: the paragraph numbers
// are the same. And an empty answer (no connection yet) was cached for the whole session, so Next stayed dead for that sermon.
const row = (ref: string, words: string, lang: string) => ({ text: `${ref} ${words}`, sermonTitle: 'S', dateCode: '99-0101M', sermonId: 7, paragraphIndex: Number(ref), paragraphRef: ref, language: lang })
const byLang: Record<string, ReturnType<typeof row>[]> = {
  en: [row('1', 'Placeholder one.', 'en'), row('2', 'Placeholder two.', 'en')],
  fr: [row('1', 'Texte un.', 'fr'), row('2', 'Texte deux.', 'fr')]
}
const at = (lang: string) => ({ kind: 'quote' as const, sermonId: 7, language: lang, paragraphRef: '1', page: 0 })

describe('Next/Back and translated sermons', () => {
  it('Next from the English copy shows the English next paragraph after the French copy was used', async () => {
    window.electronAPI.getSermonParagraphs = vi.fn(async (_id: number, lang: string) => byLang[lang]) as never
    const cache = new Map()
    const fr = await fetchAdjacentSlide(at('fr'), 'next', cache)
    expect(fr?.slide.text).toMatch(/Texte deux/)
    const en = await fetchAdjacentSlide(at('en'), 'next', cache)
    expect(en?.slide.text).toMatch(/Placeholder two/)
  })
  it('an empty answer is not kept: once the paragraphs can be read, Next works', async () => {
    let online = false
    window.electronAPI.getSermonParagraphs = vi.fn(async () => (online ? byLang.en : [])) as never
    const cache = new Map()
    expect(await fetchAdjacentSlide(at('en'), 'next', cache)).toBeNull()
    online = true
    expect((await fetchAdjacentSlide(at('en'), 'next', cache))?.slide.text).toMatch(/Placeholder two/)
  })
})
