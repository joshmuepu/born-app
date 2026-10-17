const { app } = require('./lib.cjs')
const fs = require('fs')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); if (!ok) console.log('FAIL', name, detail) }
;(async () => {
  const { browser, page } = await app()
  await page.click('.rail-btn:has-text("Songs")'); await sleep(300)
  await page.click('.songs-panel .panel-subtab:has-text("Browse")'); await sleep(1800)
  const probe = () => page.evaluate(() => {
    const sc = document.querySelector('.songs-all-list')
    const sr = sc.getBoundingClientRect()
    const heads = [...sc.querySelectorAll('.songs-letter-head')]
    const rowsEls = [...sc.querySelectorAll('.song-row')]
    // first thing visible at the top
    const topHead = heads.find((h) => h.getBoundingClientRect().bottom > sr.top + 1)
    const firstRow = rowsEls.find((r) => r.getBoundingClientRect().bottom > sr.top + 1)
    const cur = document.querySelector('.songs-azrail-btn.is-current')
    return {
      scrollTop: Math.round(sc.scrollTop),
      topHead: topHead && topHead.textContent.trim(),
      topHeadTop: topHead && Math.round(topHead.getBoundingClientRect().top - sr.top),
      firstRowTop: firstRow && Math.round(firstRow.getBoundingClientRect().top - sr.top),
      firstRowBottomInside: firstRow && firstRow.getBoundingClientRect().bottom <= sr.bottom + 1,
      headBottom: topHead && Math.round(topHead.getBoundingClientRect().bottom - sr.top),
      currentRail: cur && cur.textContent.trim(),
      headLetter: topHead && topHead.textContent.trim()
    }
  })
  for (const theme of [['dark', false], ['light', false], ['dark', true], ['light', true]]) {
    await page.evaluate(([t, c]) => { document.documentElement.dataset.theme = t; if (c) document.documentElement.dataset.contrast = 'true'; else delete document.documentElement.dataset.contrast }, theme)
    for (const view of ['grid', 'list']) {
      await page.click(`.songs-view-toggle button[aria-label="${view === 'grid' ? 'Grid view' : 'List view'}"]`); await sleep(500)
      const letters = await page.$$eval('.songs-azrail-btn:not(.is-empty)', (b) => b.map((x) => x.textContent.trim()))
      const tag = `${theme[1] ? 'hc-' : ''}${theme[0]}/${view}`
      for (const l of letters) {
        await page.click(`.songs-azrail-btn:text-is("${l}")`); await sleep(250)
        const p = await probe()
        const nearEnd = p.scrollTop > 0 && (await page.evaluate(() => { const sc = document.querySelector('.songs-all-list'); return sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2 }))
        // for the last letters the list may be unable to scroll further; the head must still be fully visible
        const headVisible = p.topHead === l && p.topHeadTop >= -1 && p.headBottom > 0
        const atTop = nearEnd ? true : Math.abs(p.topHeadTop) <= 2
        check(`${tag} jump to ${l}: head visible${nearEnd ? ' (list end)' : ' at top'}`, headVisible && atTop, JSON.stringify(p))
        // the first song of the letter must be fully visible directly under the head (not hidden)
        const under = await page.evaluate((letter) => {
          const sc = document.querySelector('.songs-all-list'); const sr = sc.getBoundingClientRect()
          const h = [...sc.querySelectorAll('.songs-letter-head')].find((x) => x.textContent.trim() === letter)
          let n = h.parentElement.nextElementSibling
          const r = n && n.querySelector('.song-row')
          if (!r) return null
          const b = r.getBoundingClientRect()
          return { top: Math.round(b.top - sr.top), bottom: Math.round(b.bottom - sr.top), h: Math.round(sr.height), headBottom: Math.round(h.getBoundingClientRect().bottom - sr.top) }
        }, l)
        check(`${tag} jump to ${l}: first song fully visible below the header`, !!under && under.top >= under.headBottom - 1 && under.bottom <= under.h + 1, JSON.stringify(under))
        check(`${tag} jump to ${l}: rail highlights ${l}`, p.currentRail === l, JSON.stringify({ rail: p.currentRail }))
      }
      // manual scrolling: pill/rail must follow the first visible row's letter
      for (const y of [0, 900, 2500, 6000]) {
        await page.evaluate((top) => { document.querySelector('.songs-all-list').scrollTop = top }, y); await sleep(250)
        const p = await page.evaluate(() => {
          const sc = document.querySelector('.songs-all-list'); const sr = sc.getBoundingClientRect()
          const items = [...sc.querySelectorAll('.songs-letter-head, .song-row')]
          // first element whose bottom is below the top edge
          const first = items.find((e) => e.getBoundingClientRect().bottom > sr.top + 1)
          let letter = null
          // walk back to the nearest preceding head
          const all = [...sc.querySelectorAll('.songs-letter-head, .song-row')]
          for (let i = all.indexOf(first); i >= 0; i--) if (all[i].classList.contains('songs-letter-head')) { letter = all[i].textContent.trim(); break }
          const cur = document.querySelector('.songs-azrail-btn.is-current')
          return { letter, rail: cur && cur.textContent.trim() }
        })
        check(`${tag} scroll to ${y}: rail follows (${p.letter})`, p.letter === p.rail, JSON.stringify(p))
      }
    }
  }
  fs.writeFileSync(process.argv[2] + '/az-results.json', JSON.stringify(results, null, 1))
  console.log(results.length, 'checks,', results.filter((r) => !r.ok).length, 'failed')
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
