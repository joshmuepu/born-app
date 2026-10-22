// @vitest-environment jsdom
/**
 * Phone-remote page behaviour that the real APP_JS / APP_CSS source must keep (evaluated the same way remoteCmd.test.ts does).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { APP_JS, APP_CSS } from '../../main/remoteAssets'

const css = APP_CSS.replace(/\r\n/g, '\n')
const rule = (sel: string): string => {
  const i = css.indexOf('\n' + sel + '{')
  return i < 0 ? '' : css.slice(i, css.indexOf('}', i) + 1)
}

describe('remote search boxes', () => {
  it('show a visible focus ring when the cursor is in them', () => {
    expect(css).toMatch(/\.searchbox:focus-within\{[^}]*box-shadow:/)
  })
  it('use 16px text so a phone does not zoom in on focus', () => {
    expect(rule('.searchbox input')).toMatch(/font-size:16px/)
  })
})

describe('remote A–Z strip', () => {
  it('has letters an easy 44px touch target', () => {
    const b = rule('.azstrip button')
    expect(b).toMatch(/width:44px/)
    expect(b).toMatch(/height:44px/)
  })
})

function loadRemote<T>(names: string, dom = '<div id="toast"></div><div id="conn-p"><span class="connLabel"></span></div>'): T {
  document.body.innerHTML = dom
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const api = new Function(`${APP_JS}\nreturn { cmd: cmd, ${names} };`)() as Record<string, unknown>
  // inline onclick="..." handlers look their functions up on window, as in a real page
  Object.assign(window, { cmd: api.cmd })
  return api as T
}

describe('remote esc()', () => {
  it('escapes double quotes, so text put into value="..." keeps its quotes (a quoted Bible search survived a redraw as empty)', () => {
    const { esc } = loadRemote<{ esc: (s: unknown) => string }>('esc: esc')
    expect(esc('"faith"')).toBe('&quot;faith&quot;')
    expect(esc('a & <b>')).toBe('a &amp; &lt;b&gt;')
    document.body.innerHTML = '<input id="i" value="' + esc('"faith"') + '">'
    expect((document.getElementById('i') as HTMLInputElement).value).toBe('"faith"')
  })
})

describe('remote queue buttons', () => {
  /** What tapping the Project button does, run the way a browser runs an onclick: the attribute text, with cmd() as a spy. */
  function tapProject(id: string): unknown[][] {
    const r = loadRemote<{ state: { qs: unknown }; queueDetailInnerHtml: (i: number) => string }>('state: state, queueDetailInnerHtml: queueDetailInnerHtml')
    r.state.qs = { queue: [{ id, kind: 'song', title: 'T', subtitle: '', slides: [] }] }
    const host = document.createElement('div')
    host.innerHTML = r.queueDetailInnerHtml(0)
    const handler = host.querySelector('button.btn-project')!.getAttribute('onclick')!
    const calls: unknown[][] = []
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function('cmd', handler)((...a: unknown[]) => calls.push(a))
    return calls
  }
  it('an item id from a shared service file cannot break out of the button and run script', () => {
    delete (window as unknown as { __pwned?: number }).__pwned
    try { tapProject("a'});window.__pwned=1;//") } catch { /* a broken handler is also acceptable here — what matters is below */ }
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
  })
  it('the id still reaches the command exactly as it was, odd characters included', () => {
    const id = `o'brien "x" & <y>`
    expect(tapProject(id)).toEqual([['project', { id }]])
  })
})
