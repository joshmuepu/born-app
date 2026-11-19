/* Operator sizes (scripts only, never shipped): in the real app on an isolated profile, walks the operator window's screens at
 * 1366×768, 1440×900 and 1920×1080, and 1920×1080 at 150% display scaling, and lists any text the operator reads under 12 px and any
 * control (button, tab, field) under 32 px high. The Service Queue's preview of the congregation screen is a scaled picture of
 * that screen, so its text is left out.
 * Usage: node scripts/qa/operator-sizes.cjs <profileDir> [outJson]   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks } = require('./lib.cjs')
const [profile, outJson] = process.argv.slice(2)
const SIZES = [[1366, 768, 1], [1440, 900, 1], [1920, 1080, 1], [1920, 1080, 1.5]]
const MIN_TEXT = 12, MIN_CONTROL = 32

const SCAN = `(()=>{
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth }
  const skip = (e) => e.closest('.monitor-preview, .monitor-frame, .projection-preview, .live-preview, [data-preview], .songs-azrail')
  const name = (e) => { const c = (e.className && typeof e.className === 'string') ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''; return e.tagName.toLowerCase() + c }
  const label = (e) => (e.getAttribute('aria-label') || e.title || e.textContent || e.placeholder || '').trim().replace(/\\s+/g, ' ').slice(0, 30)
  const text = [], controls = []
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const e = n.parentElement
    if (!e || seen.has(e) || !n.textContent.trim() || skip(e) || !vis(e)) continue
    seen.add(e)
    const px = parseFloat(getComputedStyle(e).fontSize)
    if (px < ${MIN_TEXT} - 0.05) text.push({ el: name(e), px: +px.toFixed(2), text: n.textContent.trim().slice(0, 30) })
  }
  for (const e of document.querySelectorAll('button, input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea, a[href], [role=button], [role=tab], [role=menuitem]')) {
    if (skip(e) || !vis(e)) continue
    const r = e.getBoundingClientRect()
    if (r.height < ${MIN_CONTROL} - 0.5) controls.push({ el: name(e), h: +r.height.toFixed(1), w: +r.width.toFixed(1), label: label(e) })
  }
  return { text, controls }
})()`

;(async () => {
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ theme: 'dark' }))
  const c = checks('operator-sizes')
  const app = await launch({ profile, remotePort: 14316, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-sizes', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  const rows = []
  try {
    const p = await app.page()
    const clickIn = (sel, t) => p.ev(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.offsetParent&&x.textContent.trim().startsWith(${JSON.stringify(t)}));if(b){b.click();return true}return false})()`)
    const search = async (t) => { await p.ev(`(()=>{const i=[...document.querySelectorAll('input')].find(x=>x.offsetParent&&/search|reference|song|verse|john|phrase/i.test(x.placeholder||''));if(!i)throw new Error('no search box');i.focus();i.select()})()`); await p.insertText(t); await p.key('Enter'); await sleep(2200) }
    const blur = () => p.ev('document.activeElement&&document.activeElement.blur()')
    const surfaces = [
      ['start screen', async () => {}],
      ['sermon results', async () => { await search('grace') }],
      ['sermon browse', async () => { await clickIn('.panel-subtab, button', 'Browse'); await sleep(1500) }],
      ['bible browse', async () => { await clickIn('.panel-tab, button', 'Bible'); await sleep(600); await clickIn('.panel-subtab, button', 'Browse'); await sleep(1200) }],
      ['bible chapter, queue and screens on', async () => { await clickIn('.panel-subtab, button', 'Search'); await sleep(400); await search('John 3:16'); await clickIn('button', '+ Queue'); await sleep(300); await p.ev('window.electronAPI.openProjection()'); await sleep(1500); await clickIn('button', 'Project'); await sleep(1200) }],
      ['songs', async () => { await clickIn('.panel-tab, button', 'Songs'); await sleep(1200) }],
      ['screens menu', async () => { await clickIn('button', 'Screens'); await sleep(800) }],
      ['remote menu', async () => { await p.key('Escape'); await sleep(300); await clickIn('button', 'Remote'); await sleep(2000) }],
      ['shortcuts', async () => { await p.key('Escape'); await sleep(300); await clickIn('button', 'Shortcuts'); await sleep(800) }]
    ]
    for (const [surface, go] of surfaces) {
      try { await go() } catch (e) { c.ok(`${surface}: reached`, false, e.message); continue }
      await blur(); await sleep(300)
      for (const [w, h, s] of SIZES) {
        await p.viewport(Math.round(w / s), Math.round(h / s), s); await sleep(500)
        const m = await p.ev(SCAN)
        const res = `${w}x${h}@${Math.round(s * 100)}%`
        rows.push({ surface, res, ...m })
        c.ok(`${surface} ${res}: no operator text under ${MIN_TEXT} px`, !m.text.length, m.text.slice(0, 6).map((t) => `${t.el} ${t.px}px "${t.text}"`).join('; ') + (m.text.length > 6 ? ` (+${m.text.length - 6})` : ''))
        c.ok(`${surface} ${res}: no control under ${MIN_CONTROL} px high`, !m.controls.length, m.controls.slice(0, 6).map((t) => `${t.el} ${t.h}px "${t.label}"`).join('; ') + (m.controls.length > 6 ? ` (+${m.controls.length - 6})` : ''))
      }
      await p.clearViewport()
    }
    p.close()
  } finally {
    if (outJson) fs.writeFileSync(outJson, JSON.stringify(rows, null, 1))
    await app.kill()
  }
  process.exit(c.done().failed ? 1 : 0)
})()
