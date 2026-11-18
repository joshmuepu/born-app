/* The phone and its saved services and lists, in the real app with headless Chromium and WebKit (scripts only, never shipped):
 *  - Save under a name that already exists asks first (Cancel, Keep both, Replace it; Cancel first), and each answer does what it says;
 *  - a Save whose connection drops says it was not saved, never "Saved", and leaves no unhandled error on the page;
 *  - a list or sheet that cannot load says so with Try again, and Try again loads it (Open a saved service, Bible chapter, Series, a series'
 *    sermons, a sermon, On This Day, Recently Played); a song that cannot be opened says so;
 *  - the sermon series, when the computer cannot read them, are answered as an error (the phone says it could not load), not as an empty list.
 * The app runs with QA_FAULT_SERIES=1 (see fault-hooks.cjs); the other failures are made on the phone's side by failing that one request.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/phone-data-safety.cjs <profileDir>   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks } = require('./lib.cjs')
const pw = require(path.join(process.env.PW_DIR || '/tmp/born-pw', 'node_modules', 'playwright'))
const [profile] = process.argv.slice(2)
const PORT = Number(process.env.BORN_REMOTE_PORT || 14316), B = `http://127.0.0.1:${PORT}`
const cmd = (b) => fetch(B + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const saveDir = () => path.join(profile, 'saved-services')
const hooks = ['--require', path.join(__dirname, 'hide-outputs.cjs'), '--require', path.join(__dirname, 'fault-hooks.cjs')]

;(async () => {
  const c = checks('phone-data-safety')
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  const app = await launch({ profile, remotePort: PORT, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-safety', settle: 9000, extraArgs: hooks, env: { QA_FAULT_SERIES: '1' } })
  await cmd({ action: 'queue-bible', reference: 'Psalm 23:1-3', translation: 'KJV' }); await sleep(1500)

  const series = await fetch(B + '/api/sermons/series')
  c.ok('the computer cannot read the series: answered as an error, not an empty list', series.status >= 500, `status ${series.status} ${await series.text().then((t) => t.slice(0, 60))}`)

  for (const [name, type] of [['chromium', pw.chromium], ['webkit', pw.webkit]]) {
    const browser = await type.launch()
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => { window.__unhandled = []; window.addEventListener('unhandledrejection', (e) => window.__unhandled.push(String(e.reason && e.reason.message || e.reason))) })
    await page.goto(B + '/'); await page.waitForFunction(() => typeof setTab === 'function'); await page.waitForTimeout(2500)
    const sheet = () => page.evaluate(() => (document.getElementById('sheetBody') || {}).innerText || '')
    const toastText = () => page.evaluate(() => { const t = document.getElementById('toast'); return t && t.style.display !== 'none' ? t.textContent : '' })
    const retryShown = () => page.evaluate(() => !![...document.querySelectorAll('#sheetBody button, #view-bible button, .tablet-main button, button')].find((b) => /^Try again$/.test(b.textContent.trim()) && b.offsetParent !== null))
    const clickRetry = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Try again$/.test(x.textContent.trim()) && x.offsetParent !== null); if (b) b.click(); return !!b })
    const fail = (glob) => page.route(glob, (r) => r.fulfill({ status: 500, body: '{"error":"x"}', contentType: 'application/json' }))
    const unfail = (glob) => page.unroute(glob)

    // ── Save under a name that already exists ──
    const svc = `Invented Service ${name}`
    const file = path.join(saveDir(), `${svc}.born`), file2 = path.join(saveDir(), `${svc} (2).born`)
    for (const f of [file, file2]) fs.rmSync(f, { force: true })
    const save = async () => { await page.evaluate((n) => { saveQueueSheet(); document.getElementById('saveNameInput').value = n; doSaveQueue() }, svc); await page.waitForTimeout(1500) }
    await save()
    c.ok(`${name}: Save under a new name saves it`, fs.existsSync(file) && /Saved/.test(await toastText()), await toastText())
    fs.writeFileSync(file, '[]') // a different service already saved under this name
    await save()
    const asked = await page.evaluate(() => [...document.querySelectorAll('#sheetBody button')].map((b) => b.textContent.trim()).filter(Boolean))
    c.ok(`${name}: Save under a name that exists asks first: Cancel, Keep both, Replace it`, JSON.stringify(asked) === JSON.stringify(['Cancel', 'Keep both', 'Replace it']), JSON.stringify(asked))
    c.ok(`${name}: nothing is replaced while it asks`, fs.readFileSync(file, 'utf8') === '[]')
    const focusFirst = await page.evaluate(() => (document.activeElement || {}).textContent || '')
    c.ok(`${name}: Cancel is the default`, /^Cancel$/.test(focusFirst.trim()), focusFirst)
    const pressBtn = (label) => page.evaluate((l) => { const b = [...document.querySelectorAll('#sheetBody button')].find((x) => x.textContent.trim() === l); if (b) b.click(); return !!b }, label)
    await pressBtn('Cancel'); await page.waitForTimeout(1200)
    c.ok(`${name}: Cancel leaves the saved service as it was`, fs.readFileSync(file, 'utf8') === '[]' && !fs.existsSync(file2))
    await save(); await pressBtn('Keep both'); await page.waitForTimeout(1500)
    c.ok(`${name}: Keep both saves "Name (2)" and keeps the old one`, fs.existsSync(file2) && fs.readFileSync(file, 'utf8') === '[]' && /\(2\)/.test(await toastText()), await toastText())
    await save(); await pressBtn('Replace it'); await page.waitForTimeout(1500)
    c.ok(`${name}: Replace it replaces it`, JSON.parse(fs.readFileSync(file, 'utf8')).length === 1 && /Saved/.test(await toastText()), await toastText())
    for (const f of [file, file2]) fs.rmSync(f, { force: true })

    // ── the connection drops during Save ──
    await page.route('**/command', (r) => (/save-queue/.test(r.request().postData() || '') ? r.abort('connectionreset') : r.continue()))
    errors.length = 0; await page.evaluate(() => { window.__unhandled = [] })
    await page.evaluate((n) => { saveQueueSheet(); document.getElementById('saveNameInput').value = n; doSaveQueue() }, svc + ' dropped'); await page.waitForTimeout(2000)
    const dropToast = await toastText()
    const unhandled = await page.evaluate(() => window.__unhandled)
    c.ok(`${name}: a Save whose connection drops leaves no unhandled error`, unhandled.length === 0 && errors.length === 0, JSON.stringify([unhandled, errors]))
    c.ok(`${name}: it says it was not saved, never "Saved"`, /not saved|couldn.t save|couldn.t reach/i.test(dropToast) && !/^Saved/.test(dropToast), dropToast)
    await page.unroute('**/command'); await page.evaluate(() => { setConn(true); closeSheet() })

    // ── lists and sheets that cannot load ──
    const sheetCase = async (label, glob, open, loaded) => {
      await fail(glob); await page.evaluate(open); await page.waitForTimeout(1500)
      const text = await sheet()
      c.ok(`${name}: ${label}: says it could not load, with Try again`, /couldn.t load|could not be read|could not load/i.test(text) && !/Loading/.test(text) && await retryShown(), text.slice(0, 80).replace(/\n/g, ' '))
      await unfail(glob); await clickRetry(); await page.waitForTimeout(1500)
      const after = await sheet()
      c.ok(`${name}: ${label}: Try again loads it`, loaded(after), after.slice(0, 60).replace(/\n/g, ' '))
      await page.evaluate(() => closeSheet())
    }
    await sheetCase('Open a saved service', '**/api/services/recent', () => openSavedSheet(), (t) => !/Loading|couldn.t/i.test(t))
    await sheetCase('On This Day', '**/api/sermons/on-this-day', () => openOnThisDay(), (t) => !/Loading|couldn.t/i.test(t))
    await sheetCase('Recently Played', '**/api/sermons/recent', () => openRecentSermons(), (t) => !/Loading|couldn.t/i.test(t))
    await sheetCase('a sermon', '**/api/sermons/*/paragraphs', () => openSermonDetailSheet(1, 'Placeholder', ''), (t) => /Tap any part/.test(t) && !/couldn.t/i.test(t))
    await sheetCase('a series\' sermons', '**/api/sermons/by-ids*', () => { window._series = [{ n: 'Placeholder series', s: [1, 2] }]; pickSeries(0) }, (t) => !/Loading|couldn.t/i.test(t) && t.length > 20)
    // Series: the computer itself cannot read them (fault on), so Try again is offered and still says so
    await page.evaluate(() => openSeriesList()); await page.waitForTimeout(1500)
    const st = await sheet()
    c.ok(`${name}: Series the computer cannot read: says it could not load, with Try again (not an empty list)`, /couldn.t load|could not/i.test(st) && await retryShown(), st.slice(0, 80).replace(/\n/g, ' '))
    await page.evaluate(() => closeSheet())

    // Bible chapter
    await page.evaluate(() => setTab('bible')); await page.waitForTimeout(800)
    await fail('**/api/bible/chapter*')
    await page.evaluate(() => { pickBook(43) }); await page.waitForTimeout(500)
    await page.evaluate(() => { pickChapter(3) }); await page.waitForTimeout(1500)
    const chText = await page.evaluate(() => document.body.innerText)
    c.ok(`${name}: a Bible chapter that cannot load says so, with Try again (not "Loading…" for ever)`, /couldn.t load|could not/i.test(chText) && await retryShown(), (chText.match(/John 3[\s\S]{0,80}/) || [''])[0].replace(/\n/g, ' '))
    await unfail('**/api/bible/chapter*'); await clickRetry(); await page.waitForTimeout(1500)
    c.ok(`${name}: Try again loads the chapter`, /God so loved/.test(await page.evaluate(() => document.body.innerText)))

    // a song that cannot be opened
    await page.evaluate(() => setTab('songs')); await page.waitForTimeout(800)
    await fail('**/api/song/*'); errors.length = 0; await page.evaluate(() => { window.__unhandled = [] })
    await page.evaluate(() => selectSongById(1)); await page.waitForTimeout(1500)
    const songToast = await toastText()
    c.ok(`${name}: a song that cannot be opened says so`, /couldn.t open|could not|couldn.t load/i.test(songToast), songToast)
    c.ok(`${name}: and leaves no unhandled error`, (await page.evaluate(() => window.__unhandled)).length === 0 && errors.length === 0)
    await unfail('**/api/song/*')
    await browser.close()
  }
  const r = c.done(); await app.kill(); process.exit(r.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
