/**
 * Runs the phone page's own script (APP_JS) in jsdom with its real page body, against a faked computer: `fetch` answers /state from a
 * state object the test controls and records every /command. Every top-level function of the page is put on window, so the inline
 * onclick="…" handlers it draws work as they do in a browser. Used by the phone page tests; not a test itself.
 */
import { vi } from 'vitest'
import { APP_JS, buildAppBody } from '../../main/remoteAssets'

export interface FakeComputer {
  state: Record<string, unknown>
  commands: Array<Record<string, unknown>>
  /** answer for a /command: a status, or a function returning a Response promise (to delay or drop it) */
  answer: number | ((body: Record<string, unknown>, signal?: AbortSignal) => Promise<Response>)
  /** /state answers with this status, or fails like a dropped network when false */
  stateOk: boolean
}

export type Page = Record<string, (...a: unknown[]) => unknown> & { state: Record<string, unknown> }

export function song(id: string, title: string, pages: number): Record<string, unknown> {
  return {
    id, title, kind: 'song', subtitle: title, slideCount: pages, played: false,
    slides: Array.from({ length: pages }, (_, i) => ({ text: `${title} page ${i + 1}`, label: `Verse ${i + 1}` }))
  }
}

export function loadPhonePage(o: { wide?: boolean; state?: Record<string, unknown> } = {}): { page: Page; computer: FakeComputer } {
  document.body.innerHTML = buildAppBody()
  const computer: FakeComputer = {
    state: o.state ?? { queue: [], activeIndex: null, activeSlide: 0, blanked: false, bibleTranslation: 'KJV', onScreen: null },
    commands: [],
    answer: 204,
    stateOk: true
  }
  window.matchMedia = ((q: string) => ({ matches: /min-width: 768px/.test(q) ? !!o.wide : false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  global.fetch = vi.fn((url: string, init?: RequestInit) => {
    if (String(url).startsWith('/state')) {
      if (!computer.stateOk) return Promise.reject(new TypeError('network'))
      return Promise.resolve(new Response(JSON.stringify(computer.state), { status: 200 }))
    }
    if (url === '/command') {
      const body = JSON.parse(String(init?.body ?? '{}'))
      computer.commands.push(body)
      const a = computer.answer
      return typeof a === 'function' ? a(body, init?.signal ?? undefined) : Promise.resolve(new Response(null, { status: a }))
    }
    return Promise.resolve(new Response('[]', { status: 200 }))
  }) as unknown as typeof fetch
  const names = [...new Set([...APP_JS.matchAll(/^function ([A-Za-z_$][\w$]*)\(/gm)].map((m) => m[1]))]
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const api = new Function(`${APP_JS}\nreturn { state: state, ${names.map((n) => `${n}: ${n}`).join(', ')} };`)() as Page
  Object.assign(window, api)
  return { page: api, computer }
}

/** let the page's own promise chains and short timers run */
export async function settle(ms = 1600): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
}

/** a tap, run the way a browser runs an inline onclick="…" (jsdom does not run them itself) */
export function tap(el: Element | null | undefined): void {
  if (!el) throw new Error('nothing to tap')
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(el.getAttribute('onclick') ?? '').call(el)
}

export function sheetOpen(): boolean {
  return document.getElementById('sheetOverlay')!.classList.contains('active')
}
