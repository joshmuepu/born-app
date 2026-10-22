/* Layout sweep of the operator window: every surface x window size x scale x theme, looking for horizontal overflow and
 * controls that sit outside the window. Usage: node scripts/qa/sweep.cjs <profileDir> [outDir]  (needs `npm run build`)
 * Prints one line per finding; screenshots of findings go to outDir (default: <profileDir>/sweep). */
const path = require('path'), fs = require('fs')
const { launch, sleep } = require('./lib.cjs')
const profile = process.argv[2] || path.join(require('os').tmpdir(), 'born-v1-sweep-profile')
const outDir = process.argv[3] || path.join(profile, 'sweep')
const SIZES = [[1040, 640], [1366, 768], [1920, 1080]]
const SCALES = [1, 1.25, 1.5]

const SCAN = `(()=>{
  const vw = innerWidth, vh = innerHeight, out = []
  if (document.documentElement.scrollWidth > vw + 1) out.push('page scrolls sideways: scrollWidth ' + document.documentElement.scrollWidth + ' > ' + vw)
  const scrollable = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) return true } return false }
  for (const e of document.querySelectorAll('button, input, select, textarea, a[href], [role=button], [role=tab], [role=menuitem]')) {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e)
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue
    if (scrollable(e)) continue
    const label = (e.getAttribute('aria-label') || e.title || e.textContent || e.placeholder || e.tagName).trim().slice(0, 40)
    if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) out.push('outside window: "' + label + '" ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','))
  }
  return out
})()`

;(async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const app = await launch({ profile, settle: 6000 })
  const p = await app.page()
  const findings = []
  const surfaces = [
    ['sermons search', async () => { await p.click('Sermons', '.panel-tab'); await p.click('Search', '.panel-subtab') }],
    ['sermons browse', async () => { await p.click('Sermons', '.panel-tab'); await p.click('Browse', '.panel-subtab') }],
    ['bible', async () => { await p.click('Bible', '.panel-tab') }],
    ['songs', async () => { await p.click('Songs', '.panel-tab') }],
    ['filters popover', async () => { await p.click('Sermons', '.panel-tab'); await p.click('Search', '.panel-subtab'); await p.click('Filters') }],
    ['help', async () => { await p.key('F1') }],
    ['shortcuts', async () => { await p.key('?', { shift: true }) }],
    ['screens popover', async () => { await p.click('Screens') }],
    ['remote popover', async () => { await p.click('Remote') }],
    ['app info', async () => { await p.clickSel('.status-trigger') }]
  ]
  for (const themeRound of [0, 1]) {
    const theme = await p.ev(`document.documentElement.dataset.theme || document.body.dataset.theme || (document.documentElement.className.match(/light|dark/)||['?'])[0]`)
    for (const [w, h] of SIZES) for (const sc of SCALES) {
      const cssW = Math.round(w / sc), cssH = Math.round(h / sc)
      if (cssW < 640) continue
      await p.viewport(cssW, cssH, 1); await sleep(350)
      for (const [name, open] of surfaces) {
        try { await p.key('Escape'); await sleep(120); await open(); await sleep(450) } catch (e) { findings.push(`${name}: could not open (${e.message})`); continue }
        const hits = await p.ev(SCAN)
        for (const f of hits) {
          const line = `[theme ${theme} ${w}x${h}@${sc}] ${name}: ${f}`
          findings.push(line); console.log(line)
        }
        if (hits.length) await p.shot(path.join(outDir, `${theme}-${w}x${h}@${sc}-${name.replace(/ /g, '_')}.png`))
        await p.key('Escape'); await sleep(100)
      }
    }
    if (themeRound === 0) { await p.clearViewport(); await p.click('Switch to', 'button'); await sleep(500) }
  }
  console.log(`\nsweep: ${findings.length} findings`)
  const logs = p.takeLogs().filter((l) => !/Electron Security Warning/.test(l.text))
  if (logs.length) console.log('console problems:', JSON.stringify(logs.slice(0, 6)))
  p.close(); await app.kill()
})().catch((e) => { console.error(e); process.exit(2) })
