import { describe, it, expect } from 'vitest'
import { paragraphsOfSections, splitIsSafe, stripHtml } from '../../main/utils'

// The Table's section HTML, in its real shape (one <p> per paragraph, the number in <span class="pn">), with placeholder words.
const P = (n: number | null, words: string, cls = 'normal_pn'): string =>
  `<p class="${cls}"><span class="first st" id="x">${n !== null ? `<span class="pn">${n}</span> ` : ''}${words}</span></p>`

describe("one row per paragraph, from The Table's own paragraph marks", () => {
  it('a section holding several numbered paragraphs becomes one row each, numbered by the source', () => {
    const rows = paragraphsOfSections([{ ref: '2-3', html: P(2, 'Alpha opens.') + P(3, 'Bravo follows.') }])
    expect(rows.map((r) => [r.ref, r.text])).toEqual([['2', '2 Alpha opens.'], ['3', '3 Bravo follows.']])
  })
  it('the opening paragraph (its number is a symbol in the source) takes the section\'s number', () => {
    const rows = paragraphsOfSections([{ ref: '1', html: P(null, ' Thank you, friends.', 'first_par normal') }, { ref: '2', html: P(2, 'Next one.') }])
    expect(rows.map((r) => r.ref)).toEqual(['1', '2'])
  })
  it('a paragraph the source split across two sections at an interjection is joined back into one', () => {
    const rows = paragraphsOfSections([{ ref: '5', html: P(5, 'He said this,') }, { ref: '5', html: P(null, '[Someone answers.—Ed.] and he went on.', 'normal') }, { ref: '6', html: P(6, 'Then more.') }])
    expect(rows.map((r) => [r.ref, r.text])).toEqual([['5', '5 He said this, [Someone answers.—Ed.] and he went on.'], ['6', '6 Then more.']])
  })
  it('words before the first numbered paragraph stay, as an unnumbered lead-in', () => {
    const rows = paragraphsOfSections([{ ref: '1', html: P(null, '…continuing from the tape.', 'normal') + P(1, 'The first paragraph.') }])
    expect(rows.map((r) => r.ref)).toEqual(['', '1'])
  })
  it('the title line is kept as it is, and nothing is lost: every word of the sections is in the rows, in order', () => {
    const sections = [{ ref: 'header', html: '<p>A Sample Message 99-0101M Somewhere</p>' }, { ref: '1-2', html: P(1, 'One &amp; two.') + P(2, 'Three.') }, { ref: '2', html: P(null, 'Four.', 'normal') }]
    const rows = paragraphsOfSections(sections)
    expect(rows[0]).toMatchObject({ ref: 'header', text: 'A Sample Message 99-0101M Somewhere' })
    expect(rows.map((r) => r.text).join(' ')).toBe(sections.map((s) => stripHtml(s.html)).join(' '))
  })
})

describe('a section without any <p>', () => {
  it('is one row, never counted twice', () => {
    const rows = paragraphsOfSections([{ ref: 'p1', html: 'Plain text with no paragraph markup.' }])
    expect(rows.map((r) => [r.ref, r.text])).toEqual([['p1', 'Plain text with no paragraph markup.']])
  })
})

describe('a sermon that opens with a lettered lead-in (1b, 1c …) before its real paragraph 1', () => {
  // the source's shape for e.g. 53-0613: the opening <p> and the lettered parts carry no plain number, then paragraph 1 starts
  const sections = [
    { ref: 'header', html: '<p>A Sample Message 99-0101 Somewhere</p>' },
    { ref: '1', html: P(null, 'Opening words.', 'first_par normal') + `<p class="normal_pn"><span class="first st"><span class="pn">1b</span> Lead-in part two.</span></p>` },
    { ref: '1', html: `<p class="normal_pn"><span class="first st"><span class="pn">1c</span> Lead-in part three.</span></p>` },
    { ref: '1', html: P(1, 'The real first paragraph.') + P(2, 'The second.') }
  ]
  it('the lead-in stays unnumbered, so there is exactly one paragraph 1', () => {
    const rows = paragraphsOfSections(sections)
    expect(rows.map((r) => r.ref)).toEqual(['header', '', '1', '2'])
  })
  it('and nothing is lost', () => {
    expect(paragraphsOfSections(sections).map((r) => r.text).join(' ')).toBe(sections.map((s) => stripHtml(s.html)).join(' '))
  })
})

describe('a split that cannot be trusted keeps the sermon as the source sections it', () => {
  it('splitIsSafe: numbers unique and in order, and every word kept', () => {
    const sections = [{ ref: '1-2', html: P(1, 'One.') + P(2, 'Two.') }]
    expect(splitIsSafe(paragraphsOfSections(sections), sections)).toBe(true)
    expect(splitIsSafe([{ ref: '2', index: 0, text: '2 Two.' }, { ref: '1', index: 1, text: '1 One.' }], sections)).toBe(false)
    expect(splitIsSafe([{ ref: '1', index: 0, text: '1 One.' }, { ref: '1', index: 1, text: '2 Two.' }], sections)).toBe(false)
    expect(splitIsSafe([{ ref: '1', index: 0, text: '1 One.' }], sections)).toBe(false)
  })
})
