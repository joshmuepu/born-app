/* Phone/iPad remote viewport sweep (scripts only, never shipped). Launches BORN v1 on an isolated profile, then loads the real remote
 * page in WebKit (iOS Safari) and Chromium at 7 phone/tablet sizes, portrait and landscape, at 100% and 150% page zoom, with the
 * on-screen keyboard simulated, and as a Home Screen app. Per screen it records: horizontal scroll, controls off-screen, controls
 * covered by something else, buttons whose label is cut off, tap targets under 44 px, and text under 11 px.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/remote-viewports.cjs <profileDir> <outDir>   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep } = require('./lib.cjs')
const pw = require(path.join(process.env.PW_DIR || '/tmp/born-pw', 'node_modules', 'playwright'))
const [profile, out] = [process.argv[2] || path.join(require('os').tmpdir(), 'born-v1-viewports'), process.argv[3] || path.join(require('os').tmpdir(), 'born-v1-viewports-out')]
const PORT = Number(process.env.BORN_REMOTE_PORT || 14316), BASE = `http://127.0.0.1:${PORT}`
const DEVICES = [['iphone-se', 375, 667, 2], ['iphone', 390, 844, 3], ['iphone-large', 430, 932, 3], ['android-small', 360, 740, 3], ['ipad-mini', 744, 1133, 2], ['ipad', 820, 1180, 2], ['ipad-pro', 1024, 1366, 2]]
const UA = { phone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', tablet: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' }
const TABS = ['queue', 'sermons', 'bible', 'songs']

// measured inside the page: everything visible and interactive in the current screen
const MEASURE = () => {
  const W = innerWidth, H = innerHeight
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0 }
  const inScroller = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true; if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return 'y' } return false }
  const name = (e) => (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + ((e.getAttribute('aria-label') || e.textContent || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 24)) + '"'
  const ctl = [...document.querySelectorAll('button,a[href],input,select,textarea,[onclick],[role=button],.tab,.sidebar-tab')].filter(vis)
  const r = { hscroll: document.documentElement.scrollWidth > W + 1 || document.body.scrollWidth > W + 1, offscreen: [], covered: [], cutLabel: [], small: [], tinyText: [] }
  for (const e of ctl) {
    const b = e.getBoundingClientRect()
    const sc = inScroller(e)
    if (!sc && (b.right > W + 1 || b.left < -1)) r.offscreen.push(name(e))
    // only judge what is on screen now (things scrolled out of a list are fine)
    if (b.bottom <= 0 || b.top >= H || b.right <= 0 || b.left >= W) continue
    const cx = Math.min(W - 1, Math.max(0, b.left + b.width / 2)), cy = Math.min(H - 1, Math.max(0, b.top + b.height / 2))
    const top = document.elementFromPoint(cx, cy)
    if (top && !(top === e || e.contains(top) || top.contains(e)) && !top.closest('.sheet,.sheet-overlay,#sheetOverlay,#roleOverlay,.toast')) r.covered.push(name(e) + ' under ' + name(top))
    if ((e.tagName === 'BUTTON' || e.classList.contains('tab')) && (e.scrollWidth > e.clientWidth + 2) && getComputedStyle(e).textOverflow !== 'ellipsis') r.cutLabel.push(name(e))
    if (Math.min(b.width, b.height) < 44 && e.tagName !== 'INPUT') r.small.push(name(e) + ` ${Math.round(b.width)}x${Math.round(b.height)}`)
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement; if (!el || seen.has(el) || !n.textContent.trim() || !vis(el)) continue; seen.add(el)
    const b = el.getBoundingClientRect(); if (b.bottom <= 0 || b.top >= H) continue
    const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11) r.tinyText.push(name(el) + ' ' + fs + 'px')
  }
  for (const k of ['offscreen', 'covered', 'cutLabel', 'small', 'tinyText']) r[k] = [...new Set(r[k])]
  return r
}

let app
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  app = await launch({ profile, remotePort: PORT, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-e2e', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  // a queue to look at: two songs, a Bible passage, a sermon paragraph (whatever the bundled libraries return first)
  const j = (u) => fetch(BASE + u).then((r) => r.json())
  const cmd = (b) => fetch(BASE + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
  const songs = await j('/api/search/songs?q=grace'); for (const s of songs.slice(0, 2)) await cmd({ action: 'queue-song', songId: s.id })
  await cmd({ action: 'queue-bible', reference: 'John 3:16-18', translation: 'KJV' })
  const serm = await j('/api/search/sermons?q=faith'); if (serm[0]) await cmd({ action: 'queue-sermon', quote: serm[0] })
  await sleep(1500)
  const st = await j('/state'); const firstId = st.queue?.[0]?.id; if (firstId !== undefined) await cmd({ action: 'project', id: firstId })
  await sleep(1000)

  const results = []
  const engines = (process.env.ENGINES || 'webkit,chromium').split(',')
  for (const eng of engines) {
    const browser = await pw[eng].launch(eng === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
    for (const [dev, w, h, dpr] of DEVICES) {
      const tablet = w >= 744
      for (const orient of ['portrait', 'landscape']) {
        for (const zoom of [1, 1.5]) {
          const vw = Math.round((orient === 'portrait' ? w : h) / zoom), vh = Math.round((orient === 'portrait' ? h : w) / zoom)
          const ua = eng === 'webkit' ? (tablet ? UA.tablet : UA.phone) : UA.android
          const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, isMobile: eng === 'chromium', hasTouch: true, userAgent: ua, serviceWorkers: 'block' })
          const page = await ctx.newPage(); const errs = []
          page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
          await page.goto(BASE + '/'); await page.waitForFunction(() => typeof setTab === 'function', null, { timeout: 20000 })
          await sleep(1200)
          const tag = `${eng}-${dev}-${orient}-${zoom * 100}`
          // first-run sheets as a phone sees them
          const first = await page.evaluate(MEASURE)
          await page.screenshot({ path: path.join(out, tag + '-first.png') })
          results.push({ tag, screen: 'first-run', ...first, errs: [] })
          await page.evaluate(() => { try { document.getElementById('roleSkipBtn')?.click() } catch (_) {} try { dismissA2HS() } catch (_) {} })
          await sleep(400)
          for (const tab of TABS) {
            await page.evaluate((t) => setTab(t), tab); await sleep(700)
            const m = await page.evaluate(MEASURE)
            if (zoom === 1 || tab === 'queue') await page.screenshot({ path: path.join(out, `${tag}-${tab}.png`) })
            results.push({ tag, screen: tab, ...m })
          }
          // on-screen keyboard: the visible area shrinks while a search box has focus
          if (zoom === 1) {
            await page.evaluate(() => setTab('sermons')); await sleep(300)
            await page.focus(tablet ? '#sermonInputT' : '#sermonInput').catch(() => {})
            const kb = Math.round(vh * (orient === 'portrait' ? 0.42 : 0.6))
            await page.setViewportSize({ width: vw, height: vh - kb }); await sleep(900)
            const k = await page.evaluate(() => { const e = document.activeElement; if (!e || e.tagName !== 'INPUT') return { focused: false }; const b = e.getBoundingClientRect(); return { focused: true, inView: b.top >= 0 && b.bottom <= innerHeight, top: Math.round(b.top), bottom: Math.round(b.bottom), h: innerHeight } })
            await page.screenshot({ path: path.join(out, tag + '-keyboard.png') })
            results.push({ tag, screen: 'keyboard', keyboard: k })
          }
          results.push({ tag, screen: 'errors', errs })
          await ctx.close()
        }
      }
    }
    // installed on the Home Screen (standalone), portrait and landscape, at each size
    if (eng === 'webkit') {
      for (const [dev, w, h, dpr] of DEVICES) for (const orient of ['portrait', 'landscape']) {
        const vw = orient === 'portrait' ? w : h, vh = orient === 'portrait' ? h : w
        const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: true, userAgent: w >= 744 ? UA.tablet : UA.phone, serviceWorkers: 'block' })
        await ctx.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)) })
        const page = await ctx.newPage(); await page.goto(BASE + '/'); await page.waitForFunction(() => typeof setTab === 'function'); await sleep(1300)
        const tag = `standalone-${dev}-${orient}`
        const first = await page.evaluate(MEASURE); results.push({ tag, screen: 'first-run', ...first, a2hsShown: await page.evaluate(() => { const e = document.getElementById('a2hsSheet') || document.querySelector('[id^=a2hs]'); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0 }) })
        await page.evaluate(() => { try { document.getElementById('roleSkipBtn')?.click() } catch (_) {} }); await sleep(300)
        await page.evaluate(() => setTab('queue')); await sleep(500)
        results.push({ tag, screen: 'queue', ...(await page.evaluate(MEASURE)) })
        await page.screenshot({ path: path.join(out, tag + '-queue.png') })
        await ctx.close()
      }
    }
    await browser.close()
  }
  fs.writeFileSync(path.join(out, 'viewports.json'), JSON.stringify(results, null, 1))
  // summary: counts per problem kind, and the distinct problems
  const kinds = ['hscroll', 'offscreen', 'covered', 'cutLabel', 'small', 'tinyText']
  const sum = {}
  for (const r of results) for (const k of kinds) { const v = r[k]; const n = Array.isArray(v) ? v.length : v ? 1 : 0; if (n) { sum[k] = sum[k] || { screens: 0, distinct: new Set() }; sum[k].screens++; (Array.isArray(v) ? v : [r.tag]).forEach((x) => sum[k].distinct.add(Array.isArray(v) ? x : 'hscroll')) } }
  for (const k of Object.keys(sum)) console.log(`${k}: on ${sum[k].screens} screens; ${sum[k].distinct.size} distinct`)
  const kbBad = results.filter((r) => r.keyboard && r.keyboard.focused && !r.keyboard.inView).map((r) => r.tag)
  console.log('keyboard covers the focused field:', kbBad.length, kbBad.slice(0, 6).join(' '))
  console.log('page errors:', results.filter((r) => r.errs && r.errs.length).length)
  console.log('screens measured:', results.filter((r) => r.screen !== 'errors').length)
  await app.kill()
})().catch(async (e) => { console.error(e); if (app) await app.kill(); process.exit(2) })
