/* Operator zoom (scripts only, never shipped): in the real app on an isolated profile, zooms the operator window in to the View menu's largest zoom
 * at its smallest size (1040x640) and at 1280x800, 1600x900 and 1920x1080, and checks that the zoom shown is the largest that fits (never under
 * 100%), that no control runs off the window or is covered, that no text is under 12 px and no control under 32 px high as drawn, that the
 * "zoom reduced to fit" line shows only while the zoom is reduced, that resizing and Actual Size re-fit at once, and that the output windows keep
 * their own zoom. Usage: node scripts/qa/operator-zoom.cjs <profileDir> [outJson]   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks } = require('./lib.cjs')
const [profile, outJson] = process.argv.slice(2)
const SIZES = [[1040, 640], [1280, 800], [1600, 900], [1920, 1080]]
const MIN_TEXT = 12, MIN_CONTROL = 32

const SCAN = `((zoom)=>{
  const W = innerWidth, H = innerHeight
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 }
  const inScroller = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowY; if ((o === 'auto' || o === 'scroll') && a.scrollHeight > a.clientHeight + 1) return true } return false }
  const skip = (e) => e.closest('.monitor-preview, .monitor-frame, .projection-preview, .live-preview, [data-preview], .songs-azrail')
  const label = (e) => (e.getAttribute('aria-label') || e.title || e.textContent || e.placeholder || e.tagName).trim().replace(/\\s+/g, ' ').slice(0, 30)
  const off = [], covered = [], small = [], tiny = []
  for (const e of document.querySelectorAll('button, input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea, [role=button], [role=tab]')) {
    if (skip(e) || !vis(e) || inScroller(e)) continue
    const r = e.getBoundingClientRect()
    if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) { off.push(label(e)); continue }
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    if (t && !(t === e || e.contains(t) || t.contains(e))) covered.push(label(e))
    if (r.height * zoom < ${MIN_CONTROL} - 0.5) small.push(label(e) + ' ' + (r.height * zoom).toFixed(1))
  }
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), seen = new Set()
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const e = n.parentElement
    if (!e || seen.has(e) || !n.textContent.trim() || skip(e) || !vis(e)) continue
    seen.add(e)
    const px = parseFloat(getComputedStyle(e).fontSize) * zoom
    if (px < ${MIN_TEXT} - 0.05) tiny.push(n.textContent.trim().slice(0, 24) + ' ' + px.toFixed(1))
  }
  return { W, H, sideways: document.documentElement.scrollWidth > W + 1, off, covered, small, tiny, line: !!document.querySelector('.status-zoom') }
})`

;(async () => {
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ theme: 'dark' }))
  const REP = path.join(profile, 'zoom-report.json'), CMD = path.join(profile, 'zoom-cmd.json')
  const c = checks('operator-zoom')
  const app = await launch({ profile, remotePort: 14316, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-zoom', settle: 8000, env: { ZOOM_REPORT: REP, ZOOM_CMD: CMD }, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs'), '--require', path.join(__dirname, 'zoom-menu.cjs')] })
  const rows = []
  const rep = () => JSON.parse(fs.readFileSync(REP, 'utf8'))
  const cmd = async (o) => { fs.writeFileSync(CMD, JSON.stringify(o)); await sleep(1600) }
  try {
    const p = await app.page()
    await p.ev('window.electronAPI.openProjection()'); await p.ev('window.electronAPI.openStage()'); await sleep(2500)
    const surfaces = [
      ['start screen', async () => {}],
      ['sermon results', async () => { await p.ev(`(()=>{const i=[...document.querySelectorAll('input')].find(x=>x.offsetParent&&/search|phrase/i.test(x.placeholder||''));i.focus();i.select()})()`); await p.insertText('grace'); await p.key('Enter'); await sleep(2000); await p.ev('document.activeElement&&document.activeElement.blur()') }]
    ]
    for (const [surface, go] of surfaces) {
      await go()
      for (const size of SIZES) {
        await cmd({ role: 'resetzoom', size })
        await cmd({ role: 'zoomin', n: 20 })
        const r = rep(), m = await p.ev(`${SCAN}(${r.zoom})`)
        const name = `${surface} ${size.join('x')} at the largest zoom`
        const expect = Math.max(1, Math.min(r.content[0] / 1040, r.content[1] / 640))
        rows.push({ surface, size, zoom: r.zoom, content: r.content, ...m })
        console.log(JSON.stringify(rows[rows.length - 1]))
        c.ok(`${name}: the zoom shown is the largest that fits, never under 100%`, Math.abs(r.zoom - expect) < 0.02 && r.zoom >= 0.999, `${(r.zoom * 100).toFixed(0)}% (fits ${(expect * 100).toFixed(0)}%), layout ${m.W}x${m.H}`)
        c.ok(`${name}: no control runs off the window or is covered`, !m.off.length && !m.covered.length && !m.sideways, JSON.stringify({ off: m.off.slice(0, 5), covered: m.covered.slice(0, 5), sideways: m.sideways }))
        c.ok(`${name}: no text under ${MIN_TEXT} px and no control under ${MIN_CONTROL} px as drawn`, !m.tiny.length && !m.small.length, JSON.stringify({ text: m.tiny.slice(0, 4), controls: m.small.slice(0, 4) }))
        c.ok(`${name}: the "zoom reduced to fit" line shows`, m.line)
        c.ok(`${name}: the output windows keep their own zoom`, r.outputs.every((z) => Math.abs(z - 1) < 0.001), JSON.stringify(r.outputs))
      }
    }
    // live re-fit (each menu step is half a zoom level, a factor of about 1.095): a larger window shows more of the chosen zoom at once, and Actual Size clears the line
    await cmd({ role: 'resetzoom', size: [1040, 640] }); await cmd({ role: 'zoomin', n: 3 })
    let r = rep(), m = await p.ev(`${SCAN}(${r.zoom})`)
    c.ok('three zoom steps on the smallest window: shown at 100%, with the line', Math.abs(r.zoom - 1) < 0.02 && m.line, `${(r.zoom * 100).toFixed(0)}%`)
    await cmd({ size: [1600, 1000] })
    r = rep(); m = await p.ev(`${SCAN}(${r.zoom})`)
    c.ok('the window made larger: the chosen 131% is shown at once, and the line goes', Math.abs(r.zoom - 1.2 ** 1.5) < 0.02 && !m.line, `${(r.zoom * 100).toFixed(0)}%`)
    await cmd({ size: [1040, 640] })
    r = rep(); m = await p.ev(`${SCAN}(${r.zoom})`)
    c.ok('the window made small again: back to 100% with the line', Math.abs(r.zoom - 1) < 0.02 && m.line, `${(r.zoom * 100).toFixed(0)}%`)
    await cmd({ role: 'resetzoom' })
    r = rep(); m = await p.ev(`${SCAN}(${r.zoom})`)
    c.ok('Actual Size: 100% and the line goes', Math.abs(r.zoom - 1) < 0.001 && !m.line, `${(r.zoom * 100).toFixed(0)}%`)
    await cmd({ size: [1920, 1080] }); await cmd({ role: 'zoomin', n: 2 })
    r = rep(); m = await p.ev(`${SCAN}(${r.zoom})`)
    c.ok('a zoom that fits (120% on 1920x1080) is shown as chosen, with no line', Math.abs(r.zoom - 1.2) < 0.02 && !m.line, `${(r.zoom * 100).toFixed(0)}%`)
    await cmd({ role: 'zoomout', n: 4 })
    r = rep()
    c.ok('zooming out below 100% is left as it is', Math.abs(r.zoom - 1.2 ** -1) < 0.02, `${(r.zoom * 100).toFixed(0)}%`)
    await cmd({ role: 'resetzoom' })
    p.close()
  } finally {
    if (outJson) fs.writeFileSync(outJson, JSON.stringify(rows, null, 1))
    await app.kill()
  }
  process.exit(c.done().failed ? 1 : 0)
})()
