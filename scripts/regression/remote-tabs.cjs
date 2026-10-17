// The phone remote's Media and Tape tabs, the SCREEN HIDDEN banner and Hide screen / Show screen (P-13). Placeholder picture only.
const { chromium, devices } = require('playwright')
const zlib = require('zlib')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, detail) }

/** a small solid-colour PNG (no files needed) */
function png(w, h, rgb) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0 }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = (rgb[1] + x) & 255; raw[o + 2] = rgb[2] } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9920')
  let main
  for (const p of browser.contexts().flatMap((c) => c.pages())) { try { if ((await p.evaluate(() => document.title)) === 'Born Again') main = p } catch {} }
  const api = (fn, ...a) => main.evaluate(([f, x]) => window.electronAPI[f](...x), [fn, a])
  // one placeholder picture in the library
  const b64 = png(640, 360, [40, 90, 160]).toString('base64')
  await main.evaluate(async (b) => { const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return window.electronAPI.mediaImportBuffer('Placeholder blue.png', u.buffer, {}) }, b64)
  // wait until the picture is really in the library and its thumbnail can be served (a fresh import is prepared in the background)
  for (let i = 0; i < 40; i++) {
    const list = await api('mediaList', {})
    const id = list[0] && list[0].id
    if (id && (await fetch('http://127.0.0.1:4317/media/' + id + '/thumb').then((r) => r.ok).catch(() => false))) break
    await sleep(500)
  }
  await main.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Open projection/.test(b.textContent.trim()))?.click()); await sleep(2500)

  const wk = await chromium.launch({ channel: 'chrome' })
  for (const dev of ['Pixel 7', 'iPad (gen 7) landscape']) {
    const ctx = await wk.newContext({ ...devices[dev] }); const p = await ctx.newPage(); p.on('dialog', (d) => d.accept())
    await p.goto('http://127.0.0.1:4317/'); await sleep(2500)
    await p.evaluate(() => document.getElementById('a2hsOverlay')?.remove())
    const skip = p.getByText('Skip for now'); if (await skip.count()) { await skip.first().click(); await sleep(500) }
    const tab = (n) => p.locator(`.tab[data-tab="${n}"]:visible, .sidebar-tab[data-tab="${n}"]:visible`).first()
    const label = dev.startsWith('Pixel') ? 'phone' : 'tablet'
    check(`${label}: has Media and Tape tabs`, (await tab('media').count()) === 1 && (await tab('tape').count()) === 1)
    await tab('media').click(); await sleep(1500)
    const tiles = await p.locator('.media-tile:visible').count()
    check(`${label}: Media shows the library`, tiles >= 1, `${tiles} tiles`)
    const img = await p.locator('.media-tile:visible img').first().evaluate((i) => i.complete && i.naturalWidth > 0)
    check(`${label}: a thumbnail loads`, img)
    const btn = await p.locator('.media-tile:visible .mt-actions button').first().boundingBox()
    check(`${label}: Show and + Queue are at least 44 px high`, btn && btn.height >= 44, btn && Math.round(btn.height) + ' px')
    await api('clearChannel', 'main'); await sleep(600)
    const before = await api('getLiveState')
    await p.locator('.media-tile:visible .mt-show').first().click(); await sleep(2500)
    const after = await api('getLiveState')
    check(`${label}: Show puts the picture on the screens`, JSON.stringify(before) !== JSON.stringify(after) && after.find((c) => c.id === 'main').current?.kind === 'media', JSON.stringify(after.find((c) => c.id === 'main').current?.kind))
    const q0 = (await main.evaluate(() => document.body.innerText)).match(/(\d+) in queue/)?.[1] ?? '0'
    await p.locator('.media-tile:visible button:has-text("+ Queue")').first().click(); await sleep(1500)
    const q1 = (await main.evaluate(() => document.body.innerText)).match(/(\d+) in queue/)?.[1] ?? '0'
    check(`${label}: + Queue adds it (nothing goes live)`, Number(q1) === Number(q0) + 1, `${q0} → ${q1}`)
    // hidden banner
    await main.evaluate(() => window.electronAPI.setBlankScreen(true)); await sleep(2200)
    const banner = p.locator('.hidden-banner:visible').first()
    check(`${label}: a SCREEN HIDDEN banner shows while the screens are hidden`, (await banner.count()) === 1 && /SCREEN HIDDEN/.test(await banner.innerText()))
    const blank = await p.locator('#blank-p:visible, #blank-t:visible').first().boundingBox()
    check(`${label}: the button says Show screen and is at least 56 px high`, /Show screen/.test(await p.locator('#blank-p:visible, #blank-t:visible').first().innerText()) && blank.height >= 56, blank && Math.round(blank.height) + ' px')
    await banner.click(); await sleep(1800)
    check(`${label}: tapping the banner shows the screens again`, (await p.locator('.hidden-banner:visible').count()) === 0 && !(await api('getLiveState')).find((c) => c.id === 'main').blanked)
    await tab('tape').click(); await sleep(800)
    check(`${label}: the Tape tab says when no tape is loaded`, /No tape is loaded/.test(await p.locator('.view.active, .list-pane').first().innerText()))
    const w = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    check(`${label}: no horizontal scroll`, w <= 1, `${w}`)
    await ctx.close()
  }
  console.log(results.length, 'checks,', results.filter((r) => !r).length, 'failed')
  await wk.close(); await browser.close()
  process.exitCode = results.every(Boolean) ? 0 : 1
})().catch((e) => { console.error('ERR', e); process.exit(1) })
