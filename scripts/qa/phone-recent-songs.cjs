/* The phone's requests that used to fail without a word, in the real app with headless Chromium and WebKit (scripts only, never shipped):
 *  - the recent songs, failed before the page loads: the Songs tab says "Couldn't load this from BORN." with Try again under Recently Played, and
 *    Try again (a real tap) shows the recent songs once the request succeeds;
 *  - Set key, whose list of recent keys cannot be read: the sheet says the same, with Try again, which opens the key picker;
 *  - a song search whose request fails says it could not reach BORN, not "Searching…" for ever;
 *  - a Bible passage that cannot be opened says so;
 *  - none of these leaves an unhandled error on the page.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/phone-recent-songs.cjs <profileDir>   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks } = require('./lib.cjs')
const pw = require(path.join(process.env.PW_DIR || '/tmp/born-pw', 'node_modules', 'playwright'))
const [profile] = process.argv.slice(2)
const PORT = Number(process.env.BORN_REMOTE_PORT || 14316), B = `http://127.0.0.1:${PORT}`
const cmd = (b) => fetch(B + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const hooks = ['--require', path.join(__dirname, 'hide-outputs.cjs')]
const LOAD_FAILED = /Couldn.t load this from BORN\./

;(async () => {
  const c = checks('phone-recent-songs')
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  const app = await launch({ profile, remotePort: PORT, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-recent', settle: 9000, extraArgs: hooks })
  // one song played, so there is a recent song to show once the request succeeds
  const songs = await (await fetch(B + '/api/search/songs?q=')).json()
  await cmd({ action: 'project-song', songId: songs[0].id }); await sleep(2000); await cmd({ action: 'blank' })
  const recent = await (await fetch(B + '/api/songs/recent')).json()
  c.ok('a song has been played (the recent songs are not empty)', recent.length > 0, recent.map((s) => s.title).join(', ').slice(0, 60))

  for (const [name, type] of [['chromium', pw.chromium], ['webkit', pw.webkit]]) {
    const browser = await type.launch()
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => { window.__unhandled = []; window.addEventListener('unhandledrejection', (e) => window.__unhandled.push(String(e.reason && e.reason.message || e.reason))) })
    const fail = (glob) => page.route(glob, (r) => r.fulfill({ status: 500, body: '{"error":"x"}', contentType: 'application/json' }))
    const songsText = () => page.evaluate(() => (document.getElementById('view-songs') || {}).innerText || '')
    const toastText = () => page.evaluate(() => { const t = document.getElementById('toast'); return t && t.style.display !== 'none' ? t.textContent : '' })
    const sheet = () => page.evaluate(() => (document.getElementById('sheetBody') || {}).innerText || '')
    const clean = async (label) => {
      const u = await page.evaluate(() => window.__unhandled)
      c.ok(`${name}: ${label}: no unhandled error`, u.length === 0 && errors.length === 0, JSON.stringify([u, errors]))
    }

    // ── the recent songs, failing before the page loads ──
    await fail('**/api/songs/recent')
    await page.goto(B + '/'); await page.waitForFunction(() => typeof setTab === 'function'); await page.waitForTimeout(2500)
    if (await page.locator('#roleSkipBtn').isVisible()) await page.locator('#roleSkipBtn').click() // the "Who's this?" prompt
    await page.evaluate(() => { try { dismissA2HS() } catch (_) { /* not shown */ } })
    await page.evaluate(() => setTab('songs')); await page.waitForTimeout(800)
    const before = await songsText()
    c.ok(`${name}: recent songs fail: Recently Played says "Couldn't load this from BORN."`, /RECENTLY PLAYED/i.test(before) && LOAD_FAILED.test(before), before.slice(0, 90).replace(/\n/g, ' '))
    const retry = page.locator('#view-songs button', { hasText: /^Try again$/ })
    c.ok(`${name}: recent songs fail: Try again is shown`, await retry.first().isVisible())
    c.ok(`${name}: the rest of the Songs tab still works (all songs listed)`, /ALL SONGS · \d+/i.test(before))
    await page.unroute('**/api/songs/recent')
    if (await retry.first().isVisible()) await retry.first().click(); await page.waitForTimeout(1500)
    const after = await songsText()
    c.ok(`${name}: Try again shows the recent songs once BORN answers`, !LOAD_FAILED.test(after) && after.includes(recent[0].title), after.slice(0, 90).replace(/\n/g, ' '))
    await clean('recent songs')

    // ── Set key ──
    await fail('**/api/songs/recent-keys')
    await page.evaluate((id) => selectSongById(id), songs[0].id); await page.waitForTimeout(1500)
    await page.evaluate(() => { closeSheet(); openKeyPickerSheet() }); await page.waitForTimeout(1500)
    const keyFail = await sheet()
    c.ok(`${name}: Set key whose list cannot be read says "Couldn't load this from BORN." with Try again`, LOAD_FAILED.test(keyFail) && /Try again/.test(keyFail), keyFail.slice(0, 80).replace(/\n/g, ' '))
    await page.unroute('**/api/songs/recent-keys')
    const keyRetry = page.locator('#sheetBody button', { hasText: /^Try again$/ })
    if (await keyRetry.isVisible()) await keyRetry.click(); else await page.evaluate(() => openKeyPickerSheet())
    await page.waitForTimeout(1500)
    const keyOk = await sheet()
    c.ok(`${name}: Try again opens the key picker`, /No key/.test(keyOk) && !LOAD_FAILED.test(keyOk), keyOk.slice(0, 60).replace(/\n/g, ' '))
    await page.evaluate(() => closeSheet())
    await clean('Set key')

    // ── a song search ──
    await page.route('**/api/search/songs?q=*', (r) => (/q=$/.test(r.request().url()) ? r.continue() : r.fulfill({ status: 500, body: '{"error":"x"}', contentType: 'application/json' })))
    await page.evaluate(() => setTab('songs')); await page.waitForTimeout(500)
    await page.locator('#songInput').fill('placeholder'); await page.waitForTimeout(1500)
    const search = await songsText()
    c.ok(`${name}: a song search that fails says it could not reach BORN, not "Searching…"`, /Couldn.t reach BORN/.test(search) && !/SEARCHING/i.test(search), search.slice(0, 90).replace(/\n/g, ' '))
    await page.unroute('**/api/search/songs?q=*')
    await page.locator('#songInput').fill('the'); await page.waitForTimeout(1500)
    c.ok(`${name}: searching again once BORN answers finds songs`, /\d+ RESULTS?/.test(await songsText()))
    await page.locator('#songInput').fill('')
    await clean('song search')

    // ── a Bible passage ──
    await fail('**/api/bible/chapter*')
    await page.evaluate(() => openChapterContext(43, 3, [16])); await page.waitForTimeout(1500)
    const t = await toastText()
    c.ok(`${name}: a Bible passage that cannot be opened says so`, LOAD_FAILED.test(t), t)
    await page.unroute('**/api/bible/chapter*')
    await clean('Bible passage')
    await browser.close()
  }
  const r = c.done(); await app.kill(); process.exit(r.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
