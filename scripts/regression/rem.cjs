const { chromium, webkit } = require('playwright')
const fs = require('fs')
const OUT = process.argv[2]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', name, detail) }
const VIEWPORTS = [
  ['phone-portrait', 390, 844, true],
  ['phone-landscape', 844, 390, true],
  ['tablet-portrait', 820, 1180, true],
  ['tablet-landscape', 1180, 820, true]
]
;(async () => {
  // drive the desktop app so the remote has something live
  const desk = await chromium.connectOverCDP('http://127.0.0.1:9920')
  let dpage
  for (const p of desk.contexts().flatMap((c) => c.pages())) { try { if ((await p.evaluate(() => document.title)) === 'Born Again') dpage = p } catch {} }
  await dpage.evaluate(() => { localStorage.setItem('born.uiScale', '1') })
  // Put a real verse live through the operator UI (so the remote's state, which
  // comes from the app, is exactly what an operator would produce).
  await dpage.click('.rail-btn:has-text("Bible")'); await sleep(300)
  await dpage.click('.bible-panel .panel-subtab:has-text("Browse")'); await sleep(400)
  await dpage.locator('.bible-browse-book').nth(42).click(); await sleep(300)
  await dpage.locator('.bible-browse-chapter').nth(2).click(); await sleep(1000)
  await dpage.locator('.bible-right .bible-verse button:has-text("Show")').nth(15).click(); await sleep(2000)
  for (const [ename, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    for (const [vname, w, h, touch] of VIEWPORTS) {
      for (const scheme of ['dark', 'light']) {
        const tag = `${ename}/${vname}/${scheme}`
        const browser = await engine.launch(ename === 'chromium' ? { channel: 'chrome' } : {})
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: ename === 'webkit' && w < 700, colorScheme: scheme })
        const page = await ctx.newPage()
        const errors = []
        page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|Failed to load resource|EventSource/i.test(m.text())) errors.push(m.text()) })
        page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
        await page.goto('http://127.0.0.1:4317/', { waitUntil: 'load' })
        await sleep(2500)
        for (const t of ['Operator', 'Skip for now']) {
          const b = page.getByText(t, { exact: true }).first()
          if (await b.count()) { await b.click({ timeout: 1500 }).catch(() => {}); await sleep(250) }
        }
        const state = await page.evaluate(() => ({
          overflowX: document.documentElement.scrollWidth - innerWidth,
          bg: getComputedStyle(document.body).backgroundColor,
          connected: !!document.querySelector('.conn.ok, .sidebar .led'),
          bodyText: document.body.innerText.slice(0, 600)
        }))
        check(`${tag}: loads without horizontal overflow`, state.overflowX <= 1, JSON.stringify({ overflowX: state.overflowX }))
        check(`${tag}: shows the live item`, /John 3:16|For God so loved/.test(state.bodyText), state.bodyText.slice(0, 160).replace(/\n/g, ' | '))
        check(`${tag}: no console errors`, errors.length === 0, errors.slice(0, 2).join(' // '))
        await page.screenshot({ path: `${OUT}/rem-${ename}-${vname}-${scheme}.png` })
        if (scheme === 'dark') {
          // dropped connection
          await ctx.setOffline(true)
          await sleep(5000)
          const off = await page.evaluate(() => document.body.innerText.slice(0, 400).replace(/\n/g, ' | '))
          const offlineShown = /reconnecting/i.test(off)
          check(`${tag}: dropped connection is shown calmly`, offlineShown, off.slice(0, 140))
          await page.screenshot({ path: `${OUT}/rem-${ename}-${vname}-offline.png` })
          await ctx.setOffline(false)
          await sleep(4500)
          const back = await page.evaluate(() => !!document.querySelector('.conn.ok') || /Connected/.test(document.body.innerText))
          check(`${tag}: recovers when the network returns`, back)
        }
        await browser.close()
      }
    }
  }
  fs.writeFileSync(`${OUT}/remote-results.json`, JSON.stringify(results, null, 1))
  console.log(results.length, 'checks,', results.filter((r) => !r.ok).length, 'failed')
  await desk.close()
})().catch((e) => { console.error(e); process.exit(1) })
