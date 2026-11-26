/* The reported bug: "when you start projecting a song from the phone, the phone stays on a different page that shows the full song".
 * For each role, layout and way in (song search, Recently played, a queue row) this projects a song with real taps and records, right
 * after and again after leaving the Queue and coming back: what the phone shows, what its own script holds, and what the computer reports.
 * Usage: PW_DIR=/tmp/born-pw node docs/qa/v1-mobile-review/scripts/repro-project-song.cjs [outDir]   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const H = require('./harness.cjs')
const out = process.argv[2] || path.join(__dirname, '..', 'evidence')
const ENGINES = (process.env.ENGINES || 'chromium,webkit').split(',')
const SIZES = [['phone', [390, 844]], ['tablet', [768, 1024]]]
const ROLES = ['Operator', 'Song Leader', 'Preacher']
const WAYS = ['search', 'search-verse', 'recent', 'queue-row']
const V = (sel) => `${sel} >> visible=true`

async function tapTab(page, tab) { await page.locator(V(`.tab[data-tab="${tab}"], .sidebar-tab[data-tab="${tab}"]`)).first().tap(); await H.sleep(500) }

async function run(page, way, layout) {
  if (way === 'queue-row') {
    await tapTab(page, 'queue')
    const row = layout === 'phone' ? page.locator(V('.qstrip-card')).filter({ hasText: 'Morning Song' }) : page.locator(V('#tabletList .qitem')).filter({ hasText: 'Morning Song' })
    await row.first().tap(); await H.sleep(500)
    await page.locator(V('.slide-row')).first().tap()
    return
  }
  await tapTab(page, 'songs')
  if (way === 'recent') await page.locator(V('.recent-item')).filter({ hasText: 'River Song' }).first().tap()
  else {
    await page.locator(V('#songInput, #songInputT')).first().fill('River'); await H.sleep(900)
    await page.locator(V('.song-row')).filter({ hasText: 'River Song' }).first().tap()
  }
  await H.sleep(700)
  if (way === 'search-verse') await page.locator(V('.slide-row')).nth(1).tap()
  else await page.locator(V('.btn-project')).first().tap()
}

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const c = H.checks('repro-project-song')
  const env = await H.start()
  const rows = []
  try {
    for (const eng of ENGINES) for (const [layout, size] of SIZES) for (const role of ROLES) for (const way of WAYS) {
      await H.reset()
      await H.cmd({ action: 'queue-song', songId: env.ids['Morning Song'] }); await H.cmd({ action: 'queue-song', songId: env.ids['Evening Song'] }); await H.sleep(900)
      const page = await H.phone({ engine: eng, size, role })
      const before = await H.server()
      await run(page, way, layout); await H.sleep(2600)
      const after = await H.view(page), srv = await H.server()
      const want = way === 'queue-row' ? 'Morning Song' : 'River Song'
      const tag = `${eng} ${layout} ${role} ${way}`
      // the phone is "on the live view" when the Queue tab is showing now/next and Next can be tapped
      const onLiveView = after.tab === 'queue' && !after.sheetOpen && (layout === 'phone' ? !!after.nowText : after.paneKind === 'now-next')
      // a song projected from Songs goes on screen without joining the queue, so the screen's own text is what is compared
      c.ok(`${tag}: the computer went live with the song`, (srv.onScreen || '').startsWith(want), `on screen: ${srv.onScreen}; queue row live: ${srv.activeTitle}`)
      c.ok(`${tag}: the phone shows the live view after the tap`, onLiveView, layout === 'phone' ? `tab ${after.tab}, sheet ${after.sheetOpen ? 'open "' + after.sheetTitle + '"' : 'closed'}, Next reachable ${after.nextReachable}` : `tab ${after.tab}, right pane ${after.paneKind}${after.paneTitle ? ' "' + after.paneTitle + '"' : ''}`)
      let shot = null
      if (!onLiveView && eng === ENGINES[0] && role === 'Operator') { shot = `stuck-${layout}-${way}.png`; await page.screenshot({ path: path.join(out, shot), scale: 'css' }) }
      // on a tablet-width screen the full song sits in the right pane: does tapping Queue again bring the live view back?
      if (!onLiveView && layout === 'tablet') { await tapTab(page, 'queue'); await H.sleep(1300); const again = await H.view(page); c.ok(`${tag}: tapping Queue again brings the live view back`, H.onLiveView(again), H.where(again)) }
      // the owner's way out: tap somewhere else, then come back to the Queue
      if (after.sheetOpen) { await page.mouse.click(10, 10); await H.sleep(300) }
      await tapTab(page, 'songs'); await tapTab(page, 'queue'); await H.sleep(1300)
      const back = await H.view(page)
      const backLive = back.tab === 'queue' && !back.sheetOpen && (layout === 'phone' ? !!back.nowText : back.paneKind === 'now-next')
      c.ok(`${tag}: the live view shows after leaving the Queue and coming back`, backLive, layout === 'phone' ? `now: ${back.nowText}` : `right pane ${back.paneKind}`)
      rows.push({ tag, before: { activeTitle: before.activeTitle }, after, server: { activeTitle: srv.activeTitle, activeSlide: srv.activeSlide, onScreen: srv.onScreen }, back: { tab: back.tab, sheetOpen: back.sheetOpen, paneKind: back.paneKind, nowText: back.nowText, own: back.own }, shot, errs: page.errs })
      await page.context().close()
    }
  } finally {
    const r = c.done()
    fs.writeFileSync(path.join(out, 'repro-project-song.json'), JSON.stringify({ failed: r.failed, checks: r.rows, rows }, null, 1))
    await H.closeBrowsers(); await env.kill()
  }
})()
