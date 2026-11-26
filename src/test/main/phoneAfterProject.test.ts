// @vitest-environment jsdom
/**
 * Projecting from a full page on the phone ends on the live view: the page closes, the Queue tab shows what is on screen, and Back,
 * Next and Hide screen can be reached. Runs the page's own script against a faked computer (see phonePage.ts).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadPhonePage, settle, sheetOpen, song, tap } from './phonePage'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const queue = [song('a', 'Morning Song', 3), song('b', 'Evening Song', 4), song('c', 'Long Song', 30)]
const live = (i: number, s: number): Record<string, unknown> => ({
  queue, activeIndex: i, activeSlide: s, blanked: false, bibleTranslation: 'KJV',
  onScreen: { kind: 'song', text: (queue[i].slides as Array<{ text: string }>)[s].text }
})

describe('a verse tapped on a queue item’s full page', () => {
  for (const wide of [false, true]) {
    for (const [what, before] of [
      ['nothing live', { ...live(0, 0), activeIndex: null, onScreen: null }],
      ['another song live', live(1, 2)],
      ['the same song live', live(0, 0)],
      ['a Bible verse live', { ...live(0, 0), activeIndex: null, onScreen: { kind: 'bible', text: 'In the beginning', reference: 'Genesis 1:1' } }]
    ] as const) {
      it(`${wide ? 'wide screen' : 'phone'}, ${what}: projects it, then shows the live view`, async () => {
        const { page, computer } = loadPhonePage({ wide, state: before })
        await page.poll(); await settle(100)
        page.openQueueItemDetail(0)
        const row = (wide ? document.getElementById('tabletPreview')! : document.getElementById('sheetBody')!).querySelectorAll('.slide-row')[1] as HTMLElement
        computer.state = live(0, 1)
        tap(row)
        await settle()
        expect(computer.commands.at(-1)).toMatchObject({ action: 'project-at', id: 'a', slide: 1 })
        expect(sheetOpen()).toBe(false)
        expect(page.state.tab).toBe('queue')
        expect(page.state.detailIndex).toBeNull()
        if (wide) expect(document.querySelector('#tabletPreview .preview-now')?.textContent).toContain('Morning Song page 2')
        else expect(document.querySelector('#queuePerfNow .now-text')?.textContent).toContain('Morning Song page 2')
      })
    }
  }

  it('a very long song: verse 25 goes live and the live view shows it', async () => {
    const { page, computer } = loadPhonePage({ state: live(0, 0) })
    await page.poll()
    page.openQueueItemDetail(2)
    computer.state = live(2, 24)
    tap(document.querySelectorAll('#sheetBody .slide-row')[24])
    await settle()
    expect(sheetOpen()).toBe(false)
    expect(document.querySelector('#queuePerfNow .now-text')?.textContent).toContain('Long Song page 25')
  })

  it('a tap that did not reach the computer leaves the page open', async () => {
    const { page, computer } = loadPhonePage({ state: live(0, 0) })
    await page.poll()
    page.openQueueItemDetail(1)
    computer.answer = 500
    tap(document.querySelectorAll('#sheetBody .slide-row')[0])
    await settle()
    expect(sheetOpen()).toBe(true)
  })
})
