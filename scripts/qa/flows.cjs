/* Flows probe: restart persistence, a 600-item queue, and keyboard focus visibility. Usage: node scripts/qa/flows.cjs <profileDir>  (needs `npm run build`)
 * Placeholder text only. Never opens a projection window (that would go fullscreen on a real display). */
const fs = require('fs'), path = require('path')
const { launch, checks, sleep } = require('./lib.cjs')
const profile = process.argv[2] || path.join(require('os').tmpdir(), 'born-v1-flows-profile')
const items = (n) => Array.from({ length: n }, (_, i) => ({
  kind: 'quote', id: 'q-' + i,
  quote: { text: `Placeholder paragraph ${i}. `.repeat(3), sermonTitle: `Placeholder Sermon ${i % 40}`, dateCode: '00-0101', sermonId: 1, paragraphIndex: i, paragraphRef: String(i + 1) },
  slides: [{ text: `Placeholder paragraph ${i}. `.repeat(3), reference: `Placeholder Sermon ${i % 40} ¶${i + 1}` }]
}))
const time = (p, fn) => p.ev(`(async()=>{const t0=performance.now();${fn};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return Math.round(performance.now()-t0)})()`)

;(async () => {
  const c = checks('flows')
  fs.mkdirSync(profile, { recursive: true })
  // ── 1. a 600-item queue loads, stays responsive, and survives a restart ─────────
  fs.writeFileSync(path.join(profile, 'queue.json'), JSON.stringify(items(600)))
  let app = await launch({ profile, remotePort: 14321, mdns: 'born-remote-v1fl', port: 9361, settle: 7000 })
  let p = await app.page(); await p.viewport(1366, 768, 1); await sleep(500)
  const rows = await p.ev(`document.querySelectorAll('.queue-row').length`)
  c.ok('a saved 600-item queue loads', rows > 0, rows + ' rows in the DOM')
  const t = []
  for (const tab of ['Bible', 'Songs', 'Sermons', 'Bible', 'Songs', 'Sermons']) t.push(await time(p, `[...document.querySelectorAll('.panel-tab')].find(b=>b.textContent.trim()==='${tab}').click()`))
  const worst = Math.max(...t), avg = Math.round(t.reduce((a, b) => a + b, 0) / t.length)
  c.ok('switching sections with a 600-item queue stays under half a second', worst < 500, `worst ${worst} ms, average ${avg} ms (${t.join(', ')})`)
  const logs = p.takeLogs().filter((l) => !/Electron Security Warning/.test(l.text)); c.ok('no errors with a 600-item queue', logs.length === 0, JSON.stringify(logs.slice(0, 2)))
  // remove the first row with a real click on its remove button, wait for the autosave, then restart
  const removed = await p.clickSel('.queue-row .queue-row-actions .btn-quiet:last-child')
  await sleep(1500)
  const saved = JSON.parse(fs.readFileSync(path.join(profile, 'queue.json'), 'utf8'))
  c.ok('removing an item is autosaved', removed && saved.length === 599, `saved ${saved.length} items (clicked=${removed})`)
  p.close(); await app.kill(); await sleep(800)
  app = await launch({ profile, remotePort: 14321, mdns: 'born-remote-v1fl', port: 9361, settle: 6000 })
  p = await app.page(); await p.viewport(1366, 768, 1); await sleep(500)
  const back = JSON.parse(fs.readFileSync(path.join(profile, 'queue.json'), 'utf8'))
  const rows2 = await p.ev(`document.querySelectorAll('.queue-row').length`)
  c.ok('after a restart the queue is still the 599 items', back.length === 599 && rows2 > 0, `file ${back.length}, rows ${rows2}`)

  // ── 2. keyboard-only: every Tab stop shows where the focus is ───────────────────
  await p.ev(`document.activeElement && document.activeElement.blur()`)
  const stops = []
  for (let i = 0; i < 40; i++) {
    await p.key('Tab'); await sleep(40)
    stops.push(await p.ev(`(()=>{const e=document.activeElement; if(!e||e===document.body) return null; const s=getComputedStyle(e); const r=e.getBoundingClientRect();
      const visible = (s.outlineStyle!=='none' && parseFloat(s.outlineWidth)>0) || (s.boxShadow!=='none') ;
      return {tag:e.tagName, label:(e.getAttribute('aria-label')||e.title||e.textContent||e.placeholder||'').trim().slice(0,30), visible, onscreen: r.width>0 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth}})()`))
  }
  const real = stops.filter(Boolean)
  const noRing = real.filter((s) => !s.visible)
  let stuck = 0; for (let i = 2; i < stops.length; i++) if (stops[i] && stops[i - 1] && stops[i - 2] && JSON.stringify(stops[i]) === JSON.stringify(stops[i - 1]) && JSON.stringify(stops[i]) === JSON.stringify(stops[i - 2])) stuck++
  c.ok('Tab keeps moving (never stuck on one control, never lost to the page)', real.length >= 38 && stuck === 0, `${real.length} of 40 presses landed on a control; stuck ${stuck}`)
  c.ok('every Tab stop shows a focus ring or highlight', noRing.length === 0, noRing.slice(0, 6).map((s) => s.tag + ':' + s.label).join(', '))
  c.ok('no Tab stop is off screen', real.every((s) => s.onscreen), real.filter((s) => !s.onscreen).slice(0, 4).map((s) => s.tag + ':' + s.label).join(', '))
  const res = c.done(); p.close(); await app.kill(); process.exit(res.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
