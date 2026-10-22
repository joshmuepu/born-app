/* Output probe: renders the built projection.html / stage.html in headless Chromium with a stubbed electronAPI (no app window,
 * no display touched) and checks that long text stays on screen. Needs `npm run build`; Playwright is loaded from PW_DIR
 * (default /tmp/born-pw), never a dependency. Usage: node scripts/qa/output-probe.cjs */
const path = require('path')
const http = require('http'), fs = require('fs')
const { checks } = require('./lib.cjs')
const PW = process.env.PW_DIR || '/tmp/born-pw'
const { chromium } = require(path.join(PW, 'node_modules', 'playwright'))
const OUT = path.join(__dirname, '..', '..', 'out', 'renderer')

const STUB = (payload) => `
  const handlers = {}
  const on = (n) => (cb) => { handlers[n] = cb; return () => {} }
  const noop = () => {}
  window.electronAPI = new Proxy({}, { get: (_t, n) => {
    if (n === 'onShowSlide') return (cb) => { setTimeout(() => cb(${JSON.stringify(payload.projection || null)}), 50); return noop }
    if (n === 'onStageUpdate') return (cb) => { setTimeout(() => cb(${JSON.stringify(payload.stage || null)}), 50); return noop }
    return String(n).startsWith('on') ? () => noop : noop
  } })`

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(OUT, decodeURIComponent(req.url.split('?')[0]))
      if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end() }
      rsp.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp)
    }).listen(0, '127.0.0.1', () => res(srv))
  })
}

;(async () => {
  const c = checks('output-probe')
  const srv = await serve(); const base = `http://127.0.0.1:${srv.address().port}`
  const browser = await chromium.launch()
  const LONG_URL = 'https://example.com/' + 'verylongunbrokenpathsegment'.repeat(8)
  const NEXT_TEXT = 'The next verse is a long one that goes on and on so that the band needs many lines to show it fully. '.repeat(6)
  for (const [w, h] of [[1366, 768], [1920, 1080]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    // projection: a line with no spaces
    let page = await ctx.newPage()
    await page.addInitScript(STUB({ projection: { kind: 'quote', text: LONG_URL, label: 'Announcement', reference: 'Test' } }))
    await page.goto(base + '/projection.html')
    await page.waitForSelector('.projection-text-inner')
    await page.waitForTimeout(400)
    let m = await page.evaluate(() => { const e = document.querySelector('.projection-text-inner'); const r = e.getBoundingClientRect(); return { right: Math.round(r.right), sw: e.scrollWidth, cw: e.clientWidth, vw: innerWidth, docSw: document.documentElement.scrollWidth } })
    c.ok(`${w}x${h} projector: a line with no spaces wraps inside the screen`, m.sw <= m.cw + 1 && m.right <= m.vw + 1 && m.docSw <= m.vw + 1, JSON.stringify(m))
    await page.close()
    // stage: long unbroken current text, and a Next band with a reference
    page = await ctx.newPage()
    await page.addInitScript(STUB({ stage: { current: { kind: 'quote', text: LONG_URL, label: 'Now' }, next: { kind: 'bible', text: NEXT_TEXT, label: 'Next', reference: 'John 3:16' } } }))
    await page.goto(base + '/stage.html')
    await page.waitForSelector('.stage-current-text')
    await page.waitForTimeout(500)
    m = await page.evaluate(() => { const e = document.querySelector('.stage-current-text'); return { sw: e.scrollWidth, cw: e.clientWidth, vw: innerWidth, docSw: document.documentElement.scrollWidth } })
    c.ok(`${w}x${h} stage: a line with no spaces wraps inside the screen`, m.sw <= m.cw + 1 && m.docSw <= m.vw + 1, JSON.stringify(m))
    m = await page.evaluate(() => { const n = document.querySelector('.stage-next'); const ref = document.querySelector('.stage-next-ref'); if (!n || !ref) return null; const nr = n.getBoundingClientRect(), rr = ref.getBoundingClientRect(); return { nextBottom: Math.round(nr.bottom), refBottom: Math.round(rr.bottom), nextClientH: n.clientHeight, nextScrollH: n.scrollHeight } })
    c.ok(`${w}x${h} stage: the Next band shows its reference line whole`, m && m.nextScrollH <= m.nextClientH + 1 && m.refBottom <= m.nextBottom + 1, JSON.stringify(m))
    await page.close(); await ctx.close()
  }
  await browser.close(); srv.close()
  const res = c.done(); process.exit(res.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
