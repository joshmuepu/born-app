// @vitest-environment jsdom
/** Phone: Remove has an Undo and sits apart from Move down; toasts wrap on a narrow phone and take the page's own colour tokens. Real APP_JS / APP_CSS. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { APP_JS, APP_CSS } from '../../main/remoteAssets'

afterEach(() => vi.useRealTimers())
const css = APP_CSS.replace(/\r\n/g, '\n')
const rule = (sel: string): string => { const i = css.indexOf('\n' + sel + '{'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i) + 1) }

function load(): { removeQueueItemRemote: (i: number) => void; undoRemove: () => void; state: { qs: { queue: Array<{ id: string; title: string }> } } } {
  Object.assign(window, { matchMedia: () => ({ matches: false, addEventListener: () => {}, addListener: () => {} }) })
  document.body.innerHTML = '<div id="toast"></div><div id="conn-p"><span class="connLabel"></span></div><div class="undo-bar" id="undoBar" hidden><span id="undoText"></span><button id="undoBtn"></button></div>'
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const api = new Function(`${APP_JS}\nreturn { removeQueueItemRemote: removeQueueItemRemote, undoRemove: undoRemove, state: state };`)() as ReturnType<typeof load>
  Object.assign(window, api)
  return api
}

describe('phone Remove', () => {
  it('can be undone within 5 seconds, and is sent after that', async () => {
    vi.useFakeTimers()
    const sent: unknown[] = []
    global.fetch = vi.fn((_u: unknown, init?: { body?: string }) => { if (init?.body) sent.push(JSON.parse(init.body)); return Promise.resolve(new Response(null, { status: 204 })) }) as unknown as typeof fetch
    const api = load()
    api.state.qs.queue = [{ id: 'a', title: 'Invented Song' }, { id: 'b', title: 'John 3:16' }]
    api.removeQueueItemRemote(0)
    expect((document.getElementById('undoBar') as HTMLElement).hidden).toBe(false)
    api.undoRemove()
    await vi.advanceTimersByTimeAsync(6000)
    expect(sent.filter((x) => (x as { action: string }).action === 'remove')).toEqual([])
    api.removeQueueItemRemote(1)
    await vi.advanceTimersByTimeAsync(5100)
    expect(sent.filter((x) => (x as { action: string }).action === 'remove')).toEqual([expect.objectContaining({ action: 'remove', id: 'b' })])
  })
  it('sits apart from Move down', () => {
    expect(rule('.qitem-editbtn--danger')).toMatch(/margin-left:16px/)
  })
})

describe('phone toasts', () => {
  it('wrap on a narrow phone instead of running off the screen, in the page\'s own colours', () => {
    const t = rule('.toast')
    expect(t).not.toMatch(/white-space:nowrap/)
    expect(t).toMatch(/max-width:calc\(100vw - 32px\)/)
    expect(t).toMatch(/background:var\(--ok\)/)
  })
})
