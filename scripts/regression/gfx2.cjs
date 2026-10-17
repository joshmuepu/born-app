const { chromium, webkit } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9920')
  let main
  for (const p of browser.contexts().flatMap((c) => c.pages())) { try { if ((await p.evaluate(() => document.title)) === 'Born Again') main = p } catch {} }
  const api = (fn, ...a) => main.evaluate(([f, x]) => window.electronAPI[f](...x), [fn, a])
  // a fresh profile has no Graphics page: make the one this check needs
  let outs = await api('listOutputs')
  if (!outs.some((o) => o.kind === 'browser')) outs = await api('addGraphicsOutput', (await api('listChannels'))[0].id)
  const g = outs.find((o) => o.kind === 'browser')
  await api('showSlide', { kind: 'bible', text: 'For God so loved the world', reference: 'John 3:16 · KJV' }); await sleep(1200)
  const wk = await webkit.launch(); const gp = await (await wk.newContext()).newPage()
  await gp.goto(g.url); await sleep(2000)
  const results = []
  const snap = async (l, wantText, wantBlanked) => {
    const text = await gp.evaluate(() => (document.getElementById('text-inner').textContent || '').slice(0, 24))
    const blanked = (await api('getLiveState')).find((c) => c.id === 'main').blanked
    const ok = text === wantText && blanked === wantBlanked
    results.push(ok); console.log(ok ? 'PASS' : 'FAIL', l.padEnd(22), JSON.stringify({ text, blanked }))
  }
  const T = 'For God so loved the wor'
  await snap('projected', T, false)
  await main.evaluate(() => window.electronAPI.setBlankScreen(true)); await sleep(1000); await snap('blank true', '', true)
  await main.evaluate(() => window.electronAPI.setBlankScreen(false)); await sleep(1200); await snap('blank false', T, false)
  await api('setDestinationSuppressed', g.id, true); await sleep(1000); await snap('suppressed', '', false)
  await api('setDestinationSuppressed', g.id, false); await sleep(1500); await snap('un-suppressed', T, false)
  await api('setDestinationSuppressed', g.id, false); await sleep(800); await snap('un-suppressed again', T, false)
  // with Auto on, a Bible verse is full-screen whatever the page is set to; turn Auto off to check the fixed profile
  await api('setOutputAutoProfile', g.id, false); await api('setOutputProfile', g.id, 'lower-third')
  let prof = null
  for (let i = 0; i < 20 && prof !== 'lower-third'; i++) { await sleep(300); prof = await gp.evaluate(() => document.getElementById('stage').dataset.profile) } // the page follows within a few seconds
  results.push(prof === 'lower-third'); console.log(prof === 'lower-third' ? 'PASS' : 'FAIL', 'profile lower-third', prof)
  await api('setOutputProfile', g.id, 'fullscreen'); await sleep(800)
  console.log(results.length, 'checks,', results.filter((r) => !r).length, 'failed')
  await wk.close(); await browser.close()
  process.exitCode = results.every(Boolean) ? 0 : 1
})().catch((e) => { console.error(e); process.exit(1) })
