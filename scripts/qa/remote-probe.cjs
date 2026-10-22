/* Phone-remote probe: launches BORN v1 on an isolated profile/port, then drives the remote page in headless Chromium and WebKit
 * (Playwright from PW_DIR, never a dependency). Usage: node scripts/qa/remote-probe.cjs [profileDir]   (needs `npm run build`) */
const path = require('path')
const { launch, checks, sleep } = require('./lib.cjs')
const PW = process.env.PW_DIR || '/tmp/born-pw'
const pw = require(path.join(PW, 'node_modules', 'playwright'))
const profile = process.argv[2] || path.join(require('os').tmpdir(), 'born-v1-remote-profile')
const PORT = 14316, BASE = `http://127.0.0.1:${PORT}`

const fakeRow = (t) => ({ sermonId: 1, sermonTitle: t, dateCode: '47-0412', paragraphRef: '1', text: 'placeholder text', highlightedText: 'placeholder text', slides: [] })

;(async () => {
  const c = checks('remote-probe')
  const app = await launch({ profile, remotePort: PORT, settle: 6000 })

  // ── server-level checks (no browser) ────────────────────────────────────
  const root = await fetch(BASE + '/')
  const h = Object.fromEntries(root.headers.entries())
  c.ok('remote page cannot be framed (X-Frame-Options / frame-ancestors)', /deny/i.test(h['x-frame-options'] || '') && /frame-ancestors\s+'none'/.test(h['content-security-policy'] || ''), JSON.stringify({ xfo: h['x-frame-options'], csp: h['content-security-policy'] }))
  const big = await fetch(BASE + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'noop', pad: 'x'.repeat(400 * 1024) }) })
  c.ok('an oversized /command body is refused with 413', big.status === 413, 'status ' + big.status)
  const small = await fetch(BASE + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'noop' }) })
  c.ok('a normal /command body is still accepted', small.status < 400, 'status ' + small.status)

  // ── page checks in each engine ──────────────────────────────────────────
  for (const [name, type] of [['chromium', pw.chromium], ['webkit', pw.webkit]]) {
    const browser = await type.launch()
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: name === 'chromium', hasTouch: true, serviceWorkers: 'block' })
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
    await page.goto(BASE + '/')
    await page.waitForFunction(() => typeof setTab === 'function' && typeof state === 'object', null, { timeout: 20000 })
    // dismiss any first-run overlay the page may show
    await page.evaluate(() => { document.querySelectorAll('.overlay,.role-overlay,[id*="role"]').forEach((e) => { try { e.remove() } catch (_) {} }) })

    // search boxes: visible focus + no iOS zoom
    await page.evaluate(() => setTab('sermons'))
    await page.waitForSelector('#sermonInput')
    const before = await page.evaluate(() => { const b = document.querySelector('.searchbox'); const s = getComputedStyle(b); return { bs: s.boxShadow, bc: s.borderColor } })
    await page.focus('#sermonInput')
    const after = await page.evaluate(() => { const b = document.querySelector('.searchbox'); const s = getComputedStyle(b); const i = getComputedStyle(document.querySelector('#sermonInput')); return { bs: s.boxShadow, bc: s.borderColor, out: i.outlineStyle, fs: parseFloat(i.fontSize) } })
    c.ok(`${name}: the search box shows a focus ring`, after.bs !== before.bs || after.bc !== before.bc, JSON.stringify({ before, after }))
    c.ok(`${name}: search input text is 16px or more (a phone does not zoom in on focus)`, after.fs >= 16, 'font-size ' + after.fs)

    // newest search wins; dropped connection says so
    await page.route(/\/api\/search\/sermons\?q=first/, async (r) => { await new Promise((res) => setTimeout(res, 1500)); await r.fulfill({ json: [fakeRow('FIRST')] }) })
    await page.route(/\/api\/search\/sermons\?q=second/, (r) => r.fulfill({ json: [fakeRow('SECOND')] }))
    await page.fill('#sermonInput', 'first'); await page.press('#sermonInput', 'Enter')
    await page.fill('#sermonInput', 'second'); await page.press('#sermonInput', 'Enter')
    await page.waitForTimeout(2400)
    const shown = await page.evaluate(() => document.getElementById('sermonResultsBox').textContent)
    c.ok(`${name}: a slow older search does not replace the newer one`, /SECOND/.test(shown) && !/FIRST/.test(shown), shown.slice(0, 60))
    await page.unroute(/\/api\/search\/sermons\?q=first/); await page.unroute(/\/api\/search\/sermons\?q=second/)
    await page.route(/\/api\/search\/sermons\?q=lost/, (r) => r.abort())
    await page.fill('#sermonInput', 'lost'); await page.press('#sermonInput', 'Enter')
    await page.waitForTimeout(1200)
    const lost = await page.evaluate(() => document.getElementById('sermonResultsBox').textContent)
    c.ok(`${name}: a search that cannot reach BORN stops saying "Searching…"`, !/Searching/.test(lost), lost.slice(0, 80))
    await page.unroute(/\/api\/search\/sermons\?q=lost/)

    // a quoted Bible search survives a redraw
    await page.evaluate(() => { state.bibleQuery = '"faith"'; setTab('bible') })
    await page.waitForSelector('#bibleInput')
    const bv = await page.evaluate(() => document.getElementById('bibleInput').value)
    c.ok(`${name}: a quoted Bible search is still intact after the tab redraws`, bv === '"faith"', JSON.stringify(bv))

    // songs: A–Z strip and rows
    await page.evaluate(() => { state.bibleQuery = ''; setTab('songs') })
    await page.waitForSelector('.song-row', { timeout: 30000 })
    const sz = await page.evaluate(() => { const b = [...document.querySelectorAll('.azstrip button')].find((x) => x.getClientRects().length > 0); const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })
    c.ok(`${name}: A–Z letters are an easy touch size (44px)`, sz.w >= 44 && sz.h >= 44, JSON.stringify(sz))
    const overlap = await page.evaluate(() => { const rows = [...document.querySelectorAll('.song-row')].slice(0, 400); let n = 0; for (let i = 1; i < rows.length; i++) { const a = rows[i - 1].getBoundingClientRect(), b = rows[i].getBoundingClientRect(); if (a.height > 0 && b.height > 0 && a.bottom > b.top + 1) n++ } return { rows: rows.length, overlaps: n, h: Math.round(rows[0].getBoundingClientRect().height) } })
    c.ok(`${name}: song rows do not overlap`, overlap.overlaps === 0, JSON.stringify(overlap))
    const jump = await page.evaluate(async () => {
      const vis = (e) => e.getClientRects().length > 0
      const btns = [...document.querySelectorAll('.azstrip button:not(:disabled)')].filter(vis)
      const find = (l) => btns.find((b) => b.textContent.trim() === l)
      const scroller = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowY; if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight) return e } return null }
      const last = btns[btns.length - 1], first = btns[0]
      const letterOf = (b) => b.textContent.trim()
      const mid = btns[Math.floor(btns.length / 2)]
      last.click(); await new Promise((r) => setTimeout(r, 600))
      mid.click(); await new Promise((r) => setTimeout(r, 900))
      const tgt = document.querySelector('[data-letter="' + letterOf(mid) + '"]')
      const sc = scroller(tgt)
      const top = sc ? Math.round(tgt.getBoundingClientRect().top - sc.getBoundingClientRect().top) : null
      return { target: letterOf(mid), from: letterOf(last), offsetFromTop: top, scrollTop: sc && Math.round(sc.scrollTop) }
    })
    await page.fill('#songInput', 'the')
    await page.waitForTimeout(1200)
    const ov2 = await page.evaluate(() => { const rows = [...document.querySelectorAll('.song-row')]; let n = 0; for (let i = 1; i < rows.length; i++) { const a = rows[i - 1].getBoundingClientRect(), b = rows[i].getBoundingClientRect(); if (a.height > 0 && b.height > 0 && a.bottom > b.top + 1) n++ } return { rows: rows.length, overlaps: n } })
    c.ok(`${name}: song rows do not overlap in search results`, ov2.rows > 20 && ov2.overlaps === 0, JSON.stringify(ov2))
    await page.fill('#songInput', ''); await page.waitForTimeout(800)
    c.ok(`${name}: A–Z jumping back up from Z to a middle letter lands on it`, jump.offsetFromTop !== null && jump.offsetFromTop <= 8, JSON.stringify(jump))

    // an id from a shared service file must not run as script
    const pwned = await page.evaluate(async () => {
      state.qs = Object.assign({}, state.qs, { queue: [{ id: "a'});window.__pwned=1;//", kind: 'song', title: 'T', subtitle: '', slides: [] }] })
      const d = document.createElement('div'); d.innerHTML = queueDetailInnerHtml(0); document.body.appendChild(d)
      const b = d.querySelector('button.btn-project'); b.click(); await new Promise((r) => setTimeout(r, 200))
      return !!window.__pwned
    })
    c.ok(`${name}: a queue item id with quote marks cannot run script on the phone`, pwned === false, 'pwned=' + pwned)
    if (errs.length) console.log(`(${name} page errors: ${JSON.stringify(errs.slice(0, 3))})`)
    await browser.close()
  }
  const res = c.done()
  await app.kill()
  process.exit(res.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
