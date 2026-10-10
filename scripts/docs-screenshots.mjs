#!/usr/bin/env node
/**
 * docs-screenshots.mjs — regenerates the automatable screenshots in
 * docs/manual/v1/images/ from a live, running dev instance of BORN, over the
 * Chrome DevTools Protocol (CDP). Ported from v2-channels' script of the same
 * name, trimmed to what v1 actually has (no Channels, Outputs, Profiles,
 * automation API).
 *
 * What this does NOT cover: real external displays, a real phone for the
 * mobile remote — those need real hardware this script can't fake, and must
 * be captured by hand (see docs/manual/v1/README.md).
 *
 * Usage:
 *   1. In one terminal: BORN_USER_DATA_DIR=/tmp/born-docsshots \
 *        ./node_modules/.bin/electron-vite dev --remoteDebuggingPort 9920
 *      (a throwaway user-data-dir keeps this from touching your real
 *      settings/recent-services; ELECTRON_RUN_AS_NODE must be unset)
 *   2. In another: node scripts/docs-screenshots.mjs --port 9920
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = join(__dirname, '..', 'docs', 'manual', 'v1', 'images')
mkdirSync(IMAGES_DIR, { recursive: true })

const port = Number(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1]) || 9920

async function findMainTarget() {
  const res = await fetch(`http://localhost:${port}/json`)
  const targets = await res.json()
  const main = targets.find((t) => t.type === 'page' && t.title === 'BORN — Branham or Nothing')
  if (!main) throw new Error(`No BORN page target found on port ${port} — is the dev instance running?`)
  return main.webSocketDebuggerUrl
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    ws.addEventListener('open', () => resolve(ws), { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
}

let nextId = 1
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++
    const onMessage = (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString())
      if (msg.id !== id) return
      ws.removeEventListener('message', onMessage)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    }
    ws.addEventListener('message', onMessage)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(ws, expression) {
  const result = await send(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? JSON.stringify(result.exceptionDetails))
  }
  return result.result?.value
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function screenshot(ws, filename, { clip } = {}) {
  await sleep(250) // let CSS transitions/re-renders settle
  const params = { format: 'png' }
  if (clip) params.clip = { ...clip, scale: 1 }
  const { data } = await send(ws, 'Page.captureScreenshot', params)
  writeFileSync(join(IMAGES_DIR, filename), Buffer.from(data, 'base64'))
  console.log('✓', filename)
}

/** React-controlled inputs need a real native 'input' event, not just
 *  `.value = x` — this is the standard way to make React's own onChange
 *  fire as if a person typed it. */
const SET_INPUT_VALUE_FN = `
function __setVal(el, value) {
  const proto = Object.getPrototypeOf(el)
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}
`

/** `tag` may be a plain tag name ('button') or any CSS selector scoping the
 *  search — several unrelated components share generic button text, so an
 *  unscoped search can silently click the wrong one. Only matches elements
 *  actually visible (offsetParent !== null). */
async function clickByText(ws, tag, text) {
  const ok = await evaluate(
    ws,
    `(() => {
      const els = [...document.querySelectorAll(${JSON.stringify(tag)})]
      const el = els.find(e => e.textContent.trim().includes(${JSON.stringify(text)}) && e.offsetParent !== null)
      if (el) { el.click(); return true }
      return false
    })()`
  )
  if (!ok) console.warn(`  (could not find visible ${tag} with text "${text}")`)
  return ok
}

async function typeInto(ws, selector, value) {
  await evaluate(
    ws,
    `${SET_INPUT_VALUE_FN}
     (() => {
       const el = document.querySelector(${JSON.stringify(selector)})
       if (!el) return false
       el.focus()
       __setVal(el, ${JSON.stringify(value)})
       return true
     })()`
  )
}

async function main() {
  const wsUrl = await findMainTarget()
  const ws = await connect(wsUrl)
  await send(ws, 'Page.enable')
  await send(ws, 'Runtime.enable')

  console.log('Connected. Taking screenshots…')

  // Clean baseline — close any projection window / popovers left open from a
  // previous run.
  await evaluate(ws, `window.electronAPI.closeProjection()`).catch(() => {})
  await sleep(300)

  // 1. Idle start screen
  await evaluate(ws, `document.querySelector('.app-logo-born')?.click()`)
  await sleep(300)
  await screenshot(ws, 'operator-idle.png')

  // 2. Sermons search results
  await typeInto(ws, '#born-search-input', 'faith')
  await evaluate(ws, `document.querySelector('#born-search-input')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))`)
  await sleep(900)
  await screenshot(ws, 'operator-search-results.png')

  // 3. Bible — Browse — a chapter reading view
  await clickByText(ws, 'button', 'Bible')
  await sleep(200)
  await clickByText(ws, '.bible-panel .panel-subtab-bar button', 'Browse')
  await sleep(300)
  // Book grid buttons hold the title and chapter count in one text node
  // ("John21 ch") — startsWith avoids matching "1 John"/"2 John"/"3 John".
  await evaluate(ws, `[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('John') && b.offsetParent !== null)?.click()`)
  await sleep(500)
  await evaluate(ws, `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '3' && b.offsetParent !== null)?.click()`)
  await sleep(500)
  await screenshot(ws, 'operator-bible-browse.png')
  await clickByText(ws, 'button', 'Sermons')
  await sleep(200)

  // 4. Screens popover
  await clickByText(ws, 'button', 'Screens')
  await sleep(400)
  await screenshot(ws, 'operator-screens-popover.png')
  await evaluate(ws, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await sleep(200)

  // 5. Remote popover
  await clickByText(ws, 'button', 'Remote')
  await sleep(500)
  await screenshot(ws, 'operator-remote-popover.png')
  await evaluate(ws, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)

  console.log('\nDone. Screenshots written to', IMAGES_DIR)
  console.log('Remaining shots (real external display, a real phone for the mobile')
  console.log('remote) still need a manual pass — see docs/manual/v1/README.md.')

  ws.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
