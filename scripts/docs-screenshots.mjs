#!/usr/bin/env node
/**
 * docs-screenshots.mjs — regenerates the automatable screenshots in
 * docs/manual/v2/images/ from a live, running dev instance of BORN, over the
 * Chrome DevTools Protocol (CDP) — the same technique used throughout the
 * v2-channels redesign work for live verification, just scripted so it's a
 * repeatable command instead of a one-off manual session.
 *
 * What this does NOT cover (see docs/manual/v2/README.md): real external
 * displays, a real phone for the mobile remote, and OBS — those need real
 * hardware/software this script can't fake, and must be captured by hand.
 *
 * Usage:
 *   1. In one terminal: BORN_USER_DATA_DIR=/tmp/born-docsshots \
 *        ./node_modules/.bin/electron-vite dev --remoteDebuggingPort 9920
 *      (a throwaway user-data-dir keeps this from touching your real
 *      settings/recent-services; ELECTRON_RUN_AS_NODE must be unset)
 *   2. In another: node scripts/docs-screenshots.mjs --port 9920
 */
import WebSocket from 'ws'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = join(__dirname, '..', 'docs', 'manual', 'v2', 'images')
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
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

let nextId = 1
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++
    const onMessage = (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.id !== id) return
      ws.off('message', onMessage)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    }
    ws.on('message', onMessage)
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
 *  fire as if a person typed it. A <select> listens for 'change' instead, so
 *  this fires both — harmless for a text input, required for a select. */
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
 *  search (e.g. '.bible-panel .panel-subtab-bar button') — several unrelated
 *  components share generic button text ("Browse", "Search"), so an
 *  unscoped search can silently click the wrong one. Only matches elements
 *  actually visible (offsetParent !== null), since hidden [tab] panels stay
 *  mounted in this app rather than unmounting. */
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

/** Dispatches a real Enter keydown — some search boxes only commit on Enter,
 *  not on every keystroke, and an autocomplete dropdown can otherwise stay
 *  open over the results. */
