/* Phone-remote offline / reconnect: opens the remote page in headless Chromium and WebKit, stops BORN, checks the page says it is
 * reconnecting (and a tap fails visibly), restarts BORN on the same port and checks the page heals on its own.
 * Usage: node scripts/qa/remote-reconnect.cjs <profileDir>   (needs `npm run build`; Playwright from PW_DIR, default /tmp/born-pw) */
const path = require('path')
const { launch, checks, sleep } = require('./lib.cjs')
const pw = require(path.join(process.env.PW_DIR || '/tmp/born-pw', 'node_modules', 'playwright'))
const profile = process.argv[2] || path.join(require('os').tmpdir(), 'born-v1-reconnect-profile')
const PORT = 14320
const label = (page) => page.evaluate(() => [...document.querySelectorAll('.connLabel')].map((e) => e.textContent.trim()).filter(Boolean).join('|'))
;(async () => {
  const c = checks('remote-reconnect')
  let app = await launch({ profile, remotePort: PORT, mdns: 'born-remote-v1rc', port: 9360, settle: 5000 })
  for (const [name, type] of [['chromium', pw.chromium], ['webkit', pw.webkit]]) {
    const browser = await type.launch()
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
    const page = await ctx.newPage()
    await page.goto(`http://127.0.0.1:${PORT}/`); await page.waitForFunction(() => typeof setTab === 'function')
    await page.waitForTimeout(2500)
    const online = await label(page)
    c.ok(`${name}: shows connected while BORN is running`, /connected/i.test(online) && !/reconnect/i.test(online), online)
    await app.kill(); await sleep(500)
    await page.waitForTimeout(6000)
    const off = await label(page)
    c.ok(`${name}: says it is reconnecting once BORN stops`, /reconnect/i.test(off), off)
    await page.evaluate(() => { try { cmd('next') } catch (e) {} })
    await page.waitForTimeout(800)
    const toast = await page.evaluate(() => { const t = document.getElementById('toast'); return t && t.style.display !== 'none' ? t.textContent : '' })
    c.ok(`${name}: a tap while offline fails visibly (toast)`, /couldn.t reach born/i.test(toast), toast)
    app = await launch({ profile, remotePort: PORT, mdns: 'born-remote-v1rc', port: 9360, settle: 4000 })
    await page.waitForTimeout(6000)
    const back = await label(page)
    c.ok(`${name}: heals on its own when BORN is back`, /connected/i.test(back) && !/reconnect/i.test(back), back)
    await browser.close()
  }
  const res = c.done(); await app.kill(); process.exit(res.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
