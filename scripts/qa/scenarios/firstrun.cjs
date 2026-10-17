#!/usr/bin/env node
/* Scenario: first run on a fresh profile (nothing set up): the start screen, the "Set up Sunday" checklist, every empty state of the main places, the Help manual (every page), the keyboard cheat sheet, the ⚙ menu.
 *   node scripts/qa/scenarios/firstrun.cjs [port]    -> qa-out/census-runtime-scenarios-firstrun.json */
const fs = require('fs')
const { launch, sleep } = require('../lib.cjs'); const { recorder } = require('../scenario-lib.cjs')
const port = +(process.argv[2] || 9992)
const rec = recorder('firstrun')
;(async () => {
  const profile = '/tmp/qa-fresh'; fs.rmSync(profile, { recursive: true, force: true })
  const app = await launch({ profile, port, remotePort: 4490, mdns: 'born-qa-fresh', settle: 9000 })
  const p = await app.page(); await p.viewport(1366, 768)
  try {
    await rec.capture(p, 'first-launch', 'fresh profile, first screen')
    for (const sec of ['Bible', 'Songs', 'Media', 'Saved', 'Tape', 'Queue', 'Sermons']) { await p.click(sec); await sleep(900); await rec.capture(p, 'empty-' + sec.toLowerCase(), sec + ' with an empty profile') }
    await p.click('Settings and help'); await sleep(500); await rec.capture(p, 'gear-menu', '⚙ menu')
    await p.click('Keyboard shortcuts'); await sleep(700); await rec.capture(p, 'shortcuts', 'keyboard shortcuts sheet'); await p.key('Escape'); await sleep(400)
    await p.click('Settings and help'); await sleep(400); await p.click('Open the manual'); await sleep(1500); await rec.capture(p, 'manual-open', 'manual first page')
    // every manual page
    const pages = await p.ev(`window.electronAPI.getManualManifest().then(m=>m.sections.flatMap(s=>s.pages.map(x=>({id:x.id,title:x.title}))))`)
    let k = 0
    for (const pg of pages) { k++; const ok = await p.click(pg.title.slice(0, 28), 'button,a,[role=treeitem],li,[role=tab]'); await sleep(600); await rec.capture(p, 'manual-' + String(k).padStart(2, '0') + '-' + pg.id, 'manual page: ' + pg.title, { shot: k % 3 === 0 }); if (!ok) rec.note('could not click manual page ' + pg.title) }
    await p.key('Escape'); await sleep(500)
    for (const [w, h] of [[1040, 640], [1920, 1080]]) { await p.viewport(w, h); await p.send('Page.reload'); await sleep(2500); await rec.capture(p, `first-launch-${w}`, `fresh profile at ${w}x${h}`) }
  } catch (e) { rec.note('SCENARIO ERROR ' + String(e).slice(0, 300)) }
  rec.save(); p.close(); await app.kill(); console.log('first-run scenario done')
})()