async function pressEnter(ws, selector) {
  await evaluate(
    ws,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return false
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
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

  // Clean baseline — close any projection window left open from a previous run.
  await evaluate(ws, `window.electronAPI.closeProjection()`).catch(() => {})
  await sleep(300)

  // 1. Idle start screen
  await evaluate(ws, `document.querySelector('.app-logo-born')?.click()`)
  await sleep(300)
  await screenshot(ws, 'operator-console-idle.png')

  // 2. Sermons search results
  await typeInto(ws, '#born-search-input', 'faith')
  await pressEnter(ws, '#born-search-input')
  await sleep(900)
  await screenshot(ws, 'operator-search-results.png')

  // 3. Bible — reference lookup
  await clickByText(ws, 'button', 'Bible')
  await sleep(200)
  await typeInto(ws, '.bible-panel .search-input', 'John 3:16')
  await sleep(600)
  await screenshot(ws, 'operator-bible-reference.png')

  // 4. Bible — keyword search
  await typeInto(ws, '.bible-panel .search-input', 'faith')
  await sleep(600)
  await screenshot(ws, 'operator-bible-keyword.png')

  // 5. Bible — Browse
  await clickByText(ws, '.bible-panel .panel-subtab-bar button', 'Browse')
  await sleep(300)
  await screenshot(ws, 'operator-bible-browse.png')

  // back to Sermons for the rest of the flow
  await clickByText(ws, 'button', 'Sermons')
  await sleep(200)

  // 6. Songs
  await clickByText(ws, 'button', 'Songs')
  await sleep(200)
  await typeInto(ws, 'input[placeholder^="Search titles"]', 'Amazing Grace')
  await sleep(700)
  await screenshot(ws, 'operator-songs-search.png')
  await clickByText(ws, 'button', 'Sermons')
  await sleep(200)

  // 7. Project something, then capture the queue bar + hide/show state
  await evaluate(ws, `window.electronAPI.openProjection()`)
  await sleep(600)
  await evaluate(
    ws,
    `(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Project')
      if (btn) btn.click()
    })()`
  )
  await sleep(600)
  await screenshot(ws, 'operator-queue-onscreen.png')

  // 8. Hide screen (amber state) — poll for the toggle-on class rather than
  // a fixed sleep, since a screenshot taken mid-re-render can otherwise miss
  // the class despite the label already having flipped to "Show screen".
  await clickByText(ws, 'button', 'Hide screen')
  for (let i = 0; i < 20; i++) {
    const hasClass = await evaluate(
      ws,
      `[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Show screen' && b.classList.contains('btn-toggle-on'))`
    )
    if (hasClass) break
    await sleep(100)
  }
  await screenshot(ws, 'operator-hide-screen-amber.png')
  await clickByText(ws, 'button', 'Show screen') // leave it un-hidden afterwards
  await sleep(200)

  // 9. Message dialog
  await clickByText(ws, 'button', 'Message')
  await sleep(300)
  await screenshot(ws, 'operator-message-dialog.png')
  await clickByText(ws, 'button', 'Cancel')
  await sleep(200)

  // 10. Screens popover (1 channel)
  await clickByText(ws, 'button', 'Screens')
  await sleep(300)
  await screenshot(ws, 'operator-screens-popover-1ch.png')

  // 11. Manage… — each tab
  await clickByText(ws, 'button', 'Manage')
  await sleep(300)
  await screenshot(ws, 'operator-manage-displays-tab.png')

  // 11b. Name a real connected display, then show the Clear-name (eraser)
  // action that appears once it has a name.
  await evaluate(ws, `document.querySelector('.display-row-btn[aria-label^="Rename"]')?.click()`)
  await sleep(300)
  await typeInto(ws, '.display-rename-input', 'Sanctuary Projector')
  await evaluate(ws, `document.querySelector('button[aria-label^="Save name"], button[title="Save"]')?.click()`)
  await sleep(300)
  await screenshot(ws, 'setup-clear-name.png')

  await evaluate(ws, `[...document.querySelectorAll('.screens-manager-sidebar button')].find(b => b.textContent.includes('Channels'))?.click()`)
  await sleep(300)
  await clickByText(ws, 'button', 'Add channel')
  await sleep(300)
  await screenshot(ws, 'setup-channels-add.png')
  await evaluate(ws, `[...document.querySelectorAll('.screens-manager-sidebar button')].find(b => b.textContent.includes('Outputs'))?.click()`)
  await sleep(300)
  await screenshot(ws, 'operator-manage-outputs-tab.png')
  await evaluate(ws, `[...document.querySelectorAll('.screens-manager-sidebar button')].find(b => b.textContent.includes('Status'))?.click()`)
  await sleep(300)
  await screenshot(ws, 'operator-manage-status-tab.png')
  // 12. Add a few channels — one to show Translation/Songbook/Follow in
  // detail, a couple more so the popover has a realistic multi-channel list.
  await evaluate(ws, `[...document.querySelectorAll('.screens-manager-sidebar button')].find(b => b.textContent.includes('Channels'))?.click()`)
  await sleep(300)

  async function addChannel(name) {
    await clickByText(ws, 'button', 'Add channel')
    await sleep(200)
    await typeInto(ws, '.display-rename-input', name)
    await evaluate(ws, `document.querySelector('button[aria-label="Add channel"].display-row-btn')?.click()`)
    await sleep(500)
  }

  await addChannel('Spanish')
  await addChannel('French')
  await addChannel('Sign Language')

  // Expand the first channel and set it to Follow Main with a non-English
  // translation, for the channels.md "Follow" screenshot.
  await evaluate(
    ws,
    `(() => { const row = [...document.querySelectorAll('.screens-channel-name')].find(e => e.textContent.trim() === 'Spanish'); row?.closest('.screens-channel-row')?.click() })()`
  )
  await sleep(300)
  await evaluate(
    ws,
    `${SET_INPUT_VALUE_FN}
     (() => {
       const sel = [...document.querySelectorAll('.screens-select')].find(s => [...s.options].some(o => o.value === 'FRLSG'))
       if (!sel) return 'no FRLSG option'
       __setVal(sel, 'FRLSG')
       return 'ok'
     })()`
  )
  await sleep(300)
  await clickByText(ws, '.screens-seg button', 'Follow Main')
  await sleep(400)
  await screenshot(ws, 'setup-channels-follow.png')

  // 13. Outputs — add Graphics to Main, capture the URL/copy/preview row and
  // the profile picker. Deliberately leave it unopened anywhere afterwards —
  // that's exactly the real "No viewer connected" state for the Status shot.
  await evaluate(ws, `[...document.querySelectorAll('.screens-manager-sidebar button')].find(b => b.textContent.includes('Outputs'))?.click()`)
  await sleep(300)
  await clickByText(ws, 'button', 'Add Graphics')
  await sleep(500)
  await screenshot(ws, 'setup-outputs-add-graphics.png')
  await evaluate(ws, `document.querySelector('.display-row-btn[aria-label="Preview Graphics output"]')?.click()`)
  await sleep(400)
  await screenshot(ws, 'setup-outputs-url-copy-preview.png')
  await screenshot(ws, 'setup-profiles-picker.png')

  await evaluate(ws, `[...document.querySelectorAll('.screens-manager-sidebar button')].find(b => b.textContent.includes('Status'))?.click()`)
  await sleep(400)
  await screenshot(ws, 'warn-no-viewer-connected.png')

  // 14. English-fallback warning — Main is already showing the "Perfect
  // Faith" sermon quote from step 7; the Spanish/French channels just added
  // are new and not following yet except Spanish (set above). Re-check the
  // popover for the fallback chip once Follow has had a moment to resolve.
  await evaluate(ws, `document.querySelector('.modal-title-row .btn-icon')?.click()`)
  await sleep(300)
  await clickByText(ws, 'button', 'Screens')
  await sleep(300)
  await screenshot(ws, 'operator-screens-popover-5ch.png')
  const hasFallback = await evaluate(
    ws,
    `!![...document.querySelectorAll('.screens-chip')].find(c => c.textContent.includes('Fallback'))`
  )
  if (hasFallback) {
    await screenshot(ws, 'warn-english-fallback.png')
  } else {
    console.warn('  (no Fallback: English chip visible — this sermon quote may already have a French translation; skipped warn-english-fallback.png)')
  }

  console.log('\nDone. Screenshots written to', IMAGES_DIR)
  console.log('Remaining shots (real displays, OBS, mobile remote, multi-channel,')
  console.log('and every warning state) still need a manual pass — see')
  console.log('docs/manual/v2/README.md.')

  ws.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
