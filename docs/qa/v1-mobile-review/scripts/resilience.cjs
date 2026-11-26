/* What the phone does when the connection or the computer goes away and comes back, during a live song: Wi-Fi off and on, a phone asleep for
 * a minute, BORN closed and started again, a very slow network, answers arriving out of order, the back button, rotation.
 * A FAIL here is a finding of the review, explained in ../report.md.
 * Usage: PW_DIR=/tmp/born-pw node docs/qa/v1-mobile-review/scripts/resilience.cjs [outDir]   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const H = require('./harness.cjs')
const { V, sleep } = H
const out = process.argv[2] || path.join(__dirname, '..', 'evidence')
const ENG = process.env.ENGINE || 'chromium'
const c = H.checks('resilience'), notes = []
const note = (what) => { notes.push(what); console.log('NOTE  ' + what) }
const text = (page, sel) => page.locator(V(sel)).first().innerText().catch(() => '')
const same = (v, srv) => (v.nowText || '').slice(0, 24) === (srv.onScreen || '').slice(0, 24)
const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return Date.now() - t0; await sleep(250) } return -1 }

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  let env = await H.start()
  const seed = async () => {
    await H.reset()
    for (const t of ['Morning Song', 'Evening Song', 'The Long Road Song']) await H.cmd({ action: 'queue-song', songId: env.ids[t] })
    await sleep(1200); const s = await H.server(); await H.cmd({ action: 'project', id: s.ids[2] }); await sleep(1000)
  }
  try {
    /* Wi-Fi off and on during a live song */
    await seed()
    let page = await H.phone({ engine: ENG })
    await page.context().setOffline(true)
    await page.locator('#next-p').tap(); await sleep(700)
    let v = await H.view(page)
    c.ok('wifi: a tap in the first second of a drop says it did not reach the computer', /Couldn.t reach BORN/.test(v.toast || ''), `says "${v.toast}"`)
    const t = await until(async () => (await H.view(page)).conn === false, 8000)
    c.ok('wifi: the phone says Reconnecting within 5 s of the drop', t >= 0 && t <= 5000, `${t} ms`)
    const head = await text(page, '.now-head'), card = await page.evaluate(() => { const e = document.querySelector('.now-card.perf'); return e ? { cls: e.className, opacity: getComputedStyle(e).opacity } : null })
    c.ok('wifi: while it cannot reach the computer, the phone does not go on presenting the last page as ON SCREEN', !/^\s*ON SCREEN/.test(head) || /stale|blanked|offline/.test(card.cls) || +card.opacity < 1, `top says "Reconnecting…", the live card still reads "${head.replace(/\s+/g, ' ')}" at full strength (class "${card ? card.cls : ''}")`)
    await H.cmd({ action: 'next' }); await H.cmd({ action: 'next' }); await sleep(600)
    await page.locator('#next-p').tap(); await sleep(500); v = await H.view(page)
    const srvOff = await H.server()
    c.ok('wifi: once it knows it is disconnected, Next is not sent and says so', /Not connected to BORN/.test(v.toast || ''), `says "${v.toast}"`)
    await page.locator('#blank-p').tap(); await sleep(600)
    note(`Hide screen while disconnected still tries: says "${(await H.view(page)).toast}"`)
    await page.context().setOffline(false)
    const back = await until(async () => { const x = await H.view(page); return x.conn === true && same(x, srvOff) }, 8000)
    c.ok('wifi: back on the network, the phone reconnects and catches up within 2 s, with no reload', back >= 0 && back <= 2500, `${back} ms; the screen moved two pages while the phone was away`)
    c.ok('wifi: nothing the phone tried while away arrives late', (await H.server()).onScreen === srvOff.onScreen && !(await H.server()).blanked, `screen "${(await H.server()).onScreen}", hidden ${(await H.server()).blanked}`)

    /* asleep for a minute (Chromium can freeze a page the way a locked phone does) */
    if (ENG === 'chromium') {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Page.setWebLifecycleState', { state: 'frozen' })
      for (let i = 0; i < 4; i++) { await H.cmd({ action: 'next' }); await sleep(15000) }
      const srv = await H.server()
      await cdp.send('Page.setWebLifecycleState', { state: 'active' })
      const woke = await until(async () => same(await H.view(page), srv), 6000)
      c.ok('sleep: after a minute asleep the phone shows the current page within 2 s of waking', woke >= 0 && woke <= 2500, `${woke} ms; the screen moved four pages meanwhile`)
    }

    /* answers arriving out of order on a poor network */
    await page.route('**/state', async (r) => { await sleep(Math.random() * 1800); r.continue().catch(() => {}) })
    await H.cmd({ action: 'project-at', id: (await H.server()).ids[2], slide: 0 }); await sleep(2500)
    const shown = []; const watch = setInterval(() => page.evaluate(() => { const m = /verse (\d+)/.exec((document.querySelector('.now-card.perf .now-text') || {}).textContent || ''); return m ? +m[1] : 0 }).then((n) => shown.push(n)).catch(() => {}), 120)
    for (let i = 0; i < 10; i++) { await H.cmd({ action: 'next' }); await sleep(800) }
    await sleep(3000); clearInterval(watch)
    let backwards = 0; for (let i = 1; i < shown.length; i++) if (shown[i] < shown[i - 1]) backwards++
    const seq = shown.filter((n, i) => i === 0 || n !== shown[i - 1]).join(' ')
    c.ok('slow: with answers arriving out of order the phone never steps back to an older page', backwards === 0, `the screen went 1 to 11 in order; the phone showed verses ${seq} (${backwards} step(s) backwards)`)
    c.ok('slow: it ends on the page that is really on the screen', shown[shown.length - 1] === 11, `ends on verse ${shown[shown.length - 1]}`)
    await page.unrouteAll({ behavior: 'ignoreErrors' })

    /* a very slow network: every answer takes 3 s */
    await page.route('**/*', async (r) => { await sleep(3000); r.continue().catch(() => {}) })
    const conn = []; const w2 = setInterval(() => page.evaluate(() => state.connOk).then((x) => conn.push(x)).catch(() => {}), 500)
    await sleep(3500); const b4 = (await H.server()).onScreen
    await page.locator('#next-p').tap(); await sleep(9000); clearInterval(w2)
    v = await H.view(page); const srvSlow = await H.server()
    c.ok('slow: at 3 s an answer, Next still moves the screen once', srvSlow.onScreen !== b4 && /verse 12/.test(srvSlow.onScreen), `"${b4}" → "${srvSlow.onScreen}"`)
    c.ok('slow: at 3 s an answer, the phone stays Connected', conn.every((x) => x === true), `Connected in ${conn.filter(Boolean).length} of ${conn.length} looks`)
    await page.unrouteAll({ behavior: 'ignoreErrors' }); await sleep(1500)

    /* the computer acts on a tap, but its answer takes longer than the 4 s the phone waits */
    await page.route('**/command', async (r) => { const res = await r.fetch(); await sleep(5500); r.fulfill({ response: res }).catch(() => {}) })
    const lateBefore = (await H.server()).onScreen
    await page.locator('#next-p').tap(); await sleep(4600)
    v = await H.view(page); const lateSrv = await H.server()
    c.ok('late: a Next the computer acted on is not reported as not reaching it', lateSrv.onScreen !== lateBefore && !/Couldn.t reach BORN/.test(v.toast || ''), `the screen moved "${lateBefore}" → "${lateSrv.onScreen}"; the phone says "${v.toast}" and shows ${v.conn ? 'Connected' : 'Reconnecting…'}`)
    await page.unrouteAll({ behavior: 'ignoreErrors' }); await sleep(2500)

    /* the back button, and rotation */
    await H.tapTab(page, 'queue')
    const h0 = await page.evaluate(() => history.length)
    await page.locator(V('.qstrip-card')).first().tap(); await sleep(500)
    const h1 = await page.evaluate(() => history.length)
    await page.goBack({ timeout: 3000 }).catch(() => {}); await sleep(600)
    const afterBack = await page.evaluate(() => ({ url: location.href, sheet: typeof state === 'object' ? document.getElementById('sheetOverlay').classList.contains('active') : null })).catch(() => ({ url: 'left the page' }))
    c.ok('back: the phone\'s back button closes an open full page', afterBack.sheet === false, `history entries ${h0} before and ${h1} after opening the page (opening adds none); after Back: ${afterBack.sheet === true ? 'the page is still open' : afterBack.url}`)
    if (!/127\.0\.0\.1/.test(afterBack.url)) { await page.goto(H.BASE + '/'); await page.waitForFunction(() => typeof setTab === 'function' && state.connOk === true); await page.locator(V('.qstrip-card')).first().tap(); await sleep(500) }
    await page.setViewportSize({ width: 844, height: 390 }); await sleep(1500)
    v = await H.view(page)
    const rot = await page.evaluate(() => { const s = document.getElementById('sheetBody').getBoundingClientRect(), ov = document.getElementById('sheetOverlay'); const x = document.querySelector('.sheet-close').getBoundingClientRect(); return { overlay: ov.classList.contains('active'), sheetH: Math.round(s.height), closeVisible: x.width > 0 && x.top >= 0 && x.bottom <= innerHeight, vh: innerHeight } })
    note(`rotated to 844x390 with a queue item's full page open: layout ${v.layout}, the page over the screen is ${rot.overlay ? 'still open (' + rot.sheetH + ' of ' + rot.vh + ' px high)' : 'closed'}, its close button ${rot.closeVisible ? 'in view' : 'out of view'}, right pane ${v.paneKind}, Next ${v.nextReachable ? 'reachable' : 'covered'}`)
    c.ok('rotate: after turning the phone on its side the live controls can be reached', v.nextReachable || !rot.overlay, `Next ${v.nextReachable ? 'reachable' : 'covered by the full page, which is shown both over the screen and in the right pane'}`)
    await page.setViewportSize({ width: 390, height: 844 }); await sleep(800); await page.evaluate(() => closeSheet())

    /* BORN closed, then started again */
    const full = await H.phone({ engine: ENG, role: 'Song Leader' })
    await full.locator(V('.qstrip-card')).nth(1).tap(); await sleep(500)
    const live0 = (await H.server()).onScreen
    await env.kill(); await sleep(1000)
    const down = await until(async () => (await H.view(page)).conn === false, 9000)
    c.ok('closed: with BORN closed the phone says Reconnecting within 5 s', down >= 0 && down <= 5000, `${down} ms`)
    const head2 = await text(page, '.now-head')
    note(`with BORN closed the phone's live card still reads "${head2.replace(/\s+/g, ' ')}" over "${(await H.view(page)).nowText}"`)
    await page.locator('#next-p').tap(); await sleep(500)
    c.ok('closed: a tap while BORN is closed says it was not sent', /Not connected to BORN/.test((await H.view(page)).toast || ''), `says "${(await H.view(page)).toast}"`)
    env = await H.start({ keepProfile: true })
    const up = await until(async () => (await H.view(page)).conn === true, 15000)
    const srvAfter = await H.server(); await sleep(1500); v = await H.view(page); const vf = await H.view(full)
    c.ok('restart: the phone reconnects on its own once BORN is back', up >= 0, `${up} ms after BORN's window was ready`)
    note(`after the restart the computer reports: queue ${JSON.stringify(srvAfter.queue)}, on screen ${JSON.stringify(srvAfter.onScreen)} (before: "${live0}")`)
    c.ok('restart: the phone shows what the restarted computer reports', (v.own.onScreen || null) === (srvAfter.onScreen || null) && (srvAfter.onScreen ? same(v, srvAfter) : /Nothing on screen yet/.test(await text(page, '#queuePerfNow'))), `phone "${v.nowText || (await text(page, '#queuePerfNow')).slice(0, 40)}"`)
    const stillThere = srvAfter.queue.includes(vf.sheetTitle)
    c.ok('restart: a full page left open on the other phone is still for an item in the queue, or has closed', !vf.sheetOpen || stillThere, `${H.where(vf)}; that item is ${stillThere ? 'still' : 'no longer'} in the queue the computer restored`)
  } finally {
    const r = c.done()
    fs.writeFileSync(path.join(out, `resilience-${ENG}.json`), JSON.stringify({ engine: ENG, failed: r.failed, checks: r.rows, notes }, null, 1))
    await H.closeBrowsers(); await env.kill()
  }
})()
