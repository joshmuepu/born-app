/* Visual tour (scripts only, never shipped): drives a short mock service through the real app on an isolated profile and saves a
 * screenshot at every step, of the operator window and of the congregation screen and stage monitor (kept hidden by hide-outputs.cjs),
 * plus the phone remote in WebKit. The pictures are for a person to look at; they can show library text, so they stay local.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/visual-tour.cjs <profileDir> <outDir> [dark|light]   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep } = require('./lib.cjs')
const pw = require(path.join(process.env.PW_DIR || '/tmp/born-pw', 'node_modules', 'playwright'))
const [profile, out, theme = 'dark'] = process.argv.slice(2)
const PORT = Number(process.env.BORN_REMOTE_PORT || 14350), B = `http://127.0.0.1:${PORT}`
const SIZES = (process.env.TOUR_SIZES || '1366x768@1,1040x640@1').split(',').map((s) => s.match(/(\d+)x(\d+)@([\d.]+)/).slice(1).map(Number))

;(async () => {
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true }); fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ theme }))
  const app = await launch({ profile, remotePort: PORT, port: Number(process.env.CDP_PORT || 9380), mdns: 'born-remote-v1tour', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  const p = await app.page()
  const problems = []
  let n = 0
  const outputs = async (tag) => {
    for (const t of await app.targets()) {
      if (t.type !== 'page' || !/Congregation screen|Stage monitor/.test(t.title)) continue
      const o = await require('./lib.cjs').Page.prototype.connect.call(new (require('./lib.cjs').Page)(t))
      await o.viewport(1280, 720, 1); await sleep(600)
      await o.shot(path.join(out, `${String(n).padStart(2, '0')}-${tag}-${/Stage/.test(t.title) ? 'stage' : 'congregation'}.png`))
      for (const l of o.takeLogs()) if (!/Electron Security Warning/.test(l.text)) problems.push(`${t.title}: ${l.kind} ${l.text}`)
      o.close()
    }
  }
  const shot = async (tag, withOutputs = false) => {
    n++
    for (const [w, h, sc] of SIZES) {
      await p.viewport(Math.round(w / sc), Math.round(h / sc), sc); await sleep(450)
      await p.shot(path.join(out, `${String(n).padStart(2, '0')}-${tag}-${w}x${h}@${sc}.png`))
    }
    await p.clearViewport(); await sleep(200)
    if (withOutputs) await outputs(tag)
    for (const l of p.takeLogs()) if (!/Electron Security Warning/.test(l.text)) problems.push(`${tag}: ${l.kind} ${l.text}`)
  }
  const step = async (tag, fn, withOutputs) => { try { await fn() } catch (e) { problems.push(`${tag}: step failed: ${e.message}`) } await sleep(700); await shot(tag, withOutputs) }
  const clickAria = (label) => p.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||x.title||'').startsWith(${JSON.stringify(label)})&&x.offsetParent);if(b){b.click();return true}return false})()`)
  // the first visible button inside `sel` whose text starts with `text` (hidden panels stay mounted, so visibility matters)
  const clickIn = async (sel, text) => { const ok = await p.ev(`(()=>{const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&e.offsetParent!==null};const b=[...document.querySelectorAll(${JSON.stringify(sel)} + ' button')].find(x=>vis(x)&&x.textContent.trim().startsWith(${JSON.stringify(text)}));if(b){b.scrollIntoView({block:'nearest'});b.click();return true}return false})()`); if (!ok) throw new Error(`no visible "${text}" button in ${sel}`) }
  const search = async (text) => { await p.ev(`(()=>{const i=[...document.querySelectorAll('input')].find(x=>x.offsetParent&&x.getBoundingClientRect().width>0&&/search|reference|song|verse|john/i.test(x.placeholder||''));if(!i)throw new Error('no search box');i.focus();i.select()})()`); await p.insertText(text); await p.key('Enter'); await sleep(2200) }

  await step('idle', async () => {})
  await step('sermon-results', async () => { await search('faith') })
  await step('sermon-queued-and-projecting', async () => {
    await clickIn('.results-list', '+ Queue'); await sleep(300)
    await p.ev(`(()=>{const r=document.querySelectorAll('.results-list .result-head')[1];const b=r&&[...r.querySelectorAll('button')].find(x=>x.textContent.includes('Queue'));b&&b.click()})()`)
    await p.click('Open projection'); await sleep(2500)
    await clickIn('.results-list', 'Project'); await sleep(1500)
    console.log('queue rows after two + Queue:', await p.ev(`document.querySelectorAll('.queue-row').length`))
  }, true)
  await step('next-paragraph', async () => { await p.ev('document.activeElement&&document.activeElement.blur()'); await p.key('ArrowRight'); await sleep(900) }, true)
  await step('hidden', async () => { await p.key('Escape'); await sleep(900) }, true)
  await step('shown-again', async () => { await p.click('Show screen'); await sleep(900) }, true)
  await step('sermon-browse', async () => { await p.click('Browse', '.panel-subtab'); await sleep(1500) })
  await step('bible', async () => { await p.click('Bible', '.panel-tab'); await sleep(600); await search('John 3:16') })
  await step('bible-projected', async () => { await clickIn('', 'Project'); await sleep(1500) }, true)
  await step('songs', async () => { await p.click('Songs', '.panel-tab'); await sleep(600); await search('amazing grace') })
  await step('song-open', async () => { await p.clickSel('.song-row'); await sleep(1200) })
  await step('song-projected', async () => { await clickIn('', 'Project'); await sleep(1500) }, true)
  await step('song-queued', async () => { await clickIn('', '+ Queue'); await sleep(800) })
  await step('message-dialog', async () => { await p.click('Message'); await sleep(600); await p.ev(`(()=>{const t=document.querySelector('[role=dialog] textarea, .modal textarea, .modal input[type=text]');t&&t.focus()})()`); await p.insertText('Placeholder message for the stage'); await sleep(300) })
  await step('message-sent', async () => { await p.ev(`(()=>{const b=[...document.querySelectorAll('.modal button')].find(x=>x.textContent.trim()==='Show message');if(!b)throw new Error('no Show message button');b.click()})()`); await sleep(1200) }, true)
  await step('screens', async () => { await p.key('Escape', { shift: false }); await sleep(300); await p.click('Screens'); await sleep(800) })
  await step('remote', async () => { await p.key('Escape'); await p.click('Remote'); await sleep(2500) })
  await step('help', async () => { await p.key('Escape'); await p.key('F1'); await sleep(1200) })
  await step('shortcuts', async () => { await p.key('Escape'); await sleep(300); await p.click('Shortcuts'); await sleep(800) })
  await step('app-info', async () => { await p.key('Escape'); await sleep(300); await p.clickSel('.status-trigger'); await sleep(800) })
  await p.key('Escape')

  // the phone remote, WebKit, a phone and an iPad
  const browser = await pw.webkit.launch()
  for (const [name, vw, vh, touch] of [['phone', 390, 844, true], ['ipad', 820, 1180, true]]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: touch })
    await ctx.addInitScript(() => { try { localStorage.setItem('born-remote-role-dismissed', '1'); localStorage.setItem('born-remote-a2hs-dismissed', '1') } catch (_) {} })
    const ph = await ctx.newPage()
    ph.on('pageerror', (e) => problems.push(`${name}: pageerror ${e.message}`))
    ph.on('console', (m) => { if (m.type() === 'error') problems.push(`${name}: console ${m.text()}`) })
    await ph.goto(B + '/'); await ph.waitForFunction(() => typeof setTab === 'function'); await sleep(1800)
    for (const tab of ['queue', 'sermons', 'bible', 'songs']) {
      await ph.evaluate((t) => setTab(t), tab); await sleep(900)
      if (tab === 'sermons') { const i = ph.locator('input:visible').first(); if (await i.count()) { await i.fill('faith'); await i.press('Enter'); await sleep(2000) } }
      if (tab === 'songs') { await sleep(600) }
      n++; await ph.screenshot({ path: path.join(out, `${String(n).padStart(2, '0')}-${name}-${tab}.png`) })
    }
    await ctx.close()
  }
  await browser.close()
  console.log(`visual-tour (${theme}): ${n} steps, ${fs.readdirSync(out).length} pictures`)
  console.log(problems.length ? 'problems:\n' + problems.join('\n') : 'no console errors or failed steps')
  await app.kill(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(2) })
