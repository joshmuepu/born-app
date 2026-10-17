#!/usr/bin/env node
/* Chaos / fuzz test: seeded random clicks, typing, keys, resizes, scrolls, drags and rapid navigation against an isolated profile. Catches exceptions, renderer crashes, frozen UI and runaway DOM growth.
 *   node scripts/qa/fuzz.cjs <profileDir> [port] [minutes] [seed]    -> qa-out/fuzz-<seed>.json   (re-run with the same seed to reproduce)
 */
const fs = require('fs'), path = require('path')
const { launch, sleep, ROOT } = require('./lib.cjs')
const [profile = '/tmp/qa-fuzz', port = '9975', minutes = '20', seedArg = String(Date.now() % 100000)] = process.argv.slice(2)
let seed = +seedArg >>> 0
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const AVOID = /(quit|exit|uninstall|install update|relaunch|restart|close projection|open projection)/i // keep the instance alive; everything else is fair game
const KEYS = [['Escape'], ['Escape', { shift: true }], ['Tab'], ['Tab', { shift: true }], ['Enter'], [' '], ['ArrowDown'], ['ArrowUp'], ['ArrowLeft'], ['ArrowRight'], ['k', { ctrl: true }], ['k', { meta: true }], ['?'], ['F1'], ['u', { ctrl: true, shift: true }], ['b'], ['f'], ['q'], ['Backspace'], ['z', { ctrl: true }], ['z', { meta: true }], ['\\']]
const SIZES = [[1040, 640], [1366, 768], [1920, 1080], [820, 1100], [3840, 2160], [700, 500]]
const WORDS = ['holy spirit', 'John 3:16', 'ترنيمة', '主', '🎶', 'a'.repeat(200), '', ' ', '<b>x</b>', "'; DROP TABLE songs;--", '65-0418M', 'Amazing']
;(async () => {
  const app = await launch({ profile, port: +port, remotePort: 4440 + (+port % 40), mdns: 'born-qa-fuzz' })
  let page = await app.page()
  const log = []; const issues = []
  const t0 = Date.now(); const end = t0 + +minutes * 60000
  let n = 0, maxNodes = 0, lastNodes = 0
  const alive = async () => { try { return await Promise.race([page.ev('1+1'), sleep(6000).then(() => 'timeout')]) } catch (e) { return 'dead' } }
  const nodes = async () => { try { return await page.ev('document.getElementsByTagName("*").length') } catch { return 0 } }
  page.ws.on('close', () => issues.push({ step: n, kind: 'connection-closed', detail: 'the page connection closed (renderer crash?)' }))
  while (Date.now() < end) {
    n++
    const kind = rnd()
    let desc = ''
    try {
      if (kind < 0.5) { // click a random visible control
        const items = await page.ev(`[...document.querySelectorAll('button,[role=tab],[role=menuitem],a,[role=button],summary,[role=switch],[role=radio],[role=option],input[type=checkbox],li')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.top<innerHeight&&r.left>=0&&r.left<innerWidth&&!e.disabled}).map(e=>({l:((e.getAttribute('aria-label')||'')+' '+(e.innerText||'')).replace(/\\s+/g,' ').trim().slice(0,50),x:Math.round(e.getBoundingClientRect().left+e.getBoundingClientRect().width/2),y:Math.round(e.getBoundingClientRect().top+e.getBoundingClientRect().height/2)}))`)
        const c = pick(items.filter((i) => !AVOID.test(i.l)))
        if (c) { desc = 'click ' + c.l; await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 }); await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 }) }
      } else if (kind < 0.62) { const [k, o] = pick(KEYS); desc = 'key ' + k + (o ? JSON.stringify(o) : ''); await page.key(k, o || {}) }
      else if (kind < 0.72) { desc = 'type'; const w = pick(WORDS); await page.ev(`(()=>{const i=[...document.querySelectorAll('input[type=text],input:not([type]),input[type=search],textarea')].filter(e=>e.getBoundingClientRect().width>0);if(i.length){const e=i[${Math.floor(rnd() * 1000)}%i.length];e.focus()}})()`); for (const ch of w.slice(0, 40)) await page.key(ch) }
      else if (kind < 0.8) { const [w, h] = pick(SIZES); desc = `resize ${w}x${h}`; await page.viewport(w, h, 1) }
      else if (kind < 0.88) { desc = 'scroll'; await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 300 + Math.floor(rnd() * 600), y: 200 + Math.floor(rnd() * 400), deltaX: 0, deltaY: (rnd() - 0.5) * 1500 }) }
      else if (kind < 0.94) { desc = 'drag'; const x1 = 100 + Math.floor(rnd() * 1000), y1 = 100 + Math.floor(rnd() * 500), x2 = 100 + Math.floor(rnd() * 1000), y2 = 100 + Math.floor(rnd() * 500); await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 }); for (let i = 1; i <= 6; i++) await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1 + ((x2 - x1) * i) / 6, y: y1 + ((y2 - y1) * i) / 6, button: 'left' }); await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 }) }
      else { desc = 'rail'; await page.click(pick(['Sermons', 'Bible', 'Songs', 'Media', 'Saved', 'Tape', 'Queue'])) }
    } catch (e) { issues.push({ step: n, kind: 'driver-error', detail: desc + ' ' + String(e).slice(0, 160) }) }
    log.push(desc); if (log.length > 60) log.shift()
    if (n % 15 === 0) {
      const a = await alive()
      if (a !== 2) { issues.push({ step: n, kind: 'frozen-or-dead', detail: String(a), lastActions: log.slice(-12) }); if (a === 'dead') break }
      const nn = await nodes(); maxNodes = Math.max(maxNodes, nn); lastNodes = nn
      for (const l of page.takeLogs()) if (!/Electron Security Warning/.test(l.text)) issues.push({ step: n, kind: l.kind, detail: l.text, lastActions: log.slice(-8) })
    }
    if (n % 200 === 0) { try { await page.send('Page.reload'); await sleep(2000) } catch { /* ok */ } } // fresh page now and then: state must survive reloads too
    await sleep(40)
  }
  const out = { seed: seedArg, minutes: +minutes, steps: n, maxDomNodes: maxNodes, lastDomNodes: lastNodes, issues }
  fs.writeFileSync(path.join(ROOT, 'qa-out', `fuzz-${seedArg}.json`), JSON.stringify(out, null, 1))
  const kinds = {}; for (const i of issues) kinds[i.kind] = (kinds[i.kind] || 0) + 1
  console.log(`fuzz seed ${seedArg}: ${n} steps in ${minutes} min · max DOM nodes ${maxNodes} · issues ${issues.length}`, JSON.stringify(kinds))
  page.close(); await app.kill()
})().catch((e) => { console.error(e); process.exit(1) })
