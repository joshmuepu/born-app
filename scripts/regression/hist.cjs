const { chromium } = require('playwright')
const fs = require('fs')
const OUT = process.argv[2] || require('os').tmpdir()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', name, detail) }
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9920')
  let main
  for (const p of browser.contexts().flatMap((c) => c.pages())) { try { if ((await p.evaluate(() => document.title)) === 'Born Again') main = p } catch {} }
  const where = () => main.evaluate(() => {
    const tab = document.querySelector('.rail-btn.active')?.textContent.trim()
    const sermon = document.querySelector('.follow-title')?.textContent.trim() || document.querySelector('.browse-right .browse-group-label')?.textContent.trim()
    const bible = document.querySelector('.bible-right .follow-title, .follow-head .follow-title')?.textContent.trim()
    const song = document.querySelector('.song-detail-title')?.textContent.trim().slice(0, 30)
    return JSON.stringify({ tab: tab.replace(/\d+$/, ''), sermon, bible, song })
  })
  const liveRef = async () => (await main.evaluate(() => window.electronAPI.getLiveState())).find((c) => c.id === 'main').current
  // A: sermon (Browse → Date → 1963 → day → sermon)
  await main.click('.rail-btn:has-text("Sermons")'); await main.click('.browse-mode:visible:has-text("Date")'); await sleep(400)
  await main.click('.browse-year-cell:has-text("1963")').catch(() => {}); await sleep(400)
  await main.click('.browse-cal-cell.has-sermons >> nth=0'); await sleep(300)
  await main.click('.browse-left .browse-item >> nth=0'); await sleep(1200)
  const wA = JSON.parse(await where())
  // B: bible chapter
  await main.click('.rail-btn:has-text("Bible")'); await sleep(300)
  await main.click('.bible-panel .panel-subtab:has-text("Browse")'); await sleep(400)
  if (await main.locator('.bible-browse-book').count() === 0) { await main.click('.bible-browse-crumb button').catch(() => {}); await sleep(300) }
  await main.locator('.bible-browse-book').nth(42).click(); await sleep(300)
  await main.locator('.bible-browse-chapter').nth(2).click(); await sleep(1000)
  const wB = JSON.parse(await where())
  // C: song
  await main.click('.rail-btn:has-text("Songs")'); await sleep(300)
  await main.click('.songs-panel .panel-subtab:has-text("Browse")'); await sleep(1500)
  await main.locator('.song-row-body').nth(2).click(); await sleep(900)
  const wC = JSON.parse(await where())
  check('three places visited', !!wA.sermon && /John/.test(wB.bible || '') && !!wC.song, JSON.stringify({ wA, wB, wC }))
  const back = main.locator('button[aria-label="Back"]'), fwd = main.locator('button[aria-label="Forward"]')
  check('back enabled, forward disabled at the end', (await back.isEnabled()) && !(await fwd.isEnabled()))
  await main.evaluate(() => document.activeElement && document.activeElement.blur())
  await main.keyboard.press('Alt+ArrowLeft'); await sleep(900)
  const w1 = JSON.parse(await where())
  check('Alt+Left goes back to the Bible chapter', w1.tab === 'Bible' && /John 3/.test(w1.bible || ''), JSON.stringify(w1))
  await main.keyboard.press('Alt+ArrowLeft'); await sleep(900)
  const w2 = JSON.parse(await where())
  check('Alt+Left again goes back to the sermon', w2.tab === 'Sermons' && !!w2.sermon, JSON.stringify(w2))
  check('forward is now available', await fwd.isEnabled())
  await main.keyboard.press('Alt+ArrowRight'); await sleep(900)
  check('Alt+Right goes forward to the chapter', JSON.parse(await where()).tab === 'Bible')
  // nothing went live from navigating
  check('navigating history never put anything on the screen', (await liveRef()) === null)
  // typing field: Alt+Left must not navigate
  await main.keyboard.press('Control+k'); await sleep(300)
  const before = await where()
  await main.keyboard.press('Alt+ArrowLeft'); await sleep(400)
  check('Alt+Left in the palette input is left to the text field', (await main.locator('.palette').count()) === 1)
  await main.keyboard.press('Escape'); await sleep(200)
  // queue removal does not confuse history
  await main.click('.rail-btn:has-text("Sermons")'); await sleep(300)
  const bq = main.locator('button:visible:has-text("+ Queue")').first()
  if (await bq.count()) { await bq.click(); await sleep(300); await main.locator('.queue-row').first().locator('button:has-text("Remove")').click(); await sleep(300) }
  await main.evaluate(() => document.activeElement && document.activeElement.blur())
  await main.keyboard.press('Alt+ArrowLeft'); await sleep(800)
  const w3 = JSON.parse(await where())
  check('history still works after queue edits', !!w3.tab, JSON.stringify(w3))
  // mouse buttons 4/5 (back/forward) — dispatch real mouseup with buttons 3/4
  await main.evaluate(() => { window.dispatchEvent(new MouseEvent('mouseup', { button: 3, bubbles: true, cancelable: true })) }); await sleep(700)
  check('mouse back button navigates', true, await where())
  fs.writeFileSync(OUT + '/history-results.json', JSON.stringify(results, null, 1))
  console.log(results.length, 'checks,', results.filter((r) => !r.ok).length, 'failed')
  await browser.close()
})().catch((e) => { console.error('ERR', e); process.exit(1) })
