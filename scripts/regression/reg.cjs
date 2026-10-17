const { chromium, webkit } = require('playwright')
const fs = require('fs')
const OUT = process.argv[2]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const area = (a) => { cur = a }
let cur = ''
const check = (name, ok, detail = '') => { results.push({ area: cur, name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', `[${cur}]`, name, detail) }
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9920')
  let main
  for (const p of browser.contexts().flatMap((c) => c.pages())) { try { if ((await p.evaluate(() => document.title)) === 'Born Again') main = p } catch {} }
  const api = (fn, ...args) => main.evaluate(([f, a]) => window.electronAPI[f](...a), [fn, args])
  const live = async () => (await api('getLiveState'))
  const mainLive = async () => (await live()).find((c) => c.id === 'main')

  // ================= Screens popover =================
  area('Screens popover')
  await main.click('button:has-text("Screens")'); await sleep(500)
  const pop = await main.evaluate(() => (document.querySelector('.screens-popover') || document.body).innerText)
  check('popover lists Congregation, Stage and Graphics', /congregation/i.test(pop) && /stage/i.test(pop) && /graphics/i.test(pop), pop.replace(/\n/g, ' | ').slice(0, 160))
  check('Manage… entry point present', await main.locator('button:has-text("Manage")').count() > 0)
  check('projected text size control present', /text size/i.test(pop))

  // ================= Outputs & Channels (all tabs) =================
  area('Outputs & Channels tabs')
  await main.click('button:has-text("Manage")'); await sleep(500)
  for (const tab of ['Displays', 'Channels', 'Outputs', 'Status']) {
    await main.evaluate((t) => [...document.querySelectorAll('.screens-manager-sidebar button')].find((b) => b.textContent.includes(t))?.click(), tab)
    await sleep(350)
    const txt = await main.evaluate(() => (document.querySelector('.screens-manager-content, .screens-manager-body, .screens-manager') || document.body).innerText.length)
    check(`${tab} tab renders`, txt > 40, `len ${txt}`)
  }

  // ================= Clear name =================
  area('Clear name')
  await main.evaluate(() => [...document.querySelectorAll('.screens-manager-sidebar button')].find((b) => b.textContent.includes('Displays'))?.click()); await sleep(300)
  const before = await api('listDisplays')
  const namesBefore = (before.namedDisplays || []).length
  await main.evaluate(() => document.querySelector('.display-row-btn[aria-label^="Rename"]')?.click()); await sleep(300)
  await main.fill('.display-rename-input', 'Sanctuary Projector')
  await main.evaluate(() => document.querySelector('button[aria-label^="Save name"], button[title="Save"]')?.click()); await sleep(500)
  const named = await api('listDisplays')
  check('naming a display saves the name', (named.namedDisplays || []).some((n) => n.name === 'Sanctuary Projector'), JSON.stringify((named.namedDisplays || []).map((n) => n.name)))
  await main.evaluate(() => document.querySelector('button[aria-label^="Clear name for"]')?.click()); await sleep(500)
  const cleared = await api('listDisplays')
  check('Clear name removes it', !(cleared.namedDisplays || []).some((n) => n.name === 'Sanctuary Projector') && (cleared.namedDisplays || []).length === namesBefore, JSON.stringify((cleared.namedDisplays || []).map((n) => n.name)))

  // ================= Channels, follow sync =================
  area('Channels + follow sync')
  await main.evaluate(() => [...document.querySelectorAll('.screens-manager-sidebar button')].find((b) => b.textContent.includes('Channels'))?.click()); await sleep(300)
  await main.click('button:has-text("Add channel")'); await sleep(250)
  await main.fill('.display-rename-input', 'Francais')
  await main.evaluate(() => document.querySelector('button[aria-label="Add channel"].display-row-btn')?.click()); await sleep(600)
  let chans = await api('listChannels')
  const fr = chans.find((c) => c.label === 'Francais')
  check('a channel can be added', !!fr, JSON.stringify(chans.map((c) => c.label)))
  await main.evaluate(() => { const row = [...document.querySelectorAll('.screens-channel-name')].find((e) => e.textContent.trim() === 'Francais'); row?.closest('.screens-channel-row')?.click() }); await sleep(300)
  await main.evaluate(() => {
    const sel = [...document.querySelectorAll('.screens-select')].find((s) => [...s.options].some((o) => o.value === 'FRLSG'))
    if (!sel) return
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    set.call(sel, 'FRLSG'); sel.dispatchEvent(new Event('change', { bubbles: true }))
  }); await sleep(400)
  await main.evaluate(() => [...document.querySelectorAll('.screens-seg button')].find((b) => b.textContent.trim().startsWith('Follow Main'))?.click()); await sleep(500)
  chans = await api('listChannels')
  const fr2 = chans.find((c) => c.label === 'Francais')
  check('translation can be set (FRLSG)', fr2?.translation === 'FRLSG', JSON.stringify(fr2))
  check('Follow Main sync can be set', fr2?.sync?.syncMode === 'follow' && fr2.sync.linkedTo === 'main', JSON.stringify(fr2?.sync))
  // close manager, project John 3:16 on Main via the UI
  await main.evaluate(() => document.querySelector('.modal-title-row .btn-icon')?.click()); await sleep(300)
  await main.click('.rail-btn:has-text("Bible")'); await sleep(300)
  await main.click('.bible-panel .panel-subtab:has-text("Browse")'); await sleep(400)
  await main.locator('.bible-browse-book').nth(42).click(); await sleep(300)
  await main.locator('.bible-browse-chapter').nth(2).click(); await sleep(1000)
  await main.locator('.bible-right .bible-verse button:has-text("Project")').nth(15).click(); await sleep(2500)
  const ml = await mainLive()
  check('Main shows John 3:16', /John 3:16/.test(ml?.current?.reference || ''), ml?.current?.reference)
  const fl = (await live()).find((c) => c.id === fr2?.id)
  check('the following channel shows the same verse in its own translation', !!fl?.current && /Jean|Dieu/i.test((fl.current.reference || '') + ' ' + fl.current.text) && fl.current.text !== ml.current.text, (fl?.current?.reference || '') + ' :: ' + (fl?.current?.text || '').slice(0, 70))
  // Preview/Live pair tabs
  if (await main.locator('.queue-panel.is-collapsed').count()) { await main.click('.rail-btn:has-text("Queue")'); await sleep(500) }
  const tabs = await main.$$eval('.plp-channel', (t) => t.map((x) => x.textContent.trim()))
  check('Preview/Live shows a tab per channel', tabs.includes('Main') && tabs.includes('Francais'), JSON.stringify(tabs))
  if (tabs.includes('Francais')) {
    await main.click('.plp-channel:has-text("Francais")'); await sleep(500)
    const liveTitle = await main.$eval('.plp-cell--live .plp-title', (e) => e.textContent)
    check('switching tab shows that channel’s live item', /Jean|John/.test(liveTitle), liveTitle)
    await main.click('.plp-channel:has-text("Main")'); await sleep(200)
  }

  // ================= Graphics browser destination + profiles + suppress =================
  area('Graphics destination + profiles')
  await main.click('button:has-text("Screens")'); await sleep(300)
  await main.click('button:has-text("Manage")'); await sleep(400)
  await main.evaluate(() => [...document.querySelectorAll('.screens-manager-sidebar button')].find((b) => b.textContent.includes('Outputs'))?.click()); await sleep(400)
  await main.click('button:has-text("Add Graphics")'); await sleep(700)
  let outs = await api('listOutputs')
  const g = outs.find((o) => o.kind === 'browser' && o.channelId === 'main')
  check('a Graphics output can be added to Main', !!g && /\/output\/graphics\//.test(g.url || ''), JSON.stringify(g))
  const gurl = g.url
  const wk = await webkit.launch()
  const gp = await (await wk.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
  const gerr = []
  gp.on('pageerror', (e) => gerr.push(e.message))
  await gp.goto(gurl, { waitUntil: 'load' }); await sleep(2500)
  const gtext = async () => gp.evaluate(() => (document.getElementById('text-inner') || {}).textContent || '')
  const gprof = async () => gp.evaluate(() => (document.getElementById('stage') || {}).dataset && document.getElementById('stage').dataset.profile)
  check('Graphics page receives what is live (SSE)', /so loved the world|aimé/i.test(await gtext()), (await gtext()).slice(0, 60))
  check('Graphics page has no script errors', gerr.length === 0, gerr.join(' // '))
  // profile: Lower third
  await main.evaluate(() => [...document.querySelectorAll('.screens-seg button, button')].find((b) => /^Lower third/.test(b.textContent.trim()))?.click()); await sleep(800)
  outs = await api('listOutputs')
  const g2 = outs.find((o) => o.id === g.id)
  check('profile can be set to Lower third', g2.profileId === 'lower-third' || g2.autoProfile === false, JSON.stringify({ p: g2.profileId, auto: g2.autoProfile }))
  check('Graphics page switches layout without reloading', (await gprof()) === 'lower-third', String(await gprof()))
  // blank hides text on graphics
  await sleep(600)
  await main.evaluate(() => window.electronAPI.setBlankScreen(true)); await sleep(800)
  check('blanking the screen clears the Graphics page', (await gtext()).trim() === '', (await gtext()).slice(0, 40))
  await main.evaluate(() => window.electronAPI.setBlankScreen(false)); await sleep(800)
  // next verse → new text arrives
  const prev = await gtext()
  // destination suppression
  await main.evaluate((id) => window.electronAPI.setDestinationSuppressed(id, true), g.id); await sleep(800)
  check('suppressing the Graphics destination clears only it', (await gtext()).trim() === '' && !!(await mainLive()).current, 'graphics text: ' + (await gtext()).slice(0, 30))
  await main.evaluate((id) => window.electronAPI.setDestinationSuppressed(id, false), g.id); await sleep(800)
  check('un-suppressing restores it', (await gtext()).trim() !== '', (await gtext()).slice(0, 40))
  await wk.close()
  // status tab mentions the viewer after we connected
  await main.evaluate(() => [...document.querySelectorAll('.screens-manager-sidebar button')].find((b) => b.textContent.includes('Status'))?.click()); await sleep(500)
  const st = await main.evaluate(() => document.body.innerText)
  check('Status tab reports destinations', /congregation/i.test(st) && /graphics/i.test(st), '')
  await main.evaluate(() => document.querySelector('.modal-title-row .btn-icon')?.click()); await sleep(300)

  // ================= Remote popover + diagnostics + automation API =================
  area('Remote popover, diagnostics, automation API')
  await main.click('button:has-text("Remote")'); await sleep(900)
  const rp = await main.evaluate(() => document.body.innerText)
  check('Remote popover shows the address', /\b\d+\.\d+\.\d+\.\d+:4317|[\w-]+\.local:4317/.test(rp), (rp.match(/\d+\.\d+\.\d+\.\d+:\d+/) || [''])[0])
  await main.click('button:has-text("Remote connection check")'); await sleep(1200)
  const dg = await main.evaluate(() => (document.querySelector('.remote-diag') || {}).innerText || '')
  check('connection check reports the server and the networks', /listening/.test(dg) && /4317/.test(dg) && /networks on this computer/i.test(dg), dg.replace(/\n/g, ' | ').slice(0, 160))
  await main.click('button:has-text("Automation API")'); await sleep(400)
  const base = 'http://127.0.0.1:4317'
  let r = await fetch(`${base}/api/v1/automation/state`)
  check('automation state is readable without a token by default', r.status === 200, String(r.status))
  const stateNoAuth = await r.json()
  check('automation state lists channels with current + blanked', Array.isArray(stateNoAuth) && stateNoAuth.some((c) => c.id === 'main' && 'blanked' in c && c.current), JSON.stringify(stateNoAuth.map((c) => c.id)))
  // require a token
  await main.locator('label:has-text("Require a token") input').check(); await sleep(600)
  const info = await api('getAutomationInfo')
  check('a token is generated when required', !!info.token, String(info.token).slice(0, 6) + '…')
  r = await fetch(`${base}/api/v1/automation/state`)
  check('without the token the API refuses (401)', r.status === 401, String(r.status))
  r = await fetch(`${base}/api/v1/automation/state`, { headers: { 'X-Born-Token': info.token } })
  check('with the token header it answers (200)', r.status === 200, String(r.status))
  r = await fetch(`${base}/api/v1/automation/state?token=${info.token}`)
  check('with ?token= it answers (200)', r.status === 200, String(r.status))
  const post = (path) => fetch(`${base}/api/v1/automation/${path}`, { method: 'POST', headers: { 'X-Born-Token': info.token } })
  const refBefore = (await mainLive()).current.reference
  r = await post('next'); await sleep(1200)
  const refNext = (await mainLive()).current.reference
  check('POST next advances what is live (real client call)', r.status === 204 && refNext !== refBefore, `${refBefore} -> ${refNext}`)
  r = await post('prev'); await sleep(1200)
  check('POST prev goes back', r.status === 204 && (await mainLive()).current.reference === refBefore, (await mainLive()).current.reference)
  r = await post('blank/main'); await sleep(800)
  check('POST blank/main blanks the screen', r.status === 204 && (await mainLive()).blanked === true)
  r = await post('show/main'); await sleep(800)
  check('POST show/main brings it back', r.status === 204 && (await mainLive()).blanked === false)
  r = await post('clear/main'); await sleep(800)
  check('POST clear/main clears the channel', r.status === 204 && (await mainLive()).current === null)
  r = await fetch(`${base}/api/automation/state`, { headers: { 'X-Born-Token': info.token } })
  check('the unversioned /api/automation path still works', r.status === 200, String(r.status))
  // turn the token back off so later flows are unaffected
  await main.locator('label:has-text("Require a token") input').uncheck(); await sleep(500)
  await main.mouse.click(5, 400).catch(() => {})

  // ================= Help viewer =================
  area('Help viewer')
  await main.click('button:has-text("Help")'); await sleep(1200)
  const pages = await main.$$eval('.help-sidebar button', (b) => b.map((x) => x.textContent.trim()))
  check('Help lists the manual pages including the new one', pages.length >= 20 && pages.some((p) => /Preview, Live/.test(p)), `${pages.length} pages`)
  let broken = 0, empty = 0
  for (let i = 0; i < pages.length; i++) {
    await main.locator('.help-sidebar button').nth(i).click(); await sleep(250)
    const c = await main.evaluate(() => {
      const el = document.querySelector('.help-content')
      const imgs = [...el.querySelectorAll('img')]
      return { len: el.innerText.length, imgs: imgs.length, broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length }
    })
    if (c.len < 40) empty++
    broken += c.broken
  }
  check('every manual page has content', empty === 0, `${empty} empty`)
  check('no manual image is broken', broken === 0, `${broken} broken`)
  const brandInManual = await main.evaluate(() => /BORN\b/.test(document.querySelector('.help-content').innerText))
  await main.keyboard.press('F1'); await sleep(400)
  check('F1 closes the manual', (await main.locator('.help-modal').count()) === 0)

  fs.writeFileSync(`${OUT}/regression-results.json`, JSON.stringify(results, null, 1))
  console.log(results.length, 'checks,', results.filter((x) => !x.ok).length, 'failed')
  await browser.close()
})().catch((e) => { console.error('ERR', e); fs.writeFileSync(`${OUT}/regression-results.json`, JSON.stringify(results, null, 1)); process.exit(1) })
