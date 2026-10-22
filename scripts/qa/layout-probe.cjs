/* Layout probe: opens each popover/dialog of the operator window at several window sizes / scales and reports
 * anything that runs outside the window. Usage: node scripts/qa/layout-probe.cjs <profileDir>  (needs `npm run build`) */
const { launch, checks, sleep } = require('./lib.cjs')
const path = require('path')
const profile = process.argv[2] || path.join(require('os').tmpdir(), 'born-v1-qa-profile')
const SIZES = [[1040, 640, 1], [1040, 640, 1.5], [1366, 768, 1], [1920, 1080, 1]]
const OFF = `(sel)=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();return {l:Math.round(r.left),t:Math.round(r.top),r:Math.round(r.right),b:Math.round(r.bottom),vw:innerWidth,vh:innerHeight,sh:e.scrollHeight,ch:e.clientHeight}}`
;(async () => {
  const c = checks('layout-probe')
  const app = await launch({ profile })
  const p = await app.page()
  for (const [w, h, sc] of SIZES) {
    await p.viewport(w, h, sc)
    // the CSS viewport is what the app lays out in: emulate zoom by shrinking it (device scale does not change CSS px)
    const cssW = Math.round(w / sc), cssH = Math.round(h / sc)
    await p.viewport(cssW, cssH, 1)
    await sleep(400)
    const tag = `${w}x${h}@${sc}`
    // shortcuts dialog
    await p.key('?', { shift: true }); await sleep(300)
    let r = await p.ev(`(${OFF})('.shortcuts-modal')`)
    c.ok(`${tag} shortcuts dialog fits`, r && r.t >= 0 && r.b <= r.vh, JSON.stringify(r))
    await p.key('Escape'); await sleep(200)
    // message dialog / help
    await p.key('F1'); await sleep(900)
    r = await p.ev(`(${OFF})('.help-modal')`)
    c.ok(`${tag} help dialog fits`, r && r.t >= 0 && r.b <= r.vh && r.l >= 0 && r.r <= r.vw, JSON.stringify(r))
    await p.key('Escape'); await sleep(200)
    // header
    r = await p.ev(`(${OFF})('header.app-header')`)
    c.ok(`${tag} header not wider than window`, r && r.r <= r.vw + 1, JSON.stringify(r))
    const hdr = await p.ev(`(()=>{const hs=[...document.querySelectorAll('.header-actions button, .header-actions .btn-secondary')];return hs.filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&(r.right>innerWidth||r.left<0)}).map(b=>b.textContent.trim()||b.getAttribute('aria-label'))})()`)
    c.ok(`${tag} header buttons all inside the window`, hdr && hdr.length === 0, JSON.stringify(hdr))
    // status popover
    const opened = await p.clickSel('.status-trigger')
    await sleep(300)
    r = await p.ev(`(${OFF})('.status-popover')`)
    if (r) c.ok(`${tag} status popover inside window`, r.l >= 0 && r.r <= r.vw, JSON.stringify(r)); else console.log(`(${tag}: status popover not opened; click ok=${opened})`)
    await p.key('Escape'); await sleep(200)
  }
  // start-screen top clipped? (1040x640 at 150%)
  await p.viewport(693, 427, 1); await sleep(300)
  const st = await p.ev(`(()=>{const e=document.querySelector('.start-screen, [class*="start-screen"]');if(!e)return null;const r=e.getBoundingClientRect();const f=e.firstElementChild?.getBoundingClientRect();return {top:Math.round(r.top),firstTop:f&&Math.round(f.top),sh:e.scrollHeight,ch:e.clientHeight}})()`)
  console.log('start screen', JSON.stringify(st))
  c.ok('start screen: first element not above the window top', st && st.firstTop >= 0, JSON.stringify(st))
  await p.shot(path.join(profile, 'shot-150.png'))
  console.log('console problems:', JSON.stringify(p.takeLogs().slice(0, 5)))
  const res = c.done()
  p.close(); await app.kill()
  process.exit(res.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
