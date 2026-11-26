// @vitest-environment jsdom
/**
 * A tap that worked is never reported as failed, and a retry never moves the screen more than one page from what the person saw.
 * Runs the phone page's own script against a faked computer (see phonePage.ts).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadPhonePage, settle, song } from './phonePage'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const queue = [song('a', 'Morning Song', 6)]
const at = (slide: number, taps: string[] = []): Record<string, unknown> => ({
  queue, activeIndex: 0, activeSlide: slide, blanked: false, bibleTranslation: 'KJV',
  onScreen: { kind: 'song', text: `Morning Song page ${slide + 1}` }, pos: `p${slide}`, taps
})
const toast = (): string => (document.getElementById('toast')!.style.display === 'block' ? document.getElementById('toast')!.textContent ?? '' : '')
const nowText = (): string => document.querySelector('#queuePerfNow .now-text')?.textContent ?? ''
/** an answer that never comes: the request is only ended by the phone giving up */
const never = (_b: unknown, signal?: AbortSignal): Promise<Response> =>
  new Promise((_res, rej) => signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))

describe('a Next whose answer is late', () => {
  it('that the computer acted on: says nothing went wrong and shows the page really on screen', async () => {
    const { page, computer } = loadPhonePage({ state: at(1) })
    await page.poll()
    computer.answer = (b, signal) => { computer.state = at(2, [String(b.tap)]); return never(b, signal) }
    let failed = false, done = false
    ;(page.cmd('next') as Promise<unknown>).then(() => { done = true }, () => { failed = true })
    await settle(4000 + 300)
    expect(done).toBe(true)
    expect(failed).toBe(false)
    expect(toast()).not.toMatch(/couldn.t reach/i)
    expect(page.state.connOk).toBe(true)
    expect(nowText()).toContain('Morning Song page 3')
  })

  it('that never reached the computer: says so, and stays Connected because the computer answers', async () => {
    const { page, computer } = loadPhonePage({ state: at(1) })
    await page.poll()
    computer.answer = never
    let failed = false
    ;(page.cmd('next') as Promise<unknown>).catch(() => { failed = true })
    await settle(4300)
    expect(failed).toBe(true)
    expect(toast()).toMatch(/couldn.t reach born/i)
    expect(page.state.connOk).toBe(true)
    expect(nowText()).toContain('Morning Song page 2')
  })

  it('when the computer cannot be reached at all: says so and shows Reconnecting', async () => {
    const { page, computer } = loadPhonePage({ state: at(1) })
    await page.poll()
    computer.answer = never
    computer.stateOk = false
    let failed = false
    ;(page.cmd('next') as Promise<unknown>).catch(() => { failed = true })
    await settle(4300)
    expect(failed).toBe(true)
    expect(toast()).toMatch(/couldn.t reach born/i)
    expect(page.state.connOk).toBe(false)
  })

  it('an answer arriving after the phone gave up changes nothing more', async () => {
    const { page, computer } = loadPhonePage({ state: at(1) })
    await page.poll()
    let late: (r: Response) => void = () => {}
    computer.answer = (b, signal) => { computer.state = at(2, [String(b.tap)]); return new Promise((res, rej) => { late = res; signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))) }) }
    let outcomes = 0
    ;(page.cmd('next') as Promise<unknown>).then(() => outcomes++, () => outcomes++)
    await settle(4300)
    late(new Response(null, { status: 204 }))
    await settle(1000)
    expect(outcomes).toBe(1)
    expect(computer.commands.filter((c) => c.action === 'next')).toHaveLength(1)
    expect(toast()).not.toMatch(/couldn.t reach/i)
  })
})

describe('a Next or Back says where it was tapped', () => {
  it('carries the place the phone shows, and a tap id', async () => {
    const { page, computer } = loadPhonePage({ state: at(1) })
    await page.poll()
    await page.cmd('next')
    await page.cmd('prev')
    expect(computer.commands[0]).toMatchObject({ action: 'next', at: 'p1' })
    expect(computer.commands[1]).toMatchObject({ action: 'prev', at: 'p1' })
    expect(typeof computer.commands[0].tap).toBe('string')
    expect(computer.commands[0].tap).not.toBe(computer.commands[1].tap)
  })

  it('other taps carry no place', async () => {
    const { page, computer } = loadPhonePage({ state: at(1) })
    await page.poll()
    await page.cmd('blank')
    expect(computer.commands[0].at).toBeUndefined()
  })

  it('told that the screen moved on, it shows where the screen is, with no error', async () => {
    const { page, computer } = loadPhonePage({ state: at(1) })
    await page.poll()
    computer.state = at(3)
    computer.answer = () => Promise.resolve(new Response(JSON.stringify({ pos: 'p3' }), { status: 409 }))
    await page.cmd('next')
    await settle(100)
    expect(toast()).toBe('')
    expect(nowText()).toContain('Morning Song page 4')
    expect(page.state.connOk).toBe(true)
  })
})
