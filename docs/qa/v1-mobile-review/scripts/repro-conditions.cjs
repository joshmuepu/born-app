/* The reported bug under the conditions of a real service. One phone (Operator) projects a song two ways (from the song search with Project,
 * and from its queue row by tapping a verse) while: nothing is live, the same song is live, another song is live, a Bible verse is live, the song
 * is very long, its key was just changed, a second phone is connected, the network is slow, the answer to the tap comes too late, the network
 * drops at the tap, and the page was asleep just before. Recorded each time: where the phone ends up, and what the computer reports.
 * Usage: PW_DIR=/tmp/born-pw node docs/qa/v1-mobile-review/scripts/repro-conditions.cjs [outDir]   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const H = require('./harness.cjs')
const out = process.argv[2] || path.join(__dirname, '..', 'evidence')
const ENGINES = (process.env.ENGINES || 'chromium,webkit').split(',')
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean)
const CONDITIONS = ['nothing-live', 'same-song-live', 'other-song-live', 'bible-live', 'long-song', 'key-changed', 'second-phone', 'slow', 'late-answer', 'dropped', 'asleep']

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const c = H.checks('repro-conditions')
  const env = await H.start()
  const rows = []
  const projectQueued = async (title) => { const s = await H.server(); const i = s.queue.findIndex((t) => t.startsWith(title)); if (i >= 0) await H.cmd({ action: 'project', id: s.ids[i] }); await H.sleep(900) }
  try {
    for (const eng of ENGINES) for (const cond of CONDITIONS) for (const way of ['search', 'queue']) {
      if (ONLY.length && !ONLY.includes(cond)) continue
      if (cond === 'asleep' && eng !== 'chromium') continue // the page can only be frozen and woken through Chromium's own debugging protocol
      const title = cond === 'long-song' ? 'The Long Road Song' : way === 'queue' ? 'Morning Song' : 'River Song'
      await H.reset()
      await H.cmd({ action: 'update-song-key', songId: env.ids['River Song'], key: null }); await H.cmd({ action: 'update-song-key', songId: env.ids['Morning Song'], key: null })
      for (const t of ['Morning Song', 'Evening Song', 'The Long Road Song']) await H.cmd({ action: 'queue-song', songId: env.ids[t] })
      await H.cmd({ action: 'queue-bible', reference: 'John 3:16', translation: 'KJV' }); await H.sleep(1200)
      if (cond === 'same-song-live') { if (way === 'queue') await projectQueued(title); else { await H.cmd({ action: 'project-song', songId: env.ids[title], slide: 0 }); await H.sleep(900) } }
      if (cond === 'other-song-live') await projectQueued('Evening Song')
      if (cond === 'bible-live') await projectQueued('John 3:16')
      if (cond === 'key-changed') { await H.cmd({ action: 'update-song-key', songId: env.ids[title], key: 'D' }); await H.sleep(500) }
      const page = await H.phone({ engine: eng })
      const second = cond === 'second-phone' ? await H.phone({ engine: eng, role: 'Song Leader' }) : null
      if (cond === 'slow') await page.route('**/*', async (r) => { await H.sleep(1500); r.continue().catch(() => {}) })
      await H.openSong(page, way, title)
      if (cond === 'late-answer') await page.route('**/command', async (r) => { const res = await r.fetch(); await H.sleep(5500); r.fulfill({ response: res }).catch(() => {}) })
      if (cond === 'asleep') {
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Page.setWebLifecycleState', { state: 'frozen' })
        await projectQueued('Evening Song'); await H.sleep(6000) // the service moves on while the phone is asleep
        await cdp.send('Page.setWebLifecycleState', { state: 'active' }); await H.sleep(1500)
      }
      if (cond === 'dropped') { await page.context().setOffline(true); setTimeout(() => page.context().setOffline(false).catch(() => {}), 3000) }
      // (a new service leaves the last page on the screen, so the screen before the tap is recorded and the dropped tap aims at another verse)
      const before = await H.server()
      const target = way === 'queue' ? page.locator(H.V('.slide-row')).nth(cond === 'dropped' ? 2 : 1) : page.locator(H.V('.btn-project')).first()
      await target.tap()
      const seen = []; const watch = setInterval(() => page.evaluate(() => { const t = document.getElementById('toast'); return t && t.style.display === 'block' ? t.textContent : null }).then((t) => { if (t && !seen.includes(t)) seen.push(t) }).catch(() => {}), 300)
      await H.sleep(cond === 'slow' ? 9000 : cond === 'late-answer' ? 8000 : cond === 'dropped' ? 6000 : 2600)
      clearInterval(watch)
      const v = await H.view(page), srv = await H.server(); v.toastSeen = seen.join(' / ')
      const live = (srv.onScreen || '').startsWith(title)
      const tag = `${eng} ${cond} ${way}`
      const sent = !(cond === 'dropped')
      c.ok(sent ? `${tag}: the computer went live with the song` : `${tag}: a tap made with no network does not go live later`, sent ? live : srv.onScreen === before.onScreen, `on screen before "${before.onScreen}", after "${srv.onScreen}"`)
      c.ok(`${tag}: the phone is on the live view, showing what the computer shows`, sent ? H.onLiveView(v) && (v.nowText || '').startsWith((srv.onScreen || '').slice(0, 20)) : v.own.onScreen === srv.onScreen && /reach BORN|not sent/i.test(v.toastSeen || v.toast || ''), `${H.where(v)}${v.toastSeen ? '; said "' + v.toastSeen + '"' : ''}; phone holds "${v.own.onScreen}", computer "${srv.onScreen}"`)
      let vSecond = null
      if (second) { vSecond = await H.view(second); c.ok(`${tag}: the second phone shows the same`, (vSecond.nowText || '').startsWith((srv.onScreen || '').slice(0, 20)), `second phone now: ${vSecond.nowText}`); await second.context().close() }
      rows.push({ tag, phone: v, second: vSecond, server: { onScreen: srv.onScreen, activeTitle: srv.activeTitle, activeSlide: srv.activeSlide, queue: srv.queue }, errs: page.errs })
      await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {}); await page.context().close()
    }
  } finally {
    const r = c.done()
    fs.writeFileSync(path.join(out, 'repro-conditions.json'), JSON.stringify({ failed: r.failed, checks: r.rows, rows }, null, 1))
    await H.closeBrowsers(); await env.kill()
  }
})()
